import type { CabinetRead } from '@/types/entities';
import { CabinetType } from '@/types/enums';
import type {
  GoldenRule,
  KitchenPlan,
  PlacedModule,
  PlannerInput,
  Segment,
  SolverCandidate,
  SolverVariant,
  WallConfig,
  WallPlan,
} from './types';
import {
  CORNER_WALL_OCCUPANCY,
  CORNER_CABINET_DEPTH,
  FILLER_WIDTHS,
  LOWER_DEPTH,
  LOWER_HEIGHT,
  UPPER_DEPTH,
  UPPER_HEIGHT,
} from './constants';
import { segmentWall } from './segmenter';
import { GoldenTable } from './golden-table';
import { solve } from './solver';
import { scorePlan } from './scoring-engine';

const MAX_VARIANTS = 10;

/** Generate a unique ID for a placed module. */
let moduleCounter = 0;
function nextModuleId(): string {
  return `mod-${++moduleCounter}`;
}

/** Reset the module counter (useful for testing). */
export function resetModuleCounter(): void {
  moduleCounter = 0;
}

/** Build lookup maps for O(1) module access. */
function buildModuleMaps(modules: CabinetRead[]) {
  const byId = new Map<number, CabinetRead>();
  const byArticle = new Map<string, CabinetRead>();
  for (const m of modules) {
    byId.set(m.id, m);
    if (!byArticle.has(m.article)) byArticle.set(m.article, m);
  }
  return { byId, byArticle };
}

/**
 * Resolve golden rule articles into CabinetRead modules.
 * Returns matched cabinets or null if any article is not found.
 */
function resolveArticles(
  articles: string[],
  articleMap: Map<string, CabinetRead>,
): CabinetRead[] | null {
  const resolved: CabinetRead[] = [];
  for (const article of articles) {
    const cabinet = articleMap.get(article);
    if (!cabinet) return null;
    resolved.push(cabinet);
  }
  return resolved;
}

/**
 * Create PlacedModule instances from cabinets, placing them sequentially
 * starting at `startX` within the given wall.
 */
function placeCabinets(
  cabinets: CabinetRead[],
  startX: number,
  wallId: string,
): PlacedModule[] {
  const placed: PlacedModule[] = [];
  let x = startX;

  for (const cab of cabinets) {
    placed.push({
      id: nextModuleId(),
      cabinetId: cab.id,
      article: cab.article,
      x,
      width: cab.width,
      height: cab.height,
      depth: cab.depth,
      type: mapCabinetType(cab),
      wallId,
      glbFile: cab.glb_file,
    });
    x += cab.width;
  }

  return placed;
}

/**
 * Create a filler PlacedModule.
 */
function placeFiller(
  x: number,
  fillerWidth: number,
  wallId: string,
  tier: 'lower' | 'upper' = 'lower',
): PlacedModule {
  return {
    id: nextModuleId(),
    cabinetId: -1,
    article: `FILLER-${fillerWidth}`,
    x,
    width: fillerWidth,
    height: tier === 'upper' ? UPPER_HEIGHT : LOWER_HEIGHT,
    depth: tier === 'upper' ? UPPER_DEPTH : LOWER_DEPTH,
    type: 'filler',
    wallId,
  };
}

/** Map CabinetRead type to PlacedModule type. */
function mapCabinetType(
  cab: CabinetRead,
): 'lower' | 'upper' | 'tall' | 'filler' | 'corner' {
  if (cab.is_corner) return 'corner';
  switch (cab.type) {
    case CabinetType.LOWER:
      return 'lower';
    case CabinetType.UPPER:
      return 'upper';
    case CabinetType.TALL:
      return 'tall';
    default:
      return 'lower';
  }
}

/**
 * Solve a single segment using the 3-layer approach:
 * Layer 1: Golden table exact match
 * Layer 1.5: Golden table + filler
 * Layer 2: Backtracking solver
 *
 * Returns an array of possible solutions (each is an array of PlacedModules).
 */
function solveSegment(
  segment: Segment,
  goldenTable: GoldenTable,
  availableModules: CabinetRead[],
  maps: ReturnType<typeof buildModuleMaps>,
): PlacedModule[][] {
  if (segment.isTrim) return [[]]; // skip trim segments

  const solutions: PlacedModule[][] = [];

  // Layer 1: Exact golden match
  const exactRule = goldenTable.lookup(segment.context, segment.width);
  if (exactRule) {
    const resolved = resolveArticles(exactRule.moduleArticles, maps.byArticle);
    if (resolved) {
      solutions.push(placeCabinets(resolved, segment.start, segment.wallId));
    }
  }

  // Layer 1.5: Golden match + filler
  const fillerMatch = goldenTable.lookupWithFiller(
    segment.context,
    segment.width,
  );
  if (fillerMatch) {
    const resolved = resolveArticles(
      fillerMatch.rule.moduleArticles,
      maps.byArticle,
    );
    if (resolved) {
      const placed = placeCabinets(resolved, segment.start, segment.wallId);
      const lastModule = placed[placed.length - 1];
      const fillerX = lastModule
        ? lastModule.x + lastModule.width
        : segment.start;
      placed.push(placeFiller(fillerX, fillerMatch.fillerWidth, segment.wallId));
      solutions.push(placed);
    }
  }

  // Layer 2: Backtracking solver
  const lowerModules = availableModules.filter(
    (m) => m.type === CabinetType.LOWER ,
  );
  const candidates = solve(segment.width, lowerModules);

  for (const candidate of candidates.slice(0, 5)) {
    const modules = candidateToPlacedModules(
      candidate,
      segment.start,
      segment.wallId,
      maps.byId,
    );
    if (modules) {
      solutions.push(modules);
    }
  }

  // If no solution found, try with fillers
  if (solutions.length === 0) {
    for (const fw of FILLER_WIDTHS) {
      const reduced = segment.width - fw;
      if (reduced <= 0) continue;
      const candidates2 = solve(reduced, lowerModules);
      for (const candidate of candidates2.slice(0, 3)) {
        const modules = candidateToPlacedModules(
          candidate,
          segment.start,
          segment.wallId,
          maps.byId,
        );
        if (modules) {
          modules.push(
            placeFiller(
              segment.start + reduced,
              fw,
              segment.wallId,
            ),
          );
          solutions.push(modules);
        }
      }
    }
  }

  return solutions.length > 0 ? solutions : [[]];
}

/**
 * Solve upper cabinet placement for a wall.
 * Runs the solver with upper modules for each segment,
 * skipping segments adjacent to cooktop anchors (hood zone).
 */
function solveUpperForWall(
  wallConfig: WallConfig,
  segments: Segment[],
  availableModules: CabinetRead[],
  idMap: Map<number, CabinetRead>,
): PlacedModule[] {
  const upperModules = availableModules.filter(
    (m) => m.type === CabinetType.UPPER ,
  );
  if (upperModules.length === 0) return [];

  // Find cooktop anchor positions — no uppers above a hood/cooktop
  const cooktopAnchors = wallConfig.anchors.filter((a) => a.type === 'cooktop');

  const placed: PlacedModule[] = [];

  for (const segment of segments) {
    if (segment.isTrim) continue;

    // Skip segments that overlap with cooktop anchor zones (hood area)
    const overlapsCooktop = cooktopAnchors.some((a) => {
      const anchorStart = a.position;
      const anchorEnd = a.position + a.width;
      return segment.start < anchorEnd && segment.end > anchorStart;
    });
    if (overlapsCooktop) continue;

    // Try to solve upper placement for this segment width
    const candidates = solve(segment.width, upperModules);

    if (candidates.length > 0) {
      const modules = candidateToPlacedModules(
        candidates[0], segment.start, segment.wallId, idMap,
        'upper', UPPER_HEIGHT, UPPER_DEPTH,
      );
      if (modules) {
        placed.push(...modules);
        // Add upper filler if there's remaining space
        const usedWidth = modules.reduce((s, m) => s + m.width, 0);
        const remaining = segment.width - usedWidth;
        if (remaining > 0) {
          placed.push(placeFiller(segment.start + usedWidth, remaining, segment.wallId, 'upper'));
        }
      }
    } else {
      // No exact solution — try with fillers
      for (const fw of FILLER_WIDTHS) {
        const reduced = segment.width - fw;
        if (reduced <= 0) continue;
        const withFiller = solve(reduced, upperModules);
        if (withFiller.length > 0) {
          const modules = candidateToPlacedModules(
            withFiller[0], segment.start, segment.wallId, idMap,
            'upper', UPPER_HEIGHT, UPPER_DEPTH,
          );
          if (modules) {
            const usedWidth = modules.reduce((s, m) => s + m.width, 0);
            placed.push(...modules);
            placed.push(placeFiller(segment.start + usedWidth, fw, segment.wallId, 'upper'));
          }
          break;
        }
      }
    }
  }

  return placed;
}

/**
 * Convert a SolverCandidate into PlacedModules by resolving cabinet IDs.
 */
function candidateToPlacedModules(
  candidate: SolverCandidate,
  startX: number,
  wallId: string,
  idMap: Map<number, CabinetRead>,
  typeOverride?: PlacedModule['type'],
  defaultHeight?: number,
  defaultDepth?: number,
): PlacedModule[] | null {
  const placed: PlacedModule[] = [];
  let x = startX;

  for (let i = 0; i < candidate.cabinetIds.length; i++) {
    const cab = idMap.get(candidate.cabinetIds[i]);
    if (!cab) return null;

    placed.push({
      id: nextModuleId(),
      cabinetId: cab.id,
      article: cab.article,
      x,
      width: cab.width,
      height: defaultHeight ? (cab.height || defaultHeight) : cab.height,
      depth: defaultDepth ? (cab.depth || defaultDepth) : cab.depth,
      type: typeOverride ?? mapCabinetType(cab),
      wallId,
      glbFile: cab.glb_file,
    });
    x += cab.width;
  }

  return placed;
}

/**
 * Generate wall plan variants by combining segment solutions.
 * Uses a capped cartesian product to avoid exponential blowup.
 */
function generateWallVariants(
  wallConfig: WallConfig,
  segmentSolutions: PlacedModule[][][],
): WallPlan[] {
  // Cap the total combinations
  const MAX_COMBOS = 20;

  let combos: PlacedModule[][] = [[]];

  for (const segSolutions of segmentSolutions) {
    const newCombos: PlacedModule[][] = [];
    for (const existing of combos) {
      for (const solution of segSolutions) {
        newCombos.push([...existing, ...solution]);
        if (newCombos.length >= MAX_COMBOS) break;
      }
      if (newCombos.length >= MAX_COMBOS) break;
    }
    combos = newCombos;
  }

  return combos.map((modules) => ({
    wallId: wallConfig.id,
    modules,
  }));
}

/**
 * Select the best corner cabinet for the wall junction.
 * In L-shaped layouts, a corner cabinet sits at the junction of two walls.
 */
function selectCornerCabinet(
  modules: CabinetRead[],
): PlacedModule | null {
  const cornerModules = modules.filter((m) => m.is_corner);
  if (cornerModules.length === 0) return null;

  // Pick the first available corner cabinet (could be improved with scoring)
  const cab = cornerModules[0];
  return {
    id: nextModuleId(),
    cabinetId: cab.id,
    article: cab.article,
    x: 0,
    width: cab.width || CORNER_WALL_OCCUPANCY,
    height: cab.height || LOWER_HEIGHT,
    depth: cab.depth || CORNER_CABINET_DEPTH,
    type: 'corner',
    wallId: 'corner-junction',
    rotation: 0,
    glbFile: cab.glb_file,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

const EMPTY_SCORE_BREAKDOWN = {
  widthConsistency: 0,
  moduleSweetSpot: 0,
  ergonomicPlacement: 0,
  fillerPenalty: 0,
  symmetry: 0,
  aestheticGrouping: 0,
  visualComposition: 0,
  workingTriangle: 0,
  upperCoverage: 0,
  cornerFit: 0,
};

/**
 * Plan a complete kitchen layout.
 *
 * For each wall: segment → solve each segment (3-layer) → combine into variants.
 * Then solve upper cabinets for each wall.
 * For L-shaped layouts, reserve corner space and place a corner cabinet.
 * Score each variant and return the top results.
 */
export function planKitchen(input: PlannerInput): SolverVariant[] {
  resetModuleCounter();

  const goldenTable = new GoldenTable(
    input.goldenRules.length > 0 ? input.goldenRules : undefined,
  );
  const maps = buildModuleMaps(input.modules);

  // Corner cabinet reservation for L-shaped layouts
  let cornerModule: PlacedModule | null = null;
  const cornerOffsets: Map<string, { startOffset?: number; endOffset?: number }> = new Map();

  if (input.layoutType === 'l-shaped' && input.walls.length >= 2) {
    cornerModule = selectCornerCabinet(input.modules);
    if (cornerModule) {
      const occupancy = cornerModule.width || CORNER_WALL_OCCUPANCY;
      // Corner sits at end of wall[0] and start of wall[1]
      cornerOffsets.set(input.walls[0].id, { endOffset: occupancy });
      cornerOffsets.set(input.walls[1].id, { startOffset: occupancy });
    }
  }

  // Solve each wall independently
  const wallVariantSets: WallPlan[][] = [];

  for (const wallConfig of input.walls) {
    const offset = cornerOffsets.get(wallConfig.id);
    const segments = segmentWall(wallConfig, offset);

    // Solve lower cabinets
    const segmentSolutions: PlacedModule[][][] = segments.map((seg) =>
      solveSegment(seg, goldenTable, input.modules, maps),
    );

    const wallVariants = generateWallVariants(wallConfig, segmentSolutions);

    // Solve upper cabinets once per wall and append to each variant
    const upperModules = solveUpperForWall(
      wallConfig,
      segments,
      input.modules,
      maps.byId,
    );

    // Add upper modules to each wall variant
    for (const variant of wallVariants) {
      variant.modules.push(...upperModules);
    }

    wallVariantSets.push(wallVariants);
  }

  // Combine wall variants into full kitchen plans (capped cartesian product)
  let kitchenCombos: WallPlan[][] = [[]];

  for (const wallVariants of wallVariantSets) {
    const next: WallPlan[][] = [];
    for (const existing of kitchenCombos) {
      for (const wallPlan of wallVariants) {
        next.push([...existing, wallPlan]);
        if (next.length >= MAX_VARIANTS * 3) break;
      }
      if (next.length >= MAX_VARIANTS * 3) break;
    }
    kitchenCombos = next;
  }

  // Score and rank
  const scoredPlans: KitchenPlan[] = kitchenCombos.map((walls) => {
    const plan: KitchenPlan = {
      walls,
      cornerModules: cornerModule ? [cornerModule] : [],
      score: 0,
      scoreBreakdown: { ...EMPTY_SCORE_BREAKDOWN },
    };

    const result = scorePlan(plan);
    plan.score = result.total;
    plan.scoreBreakdown = result.breakdown;

    return plan;
  });

  scoredPlans.sort((a, b) => b.score - a.score);

  return scoredPlans.slice(0, MAX_VARIANTS).map((plan, idx) => ({
    plan,
    rank: idx + 1,
  }));
}
