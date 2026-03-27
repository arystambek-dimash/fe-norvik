import type { CabinetRead } from '@/types/entities';
import { CabinetKind, CabinetSubtype, CabinetType } from '@/types/enums';
import type {
  CornerJunction,
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
  UPPER_Y,
  ANTRESOL_RULES,
  MIN_UPPER_FILLER,
  MAX_UPPER_FILLER,
  MIN_LOWER_FILLER,
  MAX_LOWER_FILLER,
  FILLER_STEP,
  MODULE_GRID,
  MIN_SEGMENT,
  ARTICLE_PREFIX,
  MAX_COUNTERTOP,
} from './constants';
import { segmentWall, segmentWallForUppers } from './segmenter';
import { GoldenTable } from './golden-table';
import { solve } from './solver';
import { scorePlan, EMPTY_SCORE_BREAKDOWN } from './scoring';
import type { ScoringContext } from './scoring/types';

const MAX_VARIANTS = 10;

/**
 * Capped cartesian product: combine arrays from each set,
 * stopping once `maxSize` combinations are reached.
 */
function cappedCartesian<T>(sets: T[][], maxSize: number): T[][] {
  let combos: T[][] = [[]];
  for (const items of sets) {
    const next: T[][] = [];
    for (const existing of combos) {
      for (const item of items) {
        next.push([...existing, item]);
        if (next.length >= maxSize) break;
      }
      if (next.length >= maxSize) break;
    }
    combos = next;
  }
  return combos;
}

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
export function buildModuleMaps(modules: CabinetRead[]) {
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
    placed.push(cabinetToModule(cab, x, wallId, {
      height: cab.height,
      depth: cab.depth,
    }));
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
): 'lower' | 'upper' | 'tall' | 'filler' | 'corner' | 'antresol' {
  if (cab.is_corner) return 'corner';
  if (cab.kind === CabinetKind.ANTRESOL) return 'antresol';
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

/** Create a PlacedModule from a CabinetRead with default height/depth fallback. */
function cabinetToModule(
  cab: CabinetRead,
  x: number,
  wallId: string,
  overrides?: Partial<Pick<PlacedModule, 'type' | 'height' | 'depth' | 'rotation' | 'yOffset'>>,
): PlacedModule {
  return {
    id: nextModuleId(),
    cabinetId: cab.id,
    article: cab.article,
    kind: cab.kind,
    subtype: cab.subtype,
    x,
    width: cab.width,
    height: overrides?.height ?? (cab.height || LOWER_HEIGHT),
    depth: overrides?.depth ?? (cab.depth || LOWER_DEPTH),
    type: overrides?.type ?? mapCabinetType(cab),
    wallId,
    rotation: overrides?.rotation,
    yOffset: overrides?.yOffset,
    glbFile: cab.glb_file,
  };
}

/**
 * Solve a single segment using the 3-layer approach:
 * Layer 1: Golden table exact match
 * Layer 1.5: Golden table + filler
 * Layer 2: Backtracking solver
 *
 * Returns an array of possible solutions (each is an array of PlacedModules).
 */
export function solveSegment(
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

  // If no solution found, try flexible filler strategies
  if (solutions.length === 0) {
    // Strategy A: Round segment width down to MODULE_GRID, filler absorbs remainder
    const remainder = segment.width % MODULE_GRID;
    if (remainder > 0 && remainder >= MIN_LOWER_FILLER) {
      const rounded = segment.width - remainder;
      if (rounded > 0) {
        const roundedCandidates = solve(rounded, lowerModules);
        for (const candidate of roundedCandidates.slice(0, 3)) {
          const modules = candidateToPlacedModules(
            candidate, segment.start, segment.wallId, maps.byId,
          );
          if (modules) {
            modules.push(placeFiller(segment.start + rounded, remainder, segment.wallId));
            solutions.push(modules);
          }
        }
      }
    }

    // Strategy B: Sweep filler range (same pattern as solveUpperForWall)
    if (solutions.length === 0) {
      outerFiller:
      for (let fw = MIN_LOWER_FILLER; fw <= MAX_LOWER_FILLER; fw += FILLER_STEP) {
        const reduced = segment.width - fw;
        if (reduced <= 0) continue;
        const fillerCandidates = solve(reduced, lowerModules);
        for (const candidate of fillerCandidates.slice(0, 3)) {
          const modules = candidateToPlacedModules(
            candidate, segment.start, segment.wallId, maps.byId,
          );
          if (modules) {
            modules.push(placeFiller(segment.start + reduced, fw, segment.wallId));
            solutions.push(modules);
          }
          if (solutions.length >= 5) break outerFiller;
        }
      }
    }
  }

  // Guarantee: never return empty for a non-trim segment with positive width
  if (solutions.length === 0 && segment.width > 0) {
    solutions.push([placeFiller(segment.start, segment.width, segment.wallId)]);
  }

  return solutions.length > 0 ? solutions : [[]];
}

/**
 * Solve upper cabinet placement for a wall.
 * When useHood is true, skips the cooktop zone (leaves space for hood).
 * When useHood is false, fills the full wall with uppers (no cooktop gap).
 */
const MAX_UPPER_SOLUTIONS = 5;

function solveUpperForWall(
  wallConfig: WallConfig,
  availableModules: CabinetRead[],
  idMap: Map<number, CabinetRead>,
  cornerOffset?: { startOffset?: number; endOffset?: number },
  useHood?: boolean,
): PlacedModule[][] {
  const allUppers = availableModules.filter(
    (m) => m.type === CabinetType.UPPER && m.kind === CabinetKind.DOOR && m.width > SIDE_PANEL_WIDTH,
  );
  if (allUppers.length === 0) return [[]];

  // Group by height — all uppers on a wall must share one height to avoid visual overlap
  const byHeight = new Map<number, CabinetRead[]>();
  for (const m of allUppers) {
    const h = m.height || UPPER_HEIGHT;
    if (!byHeight.has(h)) byHeight.set(h, []);
    byHeight.get(h)!.push(m);
  }

  // Pick the height group with most unique widths for best solver coverage
  let upperModules: CabinetRead[] = [];
  let bestUniqueWidths = 0;
  for (const [, group] of byHeight) {
    const uniqueWidths = new Set(group.map((m) => m.width)).size;
    if (uniqueWidths > bestUniqueWidths) {
      bestUniqueWidths = uniqueWidths;
      upperModules = group;
    }
  }
  if (upperModules.length === 0) return [[]];

  // When useHood: skip cooktop zones. Otherwise: full wall as one segment.
  const start = cornerOffset?.startOffset ?? 0;
  const end = wallConfig.length - (cornerOffset?.endOffset ?? 0);
  const upperSegments: Segment[] = useHood
    ? segmentWallForUppers(wallConfig, cornerOffset)
    : [{ wallId: wallConfig.id, start, end, width: end - start, context: 'standard' as const, isTrim: false }];

  // Collect multiple solutions per segment
  const segmentUpperSolutions: PlacedModule[][][] = [];

  for (const segment of upperSegments) {
    if (segment.isTrim) continue;

    const segSolutions: PlacedModule[][] = [];
    const seenWidthSigs = new Set<string>();

    // Layer 1: Exact matches — take top candidates with diversity filtering
    const exactCandidates = solve(segment.width, upperModules, { preferVariety: true });
    for (const candidate of exactCandidates) {
      if (segSolutions.length >= 3) break;
      // Diversity: skip candidates whose unique width set matches one already collected
      const widthSig = [...new Set(candidate.widths)].sort((a, b) => a - b).join(',');
      if (seenWidthSigs.has(widthSig)) continue;
      seenWidthSigs.add(widthSig);

      const modules = candidateToPlacedModules(
        candidate, segment.start, segment.wallId, idMap,
        'upper', UPPER_HEIGHT, UPPER_DEPTH,
      );
      if (modules) segSolutions.push(modules);
    }

    // Layer 2: Best-fit with filler — add more variety
    if (segSolutions.length < MAX_UPPER_SOLUTIONS) {
      outerFiller:
      for (let filler = MIN_UPPER_FILLER; filler <= MAX_UPPER_FILLER; filler += 10) {
        const reduced = segment.width - filler;
        if (reduced <= 0) continue;
        const candidates = solve(reduced, upperModules, { preferVariety: true });
        for (const candidate of candidates.slice(0, 2)) {
          const modules = candidateToPlacedModules(
            candidate, segment.start, segment.wallId, idMap,
            'upper', UPPER_HEIGHT, UPPER_DEPTH,
          );
          if (modules) {
            const usedWidth = modules.reduce((s, m) => s + m.width, 0);
            segSolutions.push([
              ...modules,
              placeFiller(segment.start + usedWidth, filler, segment.wallId, 'upper'),
            ]);
          }
          if (segSolutions.length >= MAX_UPPER_SOLUTIONS) break outerFiller;
        }
      }
    }

    // Layer 3: Full filler fallback
    if (segSolutions.length === 0) {
      segSolutions.push([placeFiller(segment.start, segment.width, segment.wallId, 'upper')]);
    }

    segmentUpperSolutions.push(segSolutions);
  }

  // If no segments were processed, return empty
  if (segmentUpperSolutions.length === 0) return [[]];

  // Cartesian product across segments (usually just 1 when useHood=false)
  const combos = cappedCartesian(
    segmentUpperSolutions,
    MAX_UPPER_SOLUTIONS,
  ).map((combo) => combo.flat());

  return combos.length > 0 ? combos : [[]];
}

// ── Upper cabinets aligned to lower boundaries ────────────────────────────

/**
 * Solve upper cabinets so that every upper module edge aligns with a lower
 * module boundary.  Runs AFTER all lower post-processing (СБ 200, sink, drawer)
 * so the lower positions are final.
 *
 * Returns multiple solutions for variant diversity.
 */
function solveUppersAlignedToLowers(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  availableModules: CabinetRead[],
  idMap: Map<number, CabinetRead>,
  cornerOffset?: { startOffset?: number; endOffset?: number },
  useHood?: boolean,
): PlacedModule[][] {
  // ── 1. Filter & group upper modules by height ──
  const allUppers = availableModules.filter(
    (m) => m.type === CabinetType.UPPER && m.kind === CabinetKind.DOOR && m.width > SIDE_PANEL_WIDTH,
  );
  if (allUppers.length === 0) return [[]];

  const byHeight = new Map<number, CabinetRead[]>();
  for (const m of allUppers) {
    const h = m.height || UPPER_HEIGHT;
    if (!byHeight.has(h)) byHeight.set(h, []);
    byHeight.get(h)!.push(m);
  }
  let upperModules: CabinetRead[] = [];
  let bestUniqueWidths = 0;
  for (const [, group] of byHeight) {
    const uniqueWidths = new Set(group.map((m) => m.width)).size;
    if (uniqueWidths > bestUniqueWidths) {
      bestUniqueWidths = uniqueWidths;
      upperModules = group;
    }
  }
  if (upperModules.length === 0) return [[]];

  // ── 2. Build slots: lower modules + anchors ──
  const effectiveStart = cornerOffset?.startOffset ?? 0;
  const effectiveEnd = wallConfig.length - (cornerOffset?.endOffset ?? 0);

  // Blocked ranges from tall modules
  const blocked: { start: number; end: number }[] = [];
  for (const m of wallPlan.modules) {
    if (m.type === 'tall') blocked.push({ start: m.x, end: m.x + m.width });
  }
  const isBlocked = (x: number, w: number) =>
    blocked.some((b) => x < b.end && x + w > b.start);

  // Collect slots from lower modules (skip fillers) and anchors
  type Slot = { x: number; width: number };
  const slotMap = new Map<string, Slot>(); // key = "x:width" for dedup

  // Lower modules (not fillers)
  for (const m of wallPlan.modules) {
    if (m.type !== 'lower') continue;
    if (m.x < effectiveStart || m.x + m.width > effectiveEnd) continue;
    if (isBlocked(m.x, m.width)) continue;
    slotMap.set(`${m.x}:${m.width}`, { x: m.x, width: m.width });
  }

  // Anchors (sink, cooktop)
  for (const anchor of wallConfig.anchors) {
    if (anchor.position < effectiveStart || anchor.position + anchor.width > effectiveEnd) continue;
    if (isBlocked(anchor.position, anchor.width)) continue;
    slotMap.set(`${anchor.position}:${anchor.width}`, { x: anchor.position, width: anchor.width });
  }

  const slots = [...slotMap.values()].sort((a, b) => a.x - b.x);
  if (slots.length === 0) return [[]];

  // ── 3. Build width→upper map ──
  const upperByWidth = new Map<number, CabinetRead>();
  for (const m of upperModules) {
    if (!upperByWidth.has(m.width)) upperByWidth.set(m.width, m);
  }

  // ── 4. Simple 1:1 mapping: each slot → upper of same width ──
  const result: PlacedModule[] = [];
  for (const slot of slots) {
    const upperCab = upperByWidth.get(slot.width);
    if (!upperCab) continue; // no matching upper → skip
    result.push(cabinetToModule(upperCab, slot.x, wallPlan.wallId, {
      height: upperCab.height > 0 ? upperCab.height : UPPER_HEIGHT,
      depth: upperCab.depth > 0 ? upperCab.depth : UPPER_DEPTH,
      type: 'upper',
    }));
  }

  return [result];
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

    placed.push(cabinetToModule(cab, x, wallId, {
      height: cab.height > 0 ? cab.height : (defaultHeight ?? cab.height),
      depth: cab.depth > 0 ? cab.depth : (defaultDepth ?? cab.depth),
      type: typeOverride ?? undefined,
    }));
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
  const combos = cappedCartesian(segmentSolutions, 20);

  return combos.map((segments) => ({
    wallId: wallConfig.id,
    modules: segments.flat(),
  }));
}

/**
 * Select a corner cabinet for a given wall junction.
 * @param cornerCabinets Pre-filtered list of `is_corner` cabinets from the catalog.
 * @param junctionId     The CornerJunction.id to tag the placed module with.
 * @param index          Which corner cabinet to pick (for multi-corner layouts).
 */
function selectCornerCabinet(
  cornerCabinets: CabinetRead[],
  junctionId: string,
  index: number = 0,
): PlacedModule | null {
  if (cornerCabinets.length === 0) return null;

  const cab = cornerCabinets[index % cornerCabinets.length];
  const mod = cabinetToModule(cab, 0, junctionId, {
    type: 'corner',
    height: cab.height || LOWER_HEIGHT,
    depth: cab.depth || CORNER_CABINET_DEPTH,
    rotation: 0,
  });
  mod.width = cab.width || CORNER_WALL_OCCUPANCY;
  return mod;
}

// ── Antresol placement ──────────────────────────────────────────────────────

/**
 * Determine which antresol article prefixes are compatible with a given
 * lower module, based on its article prefix.
 * Returns empty array if no antresol can be placed above this module.
 */
function getCompatibleAntresolPrefixes(lowerArticle: string): string[] {
  // ANTRESOL_RULES is pre-sorted by descending prefix length in constants.ts
  for (const rule of ANTRESOL_RULES) {
    if (lowerArticle.startsWith(rule.lowerPrefix)) {
      return rule.antresolPrefixes;
    }
  }
  return [];
}

/**
 * Solve antresol placement for a wall.
 * For each upper or tall module (ВП or П prefix), find a matching antresol
 * with the same width and a compatible article prefix.
 *
 * Antresols sit on top of their parent module:
 * - Above tall modules: yOffset = module height (tall starts from floor)
 * - Above upper modules: yOffset = UPPER_Y + module height (upper starts at UPPER_Y)
 */
/** Build a width→cabinets index for antresol lookup. */
function buildAntresolIndex(modules: CabinetRead[]): Map<number, CabinetRead[]> {
  const index = new Map<number, CabinetRead[]>();
  for (const a of modules) {
    if (a.kind !== CabinetKind.ANTRESOL) continue;
    if (!index.has(a.width)) index.set(a.width, []);
    index.get(a.width)!.push(a);
  }
  return index;
}

function solveAntresolForWall(
  wallModules: PlacedModule[],
  antresolByWidth: Map<number, CabinetRead[]>,
  idMap: Map<number, CabinetRead>,
): PlacedModule[] {
  if (antresolByWidth.size === 0) return [];

  const placed: PlacedModule[] = [];

  for (const mod of wallModules) {
    // Antresols go above tall modules (П) and upper modules (ВП)
    if (mod.type !== 'tall' && mod.type !== 'upper') continue;

    // Resolve the original cabinet to get its article
    const cab = idMap.get(mod.cabinetId);
    if (!cab) continue;

    const compatiblePrefixes = getCompatibleAntresolPrefixes(cab.article);
    if (compatiblePrefixes.length === 0) continue;

    // Find an antresol with matching width and compatible article prefix
    const candidates = antresolByWidth.get(mod.width);
    const match = candidates?.find(
      (a) => compatiblePrefixes.some((prefix) => a.article.startsWith(prefix)),
    );
    if (!match) continue;

    // Calculate Y offset based on parent module type
    const yOffset = mod.type === 'upper'
      ? UPPER_Y + mod.height  // upper starts at UPPER_Y
      : mod.height;           // tall starts from floor

    placed.push(cabinetToModule(match, mod.x, mod.wallId, {
      type: 'antresol',
      height: match.height,
      depth: match.depth,
      yOffset,
    }));
  }

  return placed;
}

// ── СБ 200 side panel placement ─────────────────────────────────────────────

/** Side panel width in mm */
const SIDE_PANEL_WIDTH = 200;

/**
 * Place ONE СБ 200 side panel on a wall, next to a dishwasher (ПММ) or
 * cooktop anchor. Makes room by shrinking the nearest filler module.
 * If no filler can absorb the 200mm, the panel is not placed.
 *
 * Priority: dishwasher first, then cooktop.
 */
function placeSidePanels200(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  sidePanelCab: CabinetRead,
  goldenTable: GoldenTable,
  solverModules: CabinetRead[],
  maps: ReturnType<typeof buildModuleMaps>,
): void {
  if (!wallPlan.modules.some((m) => m.type === 'lower')) return;

  // Find the first valid insertion position (only one per wall)
  let insertX: number | null = null;

  // 1. Next to dishwashers (ПММ prefix) — higher priority
  for (const mod of wallPlan.modules) {
    if (mod.type !== 'lower' || !mod.article.startsWith(ARTICLE_PREFIX.DISHWASHER)) continue;
    const modEnd = mod.x + mod.width;
    if (modEnd + SIDE_PANEL_WIDTH <= wallConfig.length) {
      insertX = modEnd;
    } else if (mod.x - SIDE_PANEL_WIDTH >= 0) {
      insertX = mod.x - SIDE_PANEL_WIDTH;
    }
    if (insertX !== null) break;
  }

  // 2. Next to cooktop anchors — only if no dishwasher found
  if (insertX === null) {
    for (const anchor of wallConfig.anchors) {
      if (anchor.type !== 'cooktop') continue;
      const anchorEnd = anchor.position + anchor.width;
      if (anchorEnd + SIDE_PANEL_WIDTH <= wallConfig.length) {
        insertX = anchorEnd;
      } else if (anchor.position - SIDE_PANEL_WIDTH >= 0) {
        insertX = anchor.position - SIDE_PANEL_WIDTH;
      }
      if (insertX !== null) break;
    }
  }

  if (insertX === null) return;

  const finalEnd = insertX + SIDE_PANEL_WIDTH;

  // Shrink (not remove) lower/filler modules that overlap with the side panel zone
  for (const m of wallPlan.modules) {
    if (m.type !== 'lower' && m.type !== 'filler') continue;
    const mEnd = m.x + m.width;
    if (mEnd <= insertX! || m.x >= finalEnd) continue; // no overlap

    if (m.x < insertX! && mEnd > insertX!) {
      // Module starts before zone — trim its right edge
      m.width = insertX! - m.x;
    } else if (m.x >= insertX! && m.x < finalEnd && mEnd > finalEnd) {
      // Module starts inside zone but extends past — shift right
      const cut = finalEnd - m.x;
      m.x = finalEnd;
      m.width -= cut;
    }
    // If module is fully inside zone — will be filtered below
  }

  // Remove any modules fully contained within the zone
  wallPlan.modules = wallPlan.modules.filter((m) => {
    if (m.type !== 'lower' && m.type !== 'filler') return true;
    const mEnd = m.x + m.width;
    return !(m.x >= insertX! && mEnd <= finalEnd);
  });

  // Place the side panel
  const panel = cabinetToModule(sidePanelCab, insertX, wallPlan.wallId, { type: 'lower' });
  panel.width = SIDE_PANEL_WIDTH;
  wallPlan.modules.push(panel);

  // Re-solve zones adjacent to the side panel to fill any gaps
  const resolveZone = (zoneStart: number, zoneEnd: number) => {
    const zoneWidth = zoneEnd - zoneStart;
    if (zoneWidth <= 0) return;

    // Remove existing lower/filler modules in this zone
    wallPlan.modules = wallPlan.modules.filter((m) => {
      if (m.type !== 'lower' && m.type !== 'filler') return true;
      return m.x + m.width <= zoneStart || m.x >= zoneEnd;
    });

    // Re-solve
    const seg: Segment = {
      wallId: wallPlan.wallId,
      start: zoneStart,
      end: zoneEnd,
      width: zoneWidth,
      context: 'standard',
      isTrim: zoneWidth <= MIN_SEGMENT,
    };
    const solutions = solveSegment(seg, goldenTable, solverModules, maps);
    if (solutions.length > 0) {
      wallPlan.modules.push(...solutions[0]);
    }
  };

  // Zone AFTER the side panel: from panel end to next anchor start or wall end
  const nextAnchorStart = wallConfig.anchors
    .filter((a) => a.position >= finalEnd)
    .sort((a, b) => a.position - b.position)[0]?.position ?? wallConfig.length;
  resolveZone(finalEnd, nextAnchorStart);

  // Zone BEFORE the side panel: from previous anchor end (or wall start) to panel start
  const prevAnchorEnd = wallConfig.anchors
    .filter((a) => a.position + a.width <= insertX)
    .sort((a, b) => b.position - a.position)
    .map((a) => a.position + a.width)[0] ?? 0;
  resolveZone(prevAnchorEnd, insertX);
}

// ── Auto СБ 200 in exact sink-cooktop gap ───────────────────────────────────

/**
 * Automatically place an СБ 200 side panel in the gap between sink and cooktop
 * anchors when the gap is exactly 200mm. This runs regardless of the
 * useSidePanel200 flag — it's a structural rule, not a user preference.
 */
function autoPlaceSidePanelInGap(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  sidePanelCab: CabinetRead,
): void {
  const sortedAnchors = [...wallConfig.anchors].sort((a, b) => a.position - b.position);

  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    const left = sortedAnchors[i];
    const right = sortedAnchors[i + 1];
    const leftEnd = left.position + left.width;
    const gap = right.position - leftEnd;

    // Only for exact 200mm gaps between sink and cooktop (either direction)
    const isSinkCooktopPair =
      (left.type === 'sink' && right.type === 'cooktop') ||
      (left.type === 'cooktop' && right.type === 'sink');

    if (!isSinkCooktopPair || gap !== SIDE_PANEL_WIDTH) continue;

    // Check if a side panel is already placed here
    const alreadyPlaced = wallPlan.modules.some(
      (m) =>
        m.article.startsWith(ARTICLE_PREFIX.SIDE_PANEL) &&
        m.x >= leftEnd - 1 &&
        m.x <= leftEnd + 1,
    );
    if (alreadyPlaced) continue;

    // Remove any modules in this gap zone
    wallPlan.modules = wallPlan.modules.filter((m) => {
      if (m.type !== 'lower' && m.type !== 'filler') return true;
      const mEnd = m.x + m.width;
      return mEnd <= leftEnd || m.x >= right.position;
    });

    // Place the side panel
    const panel = cabinetToModule(sidePanelCab, leftEnd, wallPlan.wallId, { type: 'lower' });
    panel.width = SIDE_PANEL_WIDTH;
    wallPlan.modules.push(panel);
  }
}

// ── СМ sink module placement ─────────────────────────────────────────────────

/**
 * Place a sink base module (СМ) at each sink anchor position.
 * Removes any solver-placed lower modules that overlap the sink anchor zone,
 * then inserts the matching СМ module.
 */
function placeSinkModules(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  sinkModuleCab: CabinetRead,
): void {
  for (const anchor of wallConfig.anchors) {
    if (anchor.type !== 'sink') continue;

    const anchorStart = anchor.position;
    const anchorEnd = anchor.position + anchor.width;

    // Remove lower modules that overlap with the sink anchor zone
    wallPlan.modules = wallPlan.modules.filter((m) => {
      if (m.type !== 'lower' && m.type !== 'filler') return true;
      const mEnd = m.x + m.width;
      // Keep if fully outside the anchor zone
      return mEnd <= anchorStart || m.x >= anchorEnd;
    });

    // Place the sink module at the anchor position
    wallPlan.modules.push(cabinetToModule(sinkModuleCab, anchorStart, wallPlan.wallId, { type: 'lower' }));

    // If sink module is narrower than anchor, fill the gap
    const gap = anchor.width - sinkModuleCab.width;
    if (gap > 0) {
      wallPlan.modules.push(
        placeFiller(anchorStart + sinkModuleCab.width, gap, wallPlan.wallId),
      );
    }
  }
}

// ── СЯШ drawer unit placement ────────────────────────────────────────────────

/**
 * Place a drawer unit (СЯШ) right after the sink module on each wall.
 * If a dishwasher (ПММ) is present, places the drawer after the dishwasher instead.
 *
 * Removes any solver-placed lower modules that overlap the drawer zone,
 * then inserts the matching СЯШ module.
 */
function placeDrawerUnit(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  drawerHousingCab: CabinetRead,
): void {
  const dw = drawerHousingCab.width;

  for (const anchor of wallConfig.anchors) {
    if (anchor.type !== 'sink') continue;

    // Find the actual placed sink module (placed by placeSinkModules earlier)
    const sinkModule = wallPlan.modules.find(
      (m) =>
        m.type === 'lower' &&
        m.kind === CabinetKind.SINK &&
        m.subtype === CabinetSubtype.SINK_BASE &&
        m.x >= anchor.position - 1 &&
        m.x <= anchor.position + 1,
    );

    const sinkEnd = sinkModule
      ? sinkModule.x + sinkModule.width
      : anchor.position + anchor.width;

    // Check if there's a dishwasher (ПММ) placed immediately after the sink
    const dishwasher = wallPlan.modules.find(
      (m) =>
        m.type === 'lower' &&
        m.article.startsWith(ARTICLE_PREFIX.DISHWASHER) &&
        Math.abs(m.x - sinkEnd) <= 1,
    );

    const insertX = dishwasher
      ? dishwasher.x + dishwasher.width
      : sinkEnd;

    // Check if drawer zone overlaps with any anchor (cooktop, oven, etc.)
    const overlapsAnchor = wallConfig.anchors.some((a) => {
      if (a === anchor) return false;
      return insertX < a.position + a.width && insertX + dw > a.position;
    });

    if (insertX + dw > wallConfig.length || overlapsAnchor) {
      // Drawer must stay in the sink sequence only.
      // If it does not fit right after the sink/dishwasher chain, skip it.
      continue;
    }

    const finalEnd = insertX + dw;

    // Remove lower modules that overlap with the drawer zone
    wallPlan.modules = wallPlan.modules.filter((m) => {
      if (m.type !== 'lower' && m.type !== 'filler') return true;
      const mEnd = m.x + m.width;
      return mEnd <= insertX || m.x >= finalEnd;
    });

    // Place the drawer unit module
    wallPlan.modules.push(cabinetToModule(drawerHousingCab, insertX, wallPlan.wallId, { type: 'lower' }));
  }
}

/**
 * Place fridge and optional penal at the chosen wall edge.
 * Order: [countertop][fridge][penal] (right) or [penal][fridge][countertop] (left).
 */
function placeTallAppliances(
  wallPlan: WallPlan,
  fridgeCab: CabinetRead,
  penalCab: CabinetRead | null,
  penalReserve: number,
  side: 'left' | 'right',
  wallLength: number,
  cornerOffset?: { startOffset?: number; endOffset?: number },
): void {
  const cornerStart = cornerOffset?.startOffset ?? 0;
  const cornerEnd = cornerOffset?.endOffset ?? 0;

  if (side === 'right') {
    // [countertop] ... [fridge][penal]|wall-end
    const penalX = wallLength - cornerEnd - penalReserve;
    const fridgeX = penalX - fridgeCab.width;
    wallPlan.modules.push(cabinetToModule(fridgeCab, fridgeX, wallPlan.wallId, { type: 'tall' }));
    if (penalCab && penalReserve > 0) {
      wallPlan.modules.push(cabinetToModule(penalCab, penalX, wallPlan.wallId, { type: 'tall' }));
    }
  } else {
    // wall-start|[penal][fridge] ... [countertop]
    const penalX = cornerStart;
    const fridgeX = cornerStart + penalReserve;
    if (penalCab && penalReserve > 0) {
      wallPlan.modules.push(cabinetToModule(penalCab, penalX, wallPlan.wallId, { type: 'tall' }));
    }
    wallPlan.modules.push(cabinetToModule(fridgeCab, fridgeX, wallPlan.wallId, { type: 'tall' }));
  }
}

// ── Public API ──────────────────────────────────────────────────────────────


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

  // Corner cabinet reservation — driven by CornerJunction[] from input
  const cornerCabinets = input.modules.filter((m) => m.is_corner);
  const cornerModules: PlacedModule[] = [];
  const cornerOffsets: Map<string, { startOffset?: number; endOffset?: number }> = new Map();

  for (let ci = 0; ci < input.corners.length; ci++) {
    const junction = input.corners[ci];
    const cornerModule = selectCornerCabinet(cornerCabinets, junction.id, ci);
    if (!cornerModule) continue;

    const occupancy = cornerModule.width || CORNER_WALL_OCCUPANCY;

    // Reserve space on each wall at the correct endpoint
    for (const side of [junction.wallA, junction.wallB] as const) {
      const existing = cornerOffsets.get(side.wallId) ?? {};
      if (side.end === 'end') {
        existing.endOffset = (existing.endOffset ?? 0) + occupancy;
      } else {
        existing.startOffset = (existing.startOffset ?? 0) + occupancy;
      }
      cornerOffsets.set(side.wallId, existing);
    }

    cornerModules.push(cornerModule);
  }

  // Pre-find СБ 200 cabinet (always — needed for auto-placement in 200mm gap)
  const sidePanelCab = input.modules.find(
    (m) => m.article.startsWith(ARTICLE_PREFIX.SIDE_PANEL) && m.width === SIDE_PANEL_WIDTH,
  ) ?? null;

  // Helper predicates for kind-based identification
  const isSinkModule = (m: CabinetRead) =>
    m.kind === CabinetKind.SINK && m.subtype === CabinetSubtype.SINK_BASE;
  const isDrawerUnit = (m: CabinetRead) =>
    m.kind === CabinetKind.DRAWER_UNIT;

  // Filter out special modules from general solver input —
  // СБ side panels via placeSidePanels200(), СМ sink modules via placeSinkModules(),
  // СЯШ drawer units via placeDrawerUnit().
  // Also exclude modules with width ≤ 200mm (side panel width) to avoid tiny gap fillers.
  const solverModules = input.modules.filter(
    (m) =>
      m.width > SIDE_PANEL_WIDTH &&
      !m.is_corner &&
      !(m.article.startsWith(ARTICLE_PREFIX.SIDE_PANEL) && m.width === SIDE_PANEL_WIDTH) &&
      !isSinkModule(m) &&
      !isDrawerUnit(m) &&
      m.kind !== CabinetKind.PLATE &&
      m.kind !== CabinetKind.FRIDGE &&
      m.kind !== CabinetKind.PENAL,
  );

  // Pre-find СМ sink module matching requested width (by kind: SINK/SINK_BASE)
  const sinkModuleCab = input.modules.find(
    (m) => isSinkModule(m) && m.width === input.sinkModuleWidth,
  ) ?? null;

  // Pre-find СЯШ drawer unit matching requested width (by kind: DRAWER_UNIT)
  const drawerUnitCab = input.modules.find(
    (m) => isDrawerUnit(m) && m.width === input.drawerHousingWidth,
  ) ?? null;

  // Pre-find fridge cabinet (by kind: FRIDGE) — auto-placed at wall edge
  const fridgeCab = input.modules.find(
    (m) => m.kind === CabinetKind.FRIDGE,
  ) ?? null;

  // Pre-find penal cabinet (by kind: PENAL) — placed next to fridge when wall > 3000mm
  const penalCab = input.modules.find(
    (m) => m.kind === CabinetKind.PENAL,
  ) ?? null;

  const lastWallId = input.walls.length > 0 ? input.walls[input.walls.length - 1].id : null;

  // Pre-build antresol index once (avoids rebuilding per variant)
  const antresolByWidth = input.floorToCeiling
    ? buildAntresolIndex(input.modules)
    : new Map<number, CabinetRead[]>();

  // Solve each wall independently
  const wallVariantSets: WallPlan[][] = [];

  for (const wallConfig of input.walls) {
    const offset = cornerOffsets.get(wallConfig.id);

    // Reserve space for fridge + penal at the chosen edge of the last wall.
    // Countertop max = MAX_COUNTERTOP (3000mm). Extra space → fridge + penal.
    let fridgeReserve = 0;
    let penalReserve = 0;
    if (fridgeCab && wallConfig.id === lastWallId) {
      const cornerStart = offset?.startOffset ?? 0;
      const cornerEnd = offset?.endOffset ?? 0;
      const effectiveLength = wallConfig.length - cornerStart - cornerEnd;
      const tallZone = Math.max(0, effectiveLength - MAX_COUNTERTOP);

      fridgeReserve = fridgeCab.width;
      if (tallZone >= fridgeCab.width + (penalCab?.width ?? 0) && penalCab) {
        penalReserve = penalCab.width;
      }
    }
    const totalTallReserve = fridgeReserve + penalReserve;

    // Anchor positions are absolute wall coordinates (auto-snapped outside fridge zone).
    // No shift needed — the segOffset handles the reserved zone.
    const effectiveWallConfig = wallConfig;
    const segOffset = totalTallReserve > 0
      ? input.fridgeSide === 'left'
        ? { startOffset: (offset?.startOffset ?? 0) + totalTallReserve, endOffset: offset?.endOffset }
        : { startOffset: offset?.startOffset, endOffset: (offset?.endOffset ?? 0) + totalTallReserve }
      : offset;
    const segments = segmentWall(effectiveWallConfig, segOffset);

    // Solve lower cabinets
    const segmentSolutions: PlacedModule[][][] = segments.map((seg) =>
      solveSegment(seg, goldenTable, solverModules, maps),
    );

    const wallVariants = generateWallVariants(effectiveWallConfig, segmentSolutions);

    // ── Lower post-processing (modifies lower module positions) ──

    // Place СБ 200 side panels next to dishwashers and cooktop (only if flag is on)
    if (input.useSidePanel200 && sidePanelCab) {
      for (const variant of wallVariants) {
        placeSidePanels200(variant, effectiveWallConfig, sidePanelCab, goldenTable, solverModules, maps);
      }
    }

    // Place СМ sink modules at sink anchor positions
    if (sinkModuleCab) {
      for (const variant of wallVariants) {
        placeSinkModules(variant, effectiveWallConfig, sinkModuleCab);
      }
    }

    // Auto-place СБ 200 in exact 200mm sink-cooktop gap (only when flag is on)
    if (input.useSidePanel200 && sidePanelCab) {
      for (const variant of wallVariants) {
        autoPlaceSidePanelInGap(variant, effectiveWallConfig, sidePanelCab);
      }
    }

    // Place СЯШ drawer unit after sink (or after dishwasher if present)
    if (drawerUnitCab) {
      for (const variant of wallVariants) {
        placeDrawerUnit(variant, effectiveWallConfig, drawerUnitCab);
      }
    }

    // Place fridge at the chosen edge of the last wall
    if (fridgeCab && wallConfig.id === lastWallId) {
      for (const variant of wallVariants) {
        placeTallAppliances(variant, fridgeCab, penalCab, penalReserve, input.fridgeSide, wallConfig.length, offset);
      }
    }

    // ── Solve uppers aligned to finalized lower positions ──
    const expanded: WallPlan[] = [];
    for (const variant of wallVariants) {
      const upperSolutions = solveUppersAlignedToLowers(
        variant, effectiveWallConfig, solverModules, maps.byId, offset, input.useHood,
      );
      for (const upperMods of upperSolutions) {
        expanded.push({
          wallId: variant.wallId,
          modules: [...variant.modules, ...upperMods],
        });
        if (expanded.length >= 20) break;
      }
      if (expanded.length >= 20) break;
    }
    wallVariants.length = 0;
    wallVariants.push(...expanded);

    // Solve antresol placement (floor-to-ceiling mode) — after uppers are placed
    if (input.floorToCeiling) {
      for (const variant of wallVariants) {
        const antresolModules = solveAntresolForWall(
          variant.modules,
          antresolByWidth,
          maps.byId,
        );
        variant.modules.push(...antresolModules);
      }
    }

    // Sort modules by X position so rendering order matches spatial order
    for (const variant of wallVariants) {
      variant.modules.sort((a, b) => a.x - b.x);
    }

    wallVariantSets.push(wallVariants);
  }

  // Combine wall variants into full kitchen plans (capped cartesian product)
  const kitchenCombos = cappedCartesian(wallVariantSets, MAX_VARIANTS * 3);

  // Build scoring context from planner input
  const scoringContext: ScoringContext = {
    roomWidth: input.roomWidth,
    roomDepth: input.roomDepth,
    wallHeight: input.wallHeight,
    layoutType: input.layoutType,
    anchors: input.walls.flatMap((w) =>
      w.anchors.map((a) => ({
        wallId: w.id,
        type: a.type,
        position: a.position,
        width: a.width,
      })),
    ),
  };

  // Score and rank
  const scoredPlans: KitchenPlan[] = kitchenCombos.map((walls) => {
    const plan: KitchenPlan = {
      walls,
      cornerModules,
      score: 0,
      scoreBreakdown: { ...EMPTY_SCORE_BREAKDOWN },
    };

    const result = scorePlan(plan, scoringContext);
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
