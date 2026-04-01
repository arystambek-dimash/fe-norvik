import type { CabinetRead } from '@/types/entities';
import { CabinetKind, CabinetSubtype, CabinetType } from '@/types/enums';
import type {
  Anchor,
  AnchorShift,
  CornerJunction,
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
  PREP_ZONE_MIN,
  PREP_ZONE_MAX,
  PREP_ZONE_TOLERANCE,
  CONTINUOUS_COUNTERTOP_MIN,
  CONTINUOUS_COUNTERTOP_MAX,
  CONTINUOUS_COUNTERTOP_TOLERANCE,
  SIDE_PANEL_WIDTH,
} from './constants';
import { segmentWall, segmentWallForUppers } from './segmenter';
import { GoldenTable } from './golden-table';
import { solve } from './solver';
import { scorePlan, smoothScore, EMPTY_SCORE_BREAKDOWN } from './scoring';
import type { ScoringContext } from './scoring/types';

// ── Constants ────────────────────────────────────────────────────────────────

export const MAX_VARIANTS = 10;
export const MAX_UPPER_SOLUTIONS = 5;

// ── Module counter ───────────────────────────────────────────────────────────

/** Generate a unique ID for a placed module. */
let moduleCounter = 0;
export function nextModuleId(): string {
  return `mod-${++moduleCounter}`;
}

/** Reset the module counter (useful for testing). */
export function resetModuleCounter(): void {
  moduleCounter = 0;
}

// ── Low-level helpers ────────────────────────────────────────────────────────

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
export function resolveArticles(
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
export function placeCabinets(
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
export function placeFiller(
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
export function mapCabinetType(
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
export function cabinetToModule(
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

// ── Segment solving ──────────────────────────────────────────────────────────

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

// ── Upper cabinet solving ────────────────────────────────────────────────────

/**
 * Solve upper cabinet placement for a wall.
 * When useHood is true, skips the cooktop zone (leaves space for hood).
 * When useHood is false, fills the full wall with uppers (no cooktop gap).
 */
export function solveUpperForWall(
  wallConfig: WallConfig,
  availableModules: CabinetRead[],
  idMap: Map<number, CabinetRead>,
  cornerOffset?: { startOffset?: number; endOffset?: number },
  useHood?: boolean,
): PlacedModule[][] {
  const allUppers = availableModules.filter(
    (m) => m.type === CabinetType.UPPER && m.kind === CabinetKind.DOOR && m.width >= SIDE_PANEL_WIDTH,
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
export function solveUppersAlignedToLowers(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  availableModules: CabinetRead[],
  idMap: Map<number, CabinetRead>,
  cornerOffset?: { startOffset?: number; endOffset?: number },
  useHood?: boolean,
): PlacedModule[][] {
  // ── 1. Filter & group upper modules by height ──
  const allUppers = availableModules.filter(
    (m) => m.type === CabinetType.UPPER && m.kind === CabinetKind.DOOR && m.width >= SIDE_PANEL_WIDTH,
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

  // Anchors (sink, cooktop) — skip cooktop when hood is enabled
  for (const anchor of wallConfig.anchors) {
    if (anchor.isVirtual) continue;
    if (useHood && anchor.type === 'cooktop') continue;
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

// ── Candidate conversion ─────────────────────────────────────────────────────

/**
 * Convert a SolverCandidate into PlacedModules by resolving cabinet IDs.
 */
export function candidateToPlacedModules(
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

// ── Wall variant generation ──────────────────────────────────────────────────

/**
 * Generate wall plan variants by combining segment solutions.
 * Uses a capped cartesian product to avoid exponential blowup.
 */
export function generateWallVariants(
  wallConfig: WallConfig,
  segmentSolutions: PlacedModule[][][],
): WallPlan[] {
  const combos = cappedCartesian(segmentSolutions, 20);

  return combos.map((segments) => ({
    wallId: wallConfig.id,
    modules: segments.flat(),
    anchors: wallConfig.anchors.map((anchor) => ({ ...anchor })),
  }));
}

// ── Corner cabinet selection ─────────────────────────────────────────────────

/**
 * Select a corner cabinet for a given wall junction.
 * @param cornerCabinets Pre-filtered list of `is_corner` cabinets from the catalog.
 * @param junctionId     The CornerJunction.id to tag the placed module with.
 * @param index          Which corner cabinet to pick (for multi-corner layouts).
 */
export function selectCornerCabinet(
  cornerCabinets: CabinetRead[],
  junctionId: string,
  options?: {
    cabinetId?: number | null;
    index?: number;
    yOffset?: number;
  },
): PlacedModule | null {
  if (cornerCabinets.length === 0) return null;

  const selectedById = options?.cabinetId != null
    ? cornerCabinets.find((cabinet) => cabinet.id === options.cabinetId)
    : null;
  const fallbackIndex = options?.index ?? 0;
  const cab = selectedById ?? cornerCabinets[fallbackIndex % cornerCabinets.length];
  const mod = cabinetToModule(cab, 0, junctionId, {
    type: 'corner',
    height: cab.height || (cab.type === CabinetType.UPPER ? UPPER_HEIGHT : LOWER_HEIGHT),
    depth: cab.depth || (cab.type === CabinetType.UPPER ? UPPER_DEPTH : CORNER_CABINET_DEPTH),
    rotation: 0,
    yOffset: options?.yOffset,
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
export function getCompatibleAntresolPrefixes(lowerArticle: string): string[] {
  // ANTRESOL_RULES is pre-sorted by descending prefix length in constants.ts
  for (const rule of ANTRESOL_RULES) {
    if (lowerArticle.startsWith(rule.lowerPrefix)) {
      return rule.antresolPrefixes;
    }
  }
  return [];
}

/** Build a width→cabinets index for antresol lookup. */
export function buildAntresolIndex(modules: CabinetRead[]): Map<number, CabinetRead[]> {
  const index = new Map<number, CabinetRead[]>();
  for (const a of modules) {
    if (a.kind !== CabinetKind.ANTRESOL && a.kind !== CabinetKind.ANTRESOL_FRIDGE) continue;
    if (!index.has(a.width)) index.set(a.width, []);
    index.get(a.width)!.push(a);
  }
  return index;
}

export function solveAntresolForWall(
  wallModules: PlacedModule[],
  antresolByWidth: Map<number, CabinetRead[]>,
  idMap: Map<number, CabinetRead>,
): PlacedModule[] {
  if (antresolByWidth.size === 0) return [];

  // Find the actual top of upper cabinets on this wall to align fridge/penal antresols
  const upperTop = wallModules
    .filter((m) => m.type === 'upper')
    .reduce((max, m) => Math.max(max, UPPER_Y + m.height), UPPER_Y + UPPER_HEIGHT);

  const placed: PlacedModule[] = [];

  for (const mod of wallModules) {
    // Antresols go above tall modules (П) and upper modules (ВП)
    if (mod.type !== 'tall' && mod.type !== 'upper') continue;

    // Resolve the original cabinet to get its article/kind
    const cab = idMap.get(mod.cabinetId);
    if (!cab) continue;

    let match: CabinetRead | undefined;

    // For fridge/penal: match antresol by kind (ANTRESOL_FRIDGE) and width
    if (cab.kind === CabinetKind.FRIDGE || cab.kind === CabinetKind.PENAL || cab.kind === CabinetKind.PENAL_APPLIANCE_HOUSING) {
      const candidates = antresolByWidth.get(mod.width);
      match = candidates?.find((a) => a.kind === CabinetKind.ANTRESOL_FRIDGE);
    } else {
      // For other modules: match by article prefix (existing logic)
      const compatiblePrefixes = getCompatibleAntresolPrefixes(cab.article);
      if (compatiblePrefixes.length === 0) continue;
      const candidates = antresolByWidth.get(mod.width);
      match = candidates?.find(
        (a) => compatiblePrefixes.some((prefix) => a.article.startsWith(prefix)),
      );
    }

    if (!match) continue;

    // Calculate Y offset — fridge/penal antresols align with upper antresols
    const isFridgeOrPenal = cab.kind === CabinetKind.FRIDGE
      || cab.kind === CabinetKind.PENAL
      || cab.kind === CabinetKind.PENAL_APPLIANCE_HOUSING;
    const yOffset = mod.type === 'upper'
      ? UPPER_Y + mod.height       // upper starts at UPPER_Y
      : isFridgeOrPenal
        ? upperTop                  // fridge/penal: align with actual upper tops
        : mod.height;               // other tall: from their own height

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

/**
 * Place ONE СБ 200 side panel on a wall, next to a dishwasher (ПММ) or
 * cooktop anchor. Makes room by shrinking the nearest filler module.
 * If no filler can absorb the 200mm, the panel is not placed.
 *
 * Priority: dishwasher first, then cooktop.
 */
export function placeSidePanels200(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  sidePanelCab: CabinetRead,
  goldenTable: GoldenTable,
  solverModules: CabinetRead[],
  maps: ReturnType<typeof buildModuleMaps>,
): void {
  if (!wallPlan.modules.some((m) => m.type === 'lower')) return;

  interface Candidate {
    insertX: number;
    score: number;
  }

  const overlapsOtherAnchors = (start: number) =>
    wallConfig.anchors.some((anchor) => start < anchor.position + anchor.width && start + SIDE_PANEL_WIDTH > anchor.position);

  const scoreCandidate = (insertX: number) => {
    const finalEnd = insertX + SIDE_PANEL_WIDTH;
    let fillerOverlap = 0;
    let lowerOverlap = 0;
    let exactFillerMatch = false;

    for (const mod of wallPlan.modules) {
      if (mod.type !== 'lower' && mod.type !== 'filler') continue;
      const overlap = Math.min(finalEnd, mod.x + mod.width) - Math.max(insertX, mod.x);
      if (overlap <= 0) continue;

      if (mod.type === 'filler') {
        fillerOverlap += overlap;
        if (mod.x === insertX && mod.width === SIDE_PANEL_WIDTH) {
          exactFillerMatch = true;
        }
      } else {
        lowerOverlap += overlap;
      }
    }

    return (exactFillerMatch ? 1000 : 0) + fillerOverlap * 10 - lowerOverlap * 5;
  };

  const collectCandidate = (insertX: number | null, out: Candidate[]) => {
    if (insertX == null) return;
    if (insertX < 0 || insertX + SIDE_PANEL_WIDTH > wallConfig.length) return;
    if (overlapsOtherAnchors(insertX)) return;
    out.push({ insertX, score: scoreCandidate(insertX) });
  };

  let candidates: Candidate[] = [];

  // 1. Next to dishwashers (ПММ prefix) — higher priority
  for (const mod of wallPlan.modules) {
    if (mod.type !== 'lower' || !mod.article.startsWith(ARTICLE_PREFIX.DISHWASHER)) continue;
    collectCandidate(mod.x + mod.width, candidates);
    collectCandidate(mod.x - SIDE_PANEL_WIDTH, candidates);
    if (candidates.length > 0) break;
  }

  // 2. Next to cooktop anchors — only if no dishwasher candidates found
  if (candidates.length === 0) {
    for (const anchor of wallConfig.anchors) {
      if (anchor.type !== 'cooktop') continue;
      collectCandidate(anchor.position + anchor.width, candidates);
      collectCandidate(anchor.position - SIDE_PANEL_WIDTH, candidates);
    }
  }

  const insertX = candidates
    .sort((a, b) => b.score - a.score || a.insertX - b.insertX)[0]?.insertX ?? null;

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
export function autoPlaceSidePanelInGap(
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
export function placeSinkModules(
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

// ── ПМ plate module placement (cooktop anchor) ──────────────────────────────

/**
 * Place a plate module (ПМ) at each cooktop anchor position.
 * Mirrors placeSinkModules(): removes overlapping lower modules, inserts the
 * matching ПМ module, and fills any remaining gap with a filler.
 */
export function placePlateModules(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  plateCab: CabinetRead,
): void {
  for (const anchor of wallConfig.anchors) {
    if (anchor.type !== 'cooktop') continue;

    const anchorStart = anchor.position;
    const anchorEnd = anchor.position + anchor.width;

    // Remove lower modules that overlap with the cooktop anchor zone
    wallPlan.modules = wallPlan.modules.filter((m) => {
      if (m.type !== 'lower' && m.type !== 'filler') return true;
      const mEnd = m.x + m.width;
      return mEnd <= anchorStart || m.x >= anchorEnd;
    });

    // Place the plate module at the anchor position
    wallPlan.modules.push(cabinetToModule(plateCab, anchorStart, wallPlan.wallId, { type: 'lower' }));

    // If plate module is narrower than anchor, fill the gap
    const gap = anchor.width - plateCab.width;
    if (gap > 0) {
      wallPlan.modules.push(
        placeFiller(anchorStart + plateCab.width, gap, wallPlan.wallId),
      );
    }
  }
}

// ── СЯШ drawer unit placement ────────────────────────────────────────────────

/**
 * Place a dishwasher (ПММ) immediately after the sink when the full
 * sink→dishwasher→drawer chain fits on the wall.
 */
export function placeDishwasherAdjacentToSink(
  wallPlan: WallPlan,
  wallConfig: WallConfig,
  dishwasherCab: CabinetRead,
  drawerHousingCab: CabinetRead | null,
): void {
  if (!drawerHousingCab) return;
  const drawerWidth = drawerHousingCab.width;

  for (const anchor of wallConfig.anchors) {
    if (anchor.type !== 'sink') continue;

    const plan = planSinkAdjacency(wallConfig, anchor, drawerWidth, dishwasherCab.width);
    if (plan.dishwasherX == null) continue;

    const insertX = plan.dishwasherX;
    const finalEnd = insertX + dishwasherCab.width;

    wallPlan.modules = wallPlan.modules.filter((m) => {
      if (m.type !== 'lower' && m.type !== 'filler') return true;
      const mEnd = m.x + m.width;
      return mEnd <= insertX || m.x >= finalEnd;
    });

    wallPlan.modules.push(cabinetToModule(dishwasherCab, insertX, wallPlan.wallId, { type: 'lower' }));
  }
}

/**
 * Place a drawer unit (СЯШ) right after the sink module on each wall.
 * If a dishwasher (ПММ) is present, places the drawer after the dishwasher instead.
 *
 * Removes any solver-placed lower modules that overlap the drawer zone,
 * then inserts the matching СЯШ module.
 */
export function placeDrawerUnit(
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

    const insertXAfter = dishwasher
      ? dishwasher.x + dishwasher.width
      : sinkEnd;

    // Try placing after sink first, then before sink if it doesn't fit
    const overlapsAnchorAfter = wallConfig.anchors.some((a) => {
      if (a === anchor) return false;
      return insertXAfter < a.position + a.width && insertXAfter + dw > a.position;
    });

    const fitsAfter = insertXAfter + dw <= wallConfig.length && !overlapsAnchorAfter;

    // Try placing before sink (if after doesn't fit)
    const sinkStart = sinkModule ? sinkModule.x : anchor.position;
    const insertXBefore = sinkStart - dw;
    const overlapsAnchorBefore = wallConfig.anchors.some((a) => {
      if (a === anchor) return false;
      return insertXBefore < a.position + a.width && insertXBefore + dw > a.position;
    });
    const fitsBefore = insertXBefore >= 0 && !overlapsAnchorBefore;

    const insertX = fitsAfter ? insertXAfter : fitsBefore ? insertXBefore : -1;
    if (insertX < 0) continue;

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

// ── Tall appliance placement ─────────────────────────────────────────────────

/**
 * Place fridge and optional penal at the chosen wall edge.
 * Order: [countertop][fridge][penal] (right) or [penal][fridge][countertop] (left).
 */
export function placeTallAppliances(
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

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Capped cartesian product: combine arrays from each set,
 * stopping once `maxSize` combinations are reached.
 */
export function cappedCartesian<T>(sets: T[][], maxSize: number): T[][] {
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

// ── Higher-level helpers ─────────────────────────────────────────────────────

export interface PlannerContext {
  goldenTable: GoldenTable;
  maps: ReturnType<typeof buildModuleMaps>;
  solverModules: CabinetRead[];
  sidePanelCab: CabinetRead | null;
  dishwasherCab: CabinetRead | null;
  sinkModuleCab: CabinetRead | null;
  drawerUnitCab: CabinetRead | null;
  plateCab: CabinetRead | null;
  fridgeCab: CabinetRead | null;
  penalCab: CabinetRead | null;
  antresolByWidth: Map<number, CabinetRead[]>;
}

export function preparePlannerContext(input: PlannerInput): PlannerContext {
  const goldenTable = new GoldenTable(
    input.goldenRules.length > 0 ? input.goldenRules : undefined,
  );
  const maps = buildModuleMaps(input.modules);

  const sidePanelCab = input.modules.find(
    (m) => m.article.startsWith(ARTICLE_PREFIX.SIDE_PANEL) && m.width === SIDE_PANEL_WIDTH,
  ) ?? null;
  const dishwasherCab = input.modules.find(
    (m) => m.article.startsWith(ARTICLE_PREFIX.DISHWASHER) && m.type === CabinetType.LOWER,
  ) ?? null;

  const isSinkModule = (m: CabinetRead) =>
    m.kind === CabinetKind.SINK && m.subtype === CabinetSubtype.SINK_BASE;
  const isDrawerUnit = (m: CabinetRead) =>
    m.kind === CabinetKind.DRAWER_UNIT;

  const solverModules = input.modules.filter(
    (m) =>
      m.width > SIDE_PANEL_WIDTH &&
      !m.is_corner &&
      !(m.article.startsWith(ARTICLE_PREFIX.SIDE_PANEL) && m.width === SIDE_PANEL_WIDTH) &&
      !m.article.startsWith(ARTICLE_PREFIX.DISHWASHER) &&
      !isSinkModule(m) &&
      !isDrawerUnit(m) &&
      m.kind !== CabinetKind.PLATE &&
      m.kind !== CabinetKind.FRIDGE &&
      m.kind !== CabinetKind.PENAL,
  );

  const sinkModuleCab = input.modules.find(
    (m) => isSinkModule(m) && m.width === input.sinkModuleWidth,
  ) ?? null;

  const drawerUnitCab = input.modules.find(
    (m) => isDrawerUnit(m) && m.width === input.drawerHousingWidth,
  ) ?? null;

  const plateCab = (() => {
    if (!input.useInbuiltStove && input.selectedStoveId != null) {
      return input.modules.find(
        (m) => m.kind === CabinetKind.PLATE && m.id === input.selectedStoveId,
      ) ?? null;
    }
    return input.modules.find(
      (m) => m.kind === CabinetKind.PLATE && m.inbuilt === input.useInbuiltStove,
    ) ?? null;
  })();

  const fridgeCab = input.modules.find(
    (m) => m.kind === CabinetKind.FRIDGE,
  ) ?? null;

  const penalCab = input.modules.find(
    (m) => m.kind === CabinetKind.PENAL,
  ) ?? null;

  const antresolByWidth = input.floorToCeiling
    ? buildAntresolIndex(input.modules)
    : new Map<number, CabinetRead[]>();

  return {
    goldenTable, maps, solverModules,
    sidePanelCab, dishwasherCab, sinkModuleCab, drawerUnitCab, plateCab, fridgeCab, penalCab,
    antresolByWidth,
  };
}

export interface TallConfig {
  fridgeCab: CabinetRead | null;
  penalCab: CabinetRead | null;
  fridgeSide: 'left' | 'right';
  startOffset?: number;
  endOffset?: number;
}

function mergeWallOffsets(
  primary?: { startOffset?: number; endOffset?: number },
  secondary?: { startOffset?: number; endOffset?: number },
): { startOffset?: number; endOffset?: number } | undefined {
  const startOffset = (primary?.startOffset ?? 0) + (secondary?.startOffset ?? 0);
  const endOffset = (primary?.endOffset ?? 0) + (secondary?.endOffset ?? 0);

  if (startOffset === 0 && endOffset === 0) {
    return undefined;
  }

  return { startOffset, endOffset };
}

// ── Anchor shift helpers ─────────────────────────────────────────────────────

const MAX_ANCHOR_SHIFT = 100; // max mm to shift a single anchor
const MAX_SHIFT_CONFIGS = 16;
const MAX_SHIFT_COMBINATIONS = 256;
const MAX_SHIFTED_PIPELINE_VARIANTS = 3;

interface ShiftedWallConfig {
  wallConfig: WallConfig;
  shifts: AnchorShift[];
}

interface AnchorPositionOption {
  position: number;
  delta: number;
}

function getAnchorEdgeGap(a: Anchor, b: Anchor): number | null {
  if (a === b) return 0;
  const aEnd = a.position + a.width;
  const bEnd = b.position + b.width;
  const gap = Math.max(b.position - aEnd, a.position - bEnd);
  return gap >= 0 ? gap : null;
}

function scoreAnchorConfiguration(
  original: WallConfig,
  effectiveStart: number,
  effectiveEnd: number,
  drawerWidth: number,
): number {
  const segments = segmentWall(original, {
    startOffset: effectiveStart,
    endOffset: original.length - effectiveEnd,
  });

  let score = 0;
  let longestSegment = 0;

  for (const segment of segments) {
    longestSegment = Math.max(longestSegment, segment.width);

    if (segment.width > 0 && segment.width <= MIN_SEGMENT) {
      score -= 350;
      continue;
    }

    const remainder = ((segment.width % MODULE_GRID) + MODULE_GRID) % MODULE_GRID;
    if (remainder !== 0) {
      score -= Math.min(remainder, MODULE_GRID - remainder) * 8;
    }

    if (segment.width > MIN_SEGMENT && segment.width < 300) {
      score -= 60;
    }
  }

  const sinkCooktopPairs: Array<readonly [Anchor, Anchor]> = [];
  for (let i = 0; i < original.anchors.length; i++) {
    const anchor = original.anchors[i];
    if (anchor.type !== 'sink' && anchor.type !== 'cooktop') continue;

    for (let j = i + 1; j < original.anchors.length; j++) {
      const other = original.anchors[j];
      if (other.type !== 'sink' && other.type !== 'cooktop') continue;
      if (other.type === anchor.type) continue;
      sinkCooktopPairs.push([anchor, other] as const);
    }
  }

  for (const [anchor, other] of sinkCooktopPairs) {
    const gap = getAnchorEdgeGap(anchor, other);
    if (gap == null) continue;

    if (gap < drawerWidth) {
      score -= 600;
    }

    score += smoothScore(gap, PREP_ZONE_MIN, PREP_ZONE_MAX, PREP_ZONE_TOLERANCE) * 220;
  }

  score += smoothScore(
    longestSegment,
    CONTINUOUS_COUNTERTOP_MIN,
    CONTINUOUS_COUNTERTOP_MAX,
    CONTINUOUS_COUNTERTOP_TOLERANCE,
  ) * 160;

  return score;
}

function collectAnchorPositionOptions(
  original: WallConfig,
  idx: number,
  effectiveStart: number,
  effectiveEnd: number,
  drawerWidth: number,
): AnchorPositionOption[] {
  const anchor = original.anchors[idx];
  const options = new Map<number, AnchorPositionOption>();
  const sortedAnchors = original.anchors
    .map((item, originalIdx) => ({ item, originalIdx }))
    .sort((a, b) => a.item.position - b.item.position);
  const sortedIndex = sortedAnchors.findIndex((entry) => entry.originalIdx === idx);
  const prevEnd = sortedIndex > 0
    ? sortedAnchors[sortedIndex - 1].item.position + sortedAnchors[sortedIndex - 1].item.width
    : effectiveStart;
  const nextStart = sortedIndex < sortedAnchors.length - 1
    ? sortedAnchors[sortedIndex + 1].item.position
    : effectiveEnd;
  const beforeSegment = anchor.position - prevEnd;
  const afterSegment = nextStart - (anchor.position + anchor.width);
  const beforeRemainder = ((beforeSegment % MODULE_GRID) + MODULE_GRID) % MODULE_GRID;
  const afterRemainder = ((afterSegment % MODULE_GRID) + MODULE_GRID) % MODULE_GRID;
  const oppositeAnchors = original.anchors.filter(
    (other) =>
      other !== anchor &&
      (other.type === 'sink' || other.type === 'cooktop') &&
      other.type !== anchor.type,
  );
  const hasStructuralSidePanelPair = oppositeAnchors.some(
    (other) => getAnchorEdgeGap(anchor, other) === SIDE_PANEL_WIDTH,
  );
  const hasOffGridNeighbour = (
    (beforeSegment > MIN_SEGMENT && beforeRemainder !== 0) ||
    (afterSegment > MIN_SEGMENT && afterRemainder !== 0)
  );

  if ((oppositeAnchors.length === 0 && !hasOffGridNeighbour) || (hasStructuralSidePanelPair && !hasOffGridNeighbour)) {
    return [{ position: anchor.position, delta: 0 }];
  }

  const addPosition = (position: number) => {
    const delta = position - anchor.position;
    if (Math.abs(delta) > MAX_ANCHOR_SHIFT) return;
    if (position < effectiveStart || position + anchor.width > effectiveEnd) return;

    const existing = options.get(position);
    if (!existing || Math.abs(delta) < Math.abs(existing.delta)) {
      options.set(position, { position, delta });
    }
  };

  addPosition(anchor.position);

  for (const delta of [-100, -50, 50, 100]) {
    addPosition(anchor.position + delta);
  }

  addPosition(Math.floor(anchor.position / MODULE_GRID) * MODULE_GRID);
  addPosition(Math.ceil(anchor.position / MODULE_GRID) * MODULE_GRID);

  const addGridAlignedDeltas = (
    segmentWidth: number,
    side: 'before' | 'after',
  ) => {
    if (segmentWidth <= MIN_SEGMENT) return;
    const remainder = ((segmentWidth % MODULE_GRID) + MODULE_GRID) % MODULE_GRID;
    if (remainder === 0) return;

    if (side === 'before') {
      addPosition(anchor.position - remainder);
      addPosition(anchor.position + (MODULE_GRID - remainder));
      return;
    }

    addPosition(anchor.position + remainder);
    addPosition(anchor.position - (MODULE_GRID - remainder));
  };

  addGridAlignedDeltas(beforeSegment, 'before');
  addGridAlignedDeltas(afterSegment, 'after');

  if (anchor.type === 'sink' || anchor.type === 'cooktop') {
    const targetPrepGap = Math.max(drawerWidth, PREP_ZONE_MIN);
    const secondaryPrepGap = Math.min(PREP_ZONE_MAX, targetPrepGap + 200);

    for (const other of oppositeAnchors) {
      const currentGap = getAnchorEdgeGap(anchor, other);
      if (currentGap === SIDE_PANEL_WIDTH) continue;
      if (currentGap != null && currentGap >= PREP_ZONE_MIN && currentGap <= PREP_ZONE_MAX && currentGap % MODULE_GRID === 0) {
        continue;
      }

      if (anchor.position < other.position) {
        addPosition(other.position - anchor.width - targetPrepGap);
        addPosition(other.position - anchor.width - secondaryPrepGap);
      } else {
        addPosition(other.position + other.width + targetPrepGap);
        addPosition(other.position + other.width + secondaryPrepGap);
      }
    }
  }

  return [...options.values()].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
}

function isValidAnchorLayout(
  wallConfig: WallConfig,
  effectiveStart: number,
  effectiveEnd: number,
  drawerWidth: number,
): boolean {
  for (const anchor of wallConfig.anchors) {
    if (anchor.position < effectiveStart || anchor.position + anchor.width > effectiveEnd) {
      return false;
    }
  }

  const sortedAnchors = [...wallConfig.anchors].sort((a, b) => a.position - b.position);
  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    if (sortedAnchors[i].position + sortedAnchors[i].width > sortedAnchors[i + 1].position) {
      return false;
    }
  }

  const segments = segmentWall(wallConfig, {
    startOffset: effectiveStart,
    endOffset: wallConfig.length - effectiveEnd,
  });
  if (segments.some((segment) => segment.width > 0 && segment.isTrim)) {
    return false;
  }

  for (let i = 0; i < sortedAnchors.length; i++) {
    for (let j = i + 1; j < sortedAnchors.length; j++) {
      const left = sortedAnchors[i];
      const right = sortedAnchors[j];
      if (left.type !== 'sink' && left.type !== 'cooktop') continue;
      if (right.type !== 'sink' && right.type !== 'cooktop') continue;
      if (left.type === right.type) continue;

      const gap = getAnchorEdgeGap(left, right);
      if (gap == null) continue;
      if (gap < drawerWidth && gap !== SIDE_PANEL_WIDTH) {
        return false;
      }
    }
  }

  return true;
}

function generateShiftedWallConfigs(
  original: WallConfig,
  effectiveStart: number,
  effectiveEnd: number,
  drawerWidth: number,
): ShiftedWallConfig[] {
  const optionSets = original.anchors.map((anchor, idx) => {
    if (anchor.type !== 'sink' && anchor.type !== 'cooktop') {
      return [{ position: anchor.position, delta: 0 }];
    }
    return collectAnchorPositionOptions(original, idx, effectiveStart, effectiveEnd, drawerWidth);
  });

  const candidates = cappedCartesian(optionSets, MAX_SHIFT_COMBINATIONS)
    .map((combo) => {
      const anchors = original.anchors.map((anchor, idx) => ({
        ...anchor,
        position: combo[idx].position,
      }));
      const wallConfig = { ...original, anchors };
      const shifts = combo.flatMap((option, idx) => {
        if (option.delta === 0) return [];
        const anchor = original.anchors[idx];
        return [{
          anchorType: anchor.type,
          originalPosition: anchor.position,
          newPosition: option.position,
          delta: option.delta,
        }];
      });

      return {
        wallConfig,
        shifts,
        heuristic: scoreAnchorConfiguration(wallConfig, effectiveStart, effectiveEnd, drawerWidth),
      };
    })
    .filter((candidate) => candidate.shifts.length > 0)
    .filter((candidate) => isValidAnchorLayout(candidate.wallConfig, effectiveStart, effectiveEnd, drawerWidth));

  const unique = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const signature = candidate.wallConfig.anchors
      .map((anchor) => `${anchor.type}:${anchor.position}:${anchor.width}`)
      .join('|');
    const existing = unique.get(signature);
    if (!existing || candidate.heuristic > existing.heuristic) {
      unique.set(signature, candidate);
    }
  }

  return [...unique.values()]
    .sort((a, b) =>
      b.heuristic - a.heuristic ||
      a.shifts.length - b.shifts.length ||
      a.shifts.reduce((sum, shift) => sum + Math.abs(shift.delta), 0) -
        b.shifts.reduce((sum, shift) => sum + Math.abs(shift.delta), 0),
    )
    .slice(0, MAX_SHIFT_CONFIGS)
    .map(({ wallConfig, shifts }) => ({ wallConfig, shifts }));
}

function countFillers(plan: WallPlan): number {
  return plan.modules.filter((m) => m.type === 'filler' && m.depth === LOWER_DEPTH).length;
}

function totalFillerWidth(plan: WallPlan): number {
  return plan.modules
    .filter((m) => m.type === 'filler' && m.depth === LOWER_DEPTH)
    .reduce((sum, m) => sum + m.width, 0);
}

interface SinkAdjacencyPlan {
  dishwasherX?: number;
  drawerX?: number;
}

function overlapsOtherAnchors(
  wallConfig: WallConfig,
  sinkAnchor: Anchor,
  start: number,
  width: number,
): boolean {
  return wallConfig.anchors.some((anchor) => {
    if (anchor === sinkAnchor) return false;
    return start < anchor.position + anchor.width && start + width > anchor.position;
  });
}

function planSinkAdjacency(
  wallConfig: WallConfig,
  sinkAnchor: Anchor,
  drawerWidth: number,
  dishwasherWidth?: number,
): SinkAdjacencyPlan {
  const sinkStart = sinkAnchor.position;
  const sinkEnd = sinkAnchor.position + sinkAnchor.width;

  if (dishwasherWidth != null) {
    const dishwasherX = sinkEnd;
    const drawerX = dishwasherX + dishwasherWidth;
    const chainWidth = dishwasherWidth + drawerWidth;
    const fitsChainAfter = drawerX + drawerWidth <= wallConfig.length
      && !overlapsOtherAnchors(wallConfig, sinkAnchor, dishwasherX, chainWidth);

    if (fitsChainAfter) {
      return { dishwasherX, drawerX };
    }
  }

  const fitsDrawerAfter = sinkEnd + drawerWidth <= wallConfig.length
    && !overlapsOtherAnchors(wallConfig, sinkAnchor, sinkEnd, drawerWidth);
  if (fitsDrawerAfter) {
    return { drawerX: sinkEnd };
  }

  const drawerXBefore = sinkStart - drawerWidth;
  const fitsDrawerBefore = drawerXBefore >= 0
    && !overlapsOtherAnchors(wallConfig, sinkAnchor, drawerXBefore, drawerWidth);
  if (fitsDrawerBefore) {
    return { drawerX: drawerXBefore };
  }

  return {};
}

// ── Drawer zone pre-reservation ──────────────────────────────────────────────

/**
 * Inject virtual anchors for drawer housing zones so segmentWall excludes them.
 * This prevents the solver from filling the drawer zone with modules that
 * placeDrawerUnit would later remove, creating unfilled gaps.
 */
function reserveDrawerZones(
  wallConfig: WallConfig,
  drawerCab: CabinetRead | null,
  dishwasherCab: CabinetRead | null,
): WallConfig {
  if (!drawerCab) return wallConfig;
  const dw = drawerCab.width;
  const dishwasherWidth = dishwasherCab?.width;
  const extraAnchors: Anchor[] = [];

  for (const anchor of wallConfig.anchors) {
    if (anchor.type !== 'sink') continue;
    const plan = planSinkAdjacency(wallConfig, anchor, dw, dishwasherWidth);

    if (plan.dishwasherX != null && dishwasherWidth != null) {
      extraAnchors.push({
        type: 'oven',
        position: plan.dishwasherX,
        width: dishwasherWidth,
        isVirtual: true,
        virtualKind: 'reserved',
      });
    }
    if (plan.drawerX != null) {
      extraAnchors.push({
        type: 'oven',
        position: plan.drawerX,
        width: dw,
        isVirtual: true,
        virtualKind: 'reserved',
      });
    }
  }

  if (extraAnchors.length === 0) return wallConfig;
  return { ...wallConfig, anchors: [...wallConfig.anchors, ...extraAnchors] };
}

// ── Wall pipeline ────────────────────────────────────────────────────────────

function runWallPipeline(
  wallConfig: WallConfig,
  ctx: PlannerContext,
  cornerOffset: { startOffset?: number; endOffset?: number } | undefined,
  tallConfig: TallConfig,
  input: PlannerInput,
): WallPlan[] {
  const reservedOffset = mergeWallOffsets(cornerOffset, {
    startOffset: tallConfig.startOffset,
    endOffset: tallConfig.endOffset,
  });

  // Reserve space for fridge + penal
  let fridgeReserve = 0;
  let penalReserve = 0;
  if (tallConfig.fridgeCab) {
    const cornerStart = reservedOffset?.startOffset ?? 0;
    const cornerEnd = reservedOffset?.endOffset ?? 0;
    const effectiveLength = wallConfig.length - cornerStart - cornerEnd;
    const tallZone = Math.max(0, effectiveLength - MAX_COUNTERTOP);

    fridgeReserve = tallConfig.fridgeCab.width;
    if (tallZone >= tallConfig.fridgeCab.width + (tallConfig.penalCab?.width ?? 0) && tallConfig.penalCab) {
      penalReserve = tallConfig.penalCab.width;
    }
  }
  const totalTallReserve = fridgeReserve + penalReserve;

  const segOffset = totalTallReserve > 0
    ? tallConfig.fridgeSide === 'left'
      ? {
        startOffset: (reservedOffset?.startOffset ?? 0) + totalTallReserve,
        endOffset: reservedOffset?.endOffset,
      }
      : {
        startOffset: reservedOffset?.startOffset,
        endOffset: (reservedOffset?.endOffset ?? 0) + totalTallReserve,
      }
    : reservedOffset;
  // Pre-reserve drawer housing zones so solver doesn't fill them
  const wallConfigForSegmenting = reserveDrawerZones(wallConfig, ctx.drawerUnitCab, ctx.dishwasherCab);
  const segments = segmentWall(wallConfigForSegmenting, segOffset);

  // Solve lower cabinets
  const segmentSolutions = segments.map((seg) =>
    solveSegment(seg, ctx.goldenTable, ctx.solverModules, ctx.maps),
  );

  const wallVariants = generateWallVariants(wallConfig, segmentSolutions);

  // Lower post-processing
  if (input.useSidePanel200 && ctx.sidePanelCab) {
    for (const variant of wallVariants) {
      placeSidePanels200(variant, wallConfig, ctx.sidePanelCab, ctx.goldenTable, ctx.solverModules, ctx.maps);
    }
  }

  if (ctx.sinkModuleCab) {
    for (const variant of wallVariants) {
      placeSinkModules(variant, wallConfig, ctx.sinkModuleCab);
    }
  }

  if (ctx.plateCab) {
    for (const variant of wallVariants) {
      placePlateModules(variant, wallConfig, ctx.plateCab);
    }
  }

  if (ctx.dishwasherCab) {
    for (const variant of wallVariants) {
      placeDishwasherAdjacentToSink(variant, wallConfig, ctx.dishwasherCab, ctx.drawerUnitCab);
    }
  }

  if (input.useSidePanel200 && ctx.sidePanelCab) {
    for (const variant of wallVariants) {
      autoPlaceSidePanelInGap(variant, wallConfig, ctx.sidePanelCab);
    }
  }

  if (ctx.drawerUnitCab) {
    for (const variant of wallVariants) {
      placeDrawerUnit(variant, wallConfig, ctx.drawerUnitCab);
    }
  }

  // Place fridge/penal on this wall if configured
  if (tallConfig.fridgeCab) {
    for (const variant of wallVariants) {
      placeTallAppliances(
        variant,
        tallConfig.fridgeCab,
        tallConfig.penalCab,
        penalReserve,
        tallConfig.fridgeSide,
        wallConfig.length,
        reservedOffset,
      );
    }
  }

  // Solve uppers
  const expanded: WallPlan[] = [];
  for (const variant of wallVariants) {
    const upperSolutions = solveUppersAlignedToLowers(
      variant, wallConfig, input.modules, ctx.maps.byId, cornerOffset, input.useHood,
    );
    for (const upperMods of upperSolutions) {
      expanded.push({
        wallId: variant.wallId,
        modules: [...variant.modules, ...upperMods],
        anchors: variant.anchors?.map((anchor) => ({ ...anchor })),
      });
      if (expanded.length >= 20) break;
    }
    if (expanded.length >= 20) break;
  }

  // Antresols
  if (input.floorToCeiling) {
    for (const variant of expanded) {
      const antresolModules = solveAntresolForWall(
        variant.modules,
        ctx.antresolByWidth,
        ctx.maps.byId,
      );
      variant.modules.push(...antresolModules);
    }
  }

  // Sort modules by X position
  for (const variant of expanded) {
    variant.modules.sort((a, b) => a.x - b.x);
  }

  return expanded;
}

function wallVariantSignature(wallPlan: WallPlan): string {
  const anchorsSig = (wallPlan.anchors ?? [])
    .map((anchor) => `${anchor.type}:${anchor.position}:${anchor.width}`)
    .join('|');
  const modulesSig = [...wallPlan.modules]
    .sort((a, b) => a.x - b.x || a.width - b.width || a.article.localeCompare(b.article))
    .map((module) => `${module.type}:${module.x}:${module.width}:${module.article}`)
    .join('|');

  return `${wallPlan.wallId}::${anchorsSig}::${modulesSig}`;
}

export function processWall(
  wallConfig: WallConfig,
  ctx: PlannerContext,
  cornerOffset: { startOffset?: number; endOffset?: number } | undefined,
  tallConfig: TallConfig,
  input: PlannerInput,
): WallPlan[] {
  const originalVariants = runWallPipeline(wallConfig, ctx, cornerOffset, tallConfig, input);
  const collectedVariants: WallPlan[] = [...originalVariants];
  const reservedOffset = mergeWallOffsets(cornerOffset, {
    startOffset: tallConfig.startOffset,
    endOffset: tallConfig.endOffset,
  });

  // Calculate effective countertop zone (excludes corner + fridge/penal reserves)
  let tallReserve = 0;
  if (tallConfig.fridgeCab) {
    tallReserve = tallConfig.fridgeCab.width;
    const cornerStart = reservedOffset?.startOffset ?? 0;
    const cornerEnd = reservedOffset?.endOffset ?? 0;
    const effectiveLength = wallConfig.length - cornerStart - cornerEnd;
    const tallZone = Math.max(0, effectiveLength - MAX_COUNTERTOP);
    if (tallZone >= tallConfig.fridgeCab.width + (tallConfig.penalCab?.width ?? 0) && tallConfig.penalCab) {
      tallReserve += tallConfig.penalCab.width;
    }
  }
  const effectiveStart = tallConfig.fridgeSide === 'left'
    ? (reservedOffset?.startOffset ?? 0) + tallReserve
    : (reservedOffset?.startOffset ?? 0);
  const effectiveEnd = tallConfig.fridgeSide === 'right'
    ? wallConfig.length - (reservedOffset?.endOffset ?? 0) - tallReserve
    : wallConfig.length - (reservedOffset?.endOffset ?? 0);

  const shifted = generateShiftedWallConfigs(
    wallConfig,
    effectiveStart,
    effectiveEnd,
    ctx.drawerUnitCab?.width ?? input.drawerHousingWidth,
  );

  for (const { wallConfig: shiftedWall, shifts } of shifted) {
    const shiftedVariants = runWallPipeline(shiftedWall, ctx, cornerOffset, tallConfig, input);
    for (const v of shiftedVariants.slice(0, MAX_SHIFTED_PIPELINE_VARIANTS)) {
      v.anchorShifts = shifts;
      collectedVariants.push(v);
    }
  }

  const unique = new Map<string, WallPlan>();
  for (const variant of collectedVariants) {
    const signature = wallVariantSignature(variant);
    if (!unique.has(signature)) {
      unique.set(signature, variant);
    }
  }

  const deduped = [...unique.values()];
  const originalOnly = deduped.filter((variant) => !variant.anchorShifts || variant.anchorShifts.length === 0);
  const shiftedOnly = deduped.filter((variant) => (variant.anchorShifts?.length ?? 0) > 0);

  return [
    ...originalOnly.slice(0, 12),
    ...shiftedOnly.slice(0, 8),
    ...originalOnly.slice(12),
    ...shiftedOnly.slice(8),
  ].slice(0, 20);
}

export function placeCorners(
  corners: CornerJunction[],
  modules: CabinetRead[],
  options?: {
    lowerCornerCabinetId?: number | null;
    upperCornerCabinetId?: number | null;
  },
): { cornerModules: PlacedModule[]; cornerOffsets: Map<string, { startOffset?: number; endOffset?: number }> } {
  const lowerCornerCabinets = modules.filter((m) => m.is_corner && m.type === CabinetType.LOWER);
  const upperCornerCabinets = modules.filter((m) => m.is_corner && m.type === CabinetType.UPPER);
  const cornerModules: PlacedModule[] = [];
  const cornerOffsets: Map<string, { startOffset?: number; endOffset?: number }> = new Map();

  for (let ci = 0; ci < corners.length; ci++) {
    const junction = corners[ci];
    const lowerCornerModule = selectCornerCabinet(lowerCornerCabinets, junction.id, {
      cabinetId: options?.lowerCornerCabinetId,
      index: ci,
    });
    const upperCornerModule = selectCornerCabinet(upperCornerCabinets, junction.id, {
      cabinetId: options?.upperCornerCabinetId,
      index: ci,
      yOffset: UPPER_Y,
    });

    // Reserve corner space on both walls even if no corner cabinet in catalog
    const occupancy = lowerCornerModule?.width || CORNER_WALL_OCCUPANCY;

    for (const side of [junction.wallA, junction.wallB] as const) {
      const existing = cornerOffsets.get(side.wallId) ?? {};
      if (side.end === 'end') {
        existing.endOffset = (existing.endOffset ?? 0) + occupancy;
      } else {
        existing.startOffset = (existing.startOffset ?? 0) + occupancy;
      }
      cornerOffsets.set(side.wallId, existing);
    }

    if (lowerCornerModule) {
      cornerModules.push(lowerCornerModule);
    }
    if (upperCornerModule) {
      cornerModules.push(upperCornerModule);
    }
  }

  return { cornerModules, cornerOffsets };
}

export function combineAndScore(
  wallVariantSets: WallPlan[][],
  cornerModules: PlacedModule[],
  input: PlannerInput,
): SolverVariant[] {
  const kitchenCombos = cappedCartesian(wallVariantSets, MAX_VARIANTS * 3);

  const baseScoringContext: Omit<ScoringContext, 'anchors'> = {
    roomWidth: input.roomWidth,
    roomDepth: input.roomDepth,
    wallHeight: input.wallHeight,
    layoutType: input.layoutType,
  };

  const scoredPlans: KitchenPlan[] = kitchenCombos.map((walls) => {
    const allShifts = walls.flatMap((w) => w.anchorShifts ?? []);
    const scoringContext: ScoringContext = {
      ...baseScoringContext,
      anchors: walls.flatMap((wall) =>
        (wall.anchors ?? [])
          .filter((anchor) => !anchor.isVirtual)
          .map((anchor) => ({
            wallId: wall.wallId,
            type: anchor.type,
            position: anchor.position,
            width: anchor.width,
          })),
      ),
    };
    const plan: KitchenPlan = {
      walls,
      cornerModules,
      score: 0,
      scoreBreakdown: { ...EMPTY_SCORE_BREAKDOWN },
      anchorShifts: allShifts.length > 0 ? allShifts : undefined,
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
