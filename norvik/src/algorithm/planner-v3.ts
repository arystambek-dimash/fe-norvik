/**
 * Kitchen Planner v3 — simple greedy fill.
 *
 * Philosophy: user places anchors, algorithm fills gaps between them.
 * No scoring, no DP magic, no anchor shifting. Just greedy fill with
 * the widest possible cabinets. Gaps only at the wall edge, NEVER
 * between furniture.
 */

import type { CabinetRead } from '@/types/entities';
import { CabinetKind, CabinetSubtype, CabinetType } from '@/types/enums';
import type {
  Anchor, KitchenPlan, PlacedModule, PlannerInput,
  ScoreBreakdown, SolverVariant, WallPlan, CategoryDetail,
} from './types';
import {
  LOWER_HEIGHT, LOWER_DEPTH, UPPER_Y, MIN_AISLE_CLEARANCE,
  ARTICLE_PREFIX, SIDE_PANEL_WIDTH,
} from './constants';

// ── Constants ──────────────────────────────────────────────────────────────────

const CABINET_WIDTHS = [800, 600, 500, 450, 400, 200] as const;
// When floorToCeiling=true, exclude 200 (no ПГ 200 antresol exists)
const CABINET_WIDTHS_FTC = [800, 600, 500, 450, 400] as const;
const W_TOL = 5; // width match tolerance (handles 600 vs 601 in DB)

// ── Module ID ──────────────────────────────────────────────────────────────────

let _id = 0;
const nid = () => `mod-${_id++}`;
export function resetModuleCounter() { _id = 0; }

// ── Fillability utilities (exported for frontend use) ──────────────────────────

/** Check if a gap width can be filled exactly with available cabinet widths. */
export function isFillable(width: number, widths: readonly number[] = CABINET_WIDTHS): boolean {
  if (width <= 0) return true;
  if (width < Math.min(...widths)) return false;
  const dp = new Uint8Array(width + 1);
  dp[0] = 1;
  for (const w of widths) {
    for (let s = w; s <= width; s++) {
      if (dp[s - w]) dp[s] = 1;
    }
  }
  return dp[width] === 1;
}

/** Find nearest fillable widths (smaller and larger). */
export function nearestFillable(width: number, widths: readonly number[] = CABINET_WIDTHS): { smaller: number; larger: number } {
  let smaller = width;
  let larger = width;
  while (smaller > 0 && !isFillable(smaller, widths)) smaller--;
  while (larger < width + 200 && !isFillable(larger, widths)) larger++;
  return { smaller, larger };
}

/** Generate all fill variants for a gap (sorted: fewer modules first, top 10). */
export function generateFillVariants(gap: number, maxVariants = 10, widths: readonly number[] = CABINET_WIDTHS): number[][] {
  if (gap <= 0) return [[]];
  if (!isFillable(gap, widths)) return [];

  const results: number[][] = [];

  function bt(rem: number, idx: number, cur: number[]) {
    if (rem === 0) { results.push([...cur]); return; }
    if (results.length >= 100) return; // cap search
    for (let i = idx; i < widths.length; i++) {
      if (widths[i] <= rem) {
        cur.push(widths[i]);
        bt(rem - widths[i], i, cur);
        cur.pop();
      }
    }
  }

  bt(gap, 0, []);

  // Sort: fewer modules first, then wider average
  results.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    const avgA = a.reduce((s, v) => s + v, 0) / a.length;
    const avgB = b.reduce((s, v) => s + v, 0) / b.length;
    return avgB - avgA;
  });

  return results.slice(0, maxVariants);
}

/** Get effective widths based on floorToCeiling setting */
export function getEffectiveWidths(floorToCeiling: boolean): readonly number[] {
  return floorToCeiling ? CABINET_WIDTHS_FTC : CABINET_WIDTHS;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function findCab(cabs: CabinetRead[], w: number, kind?: CabinetKind): CabinetRead | null {
  if (kind != null) {
    const c = cabs.find(c => Math.abs(c.width - w) <= W_TOL && c.kind === kind);
    if (c) return c;
  }
  return cabs.find(c => Math.abs(c.width - w) <= W_TOL && c.kind === CabinetKind.DOOR
    && c.type === CabinetType.LOWER && !c.is_corner) ?? null;
}

function mkMod(cab: CabinetRead, x: number, wallId: string,
  type: PlacedModule['type'] = 'lower', extra?: Partial<PlacedModule>): PlacedModule {
  return {
    id: nid(), cabinetId: cab.id, article: cab.article,
    kind: cab.kind, subtype: cab.subtype,
    x, width: cab.width, height: cab.height, depth: cab.depth,
    type, wallId, glbFile: cab.glb_file ?? undefined, ...extra,
  };
}

function mkFiller(x: number, w: number, wallId: string,
  extra?: Partial<PlacedModule>): PlacedModule {
  return {
    id: nid(), cabinetId: -1, article: 'filler',
    x, width: w, height: LOWER_HEIGHT, depth: LOWER_DEPTH,
    type: 'filler', wallId, ...extra,
  };
}

// ── Context ────────────────────────────────────────────────────────────────────

interface Ctx {
  lowerCabs: CabinetRead[];
  upperSeries: CabinetRead[];
  upperHeight: number;
  antresolByPrefix: Map<string, CabinetRead[]>;
  upperPrefixes: string[];
  sinkCab: CabinetRead | null;
  drawerCab: CabinetRead | null;
  plateCab: CabinetRead | null;
  fridgeCab: CabinetRead | null;
  penalCab: CabinetRead | null;
  dishwasherCab: CabinetRead | null;
  sidePanelCab: CabinetRead | null;
}

function buildCtx(input: PlannerInput): Ctx {
  const M = input.modules;

  const lowerCabs = M.filter(m =>
    m.type === CabinetType.LOWER && !m.is_corner && m.kind === CabinetKind.DOOR);

  // Upper series selection (same as v2)
  const allUp = M.filter(m =>
    m.type === CabinetType.UPPER && m.kind === CabinetKind.DOOR && !m.is_corner);
  const hGrp = new Map<number, CabinetRead[]>();
  for (const c of allUp) { const g = hGrp.get(c.height) ?? []; g.push(c); hGrp.set(c.height, g); }
  let bH = 720, bN = 0, bS: CabinetRead[] = [];
  for (const [h, cs] of hGrp) {
    const n = new Set(cs.map(c => c.width)).size;
    if (n > bN || (n === bN && h === 720)) { bN = n; bH = h; bS = cs; }
  }

  // Antresol index by article prefix
  const antresolPrefixes = ['ГВПГ', 'ВПГ', 'ГПГ', 'ПГ'];
  const antresolByPrefix = new Map<string, CabinetRead[]>();
  for (const pfx of antresolPrefixes) antresolByPrefix.set(pfx, []);
  for (const m of M) {
    const art = m.article.trim();
    for (const pfx of antresolPrefixes) {
      if (art.startsWith(pfx)) { antresolByPrefix.get(pfx)!.push(m); break; }
    }
  }

  const upperPrefixes = bH === 900 ? ['ВПГ', 'ПГ'] : ['ПГ'];

  // Special cabinets
  const sinkCab = M.find(m =>
    m.kind === CabinetKind.SINK && m.subtype === CabinetSubtype.SINK_BASE
    && Math.abs(m.width - input.sinkModuleWidth) <= W_TOL) ?? null;
  const drawerCab = M.find(m =>
    m.kind === CabinetKind.DRAWER_UNIT && m.article.startsWith('СЯШ')
    && Math.abs(m.width - input.drawerHousingWidth) <= W_TOL) ?? null;
  let plateCab: CabinetRead | null = null;
  if (input.useInbuiltStove) plateCab = M.find(m => m.kind === CabinetKind.PLATE && m.inbuilt) ?? null;
  else if (input.selectedStoveId != null) plateCab = M.find(m => m.id === input.selectedStoveId) ?? null;
  else plateCab = M.find(m => m.kind === CabinetKind.PLATE && !m.inbuilt) ?? null;
  const fridgeCab = M.find(m => m.kind === CabinetKind.FRIDGE) ?? null;
  const penalCab = M.find(m => m.kind === CabinetKind.PENAL) ?? null;
  const dishwasherCab = M.find(m => m.article.startsWith(ARTICLE_PREFIX.DISHWASHER)) ?? null;
  const sidePanelCab = M.find(m =>
    m.article.startsWith(ARTICLE_PREFIX.SIDE_PANEL) && Math.abs(m.width - SIDE_PANEL_WIDTH) <= W_TOL) ?? null;

  return {
    lowerCabs, upperSeries: bS, upperHeight: bH,
    antresolByPrefix, upperPrefixes,
    sinkCab, drawerCab, plateCab, fridgeCab, penalCab, dishwasherCab, sidePanelCab,
  };
}

/** Place cabinet modules for a fill variant, starting at cursor. */
function placeFillVariant(
  widths: number[], startX: number, wallId: string, ctx: Ctx,
): PlacedModule[] {
  const mods: PlacedModule[] = [];
  let cx = startX;
  for (const w of widths) {
    const cab = findCab(ctx.lowerCabs, w);
    if (cab) {
      mods.push(mkMod(cab, cx, wallId, 'lower', { width: w }));
    } else {
      mods.push(mkFiller(cx, w, wallId));
    }
    cx += w;
  }
  return mods;
}

// ── Anchor sorting & expansion ─────────────────────────────────────────────────

interface ExpandedAnchor {
  x: number;       // user's desired position
  width: number;    // total width of this anchor block
  modules: PlacedModule[];  // the modules that make up this anchor
}

function expandAnchors(
  anchors: Anchor[], wallId: string, ctx: Ctx, input: PlannerInput,
): ExpandedAnchor[] {
  const result: ExpandedAnchor[] = [];

  for (const a of anchors) {
    const mods: PlacedModule[] = [];
    let cx = a.position;

    if (a.type === 'sink') {
      // Супермойка: [СМ] → [ПММ?] → [СЯШ]  (or reversed by orientation)
      // For now: СМ + dishwasher + drawer, left-to-right
      if (ctx.sinkCab) {
        mods.push(mkMod(ctx.sinkCab, cx, wallId));
        cx += ctx.sinkCab.width;
      }
      if (ctx.dishwasherCab) {
        mods.push(mkMod(ctx.dishwasherCab, cx, wallId));
        cx += ctx.dishwasherCab.width;
      }
      if (ctx.drawerCab) {
        mods.push(mkMod(ctx.drawerCab, cx, wallId));
        cx += ctx.drawerCab.width;
      }
      result.push({ x: a.position, width: cx - a.position, modules: mods });

    } else if (a.type === 'cooktop') {
      if (ctx.plateCab) {
        const pw = input.useInbuiltStove ? 600 : ctx.plateCab.width;
        mods.push(mkMod(ctx.plateCab, cx, wallId, 'lower', { width: pw }));
        cx += pw;
      }
      result.push({ x: a.position, width: cx - a.position, modules: mods });

    } else if (a.type === 'oven') {
      // Oven/appliance housing — occupies anchor width
      const cab = input.modules.find(m =>
        m.kind === CabinetKind.APPLIANCE_HOUSING && Math.abs(m.width - a.width) <= W_TOL);
      if (cab) {
        mods.push(mkMod(cab, cx, wallId));
        cx += cab.width;
      }
      result.push({ x: a.position, width: cx - a.position, modules: mods });
    }
  }

  // Sort by x position
  result.sort((a, b) => a.x - b.x);
  return result;
}

// ── Upper cabinets ─────────────────────────────────────────────────────────────

function solveUppers(
  lowerMods: PlacedModule[], wallId: string, ctx: Ctx, input: PlannerInput,
  anchors: Anchor[],
): PlacedModule[] {
  const ups: PlacedModule[] = [];

  // Hood blocked zone
  const blocked: { s: number; e: number }[] = [];
  if (input.useHood) {
    const c = anchors.find(a => a.type === 'cooktop');
    if (c) blocked.push({ s: c.position, e: c.position + c.width });
  }
  const isBlocked = (x: number, w: number) => blocked.some(b => x < b.e && x + w > b.s);

  // Upper cabinet lookup
  const upByW = new Map<number, CabinetRead>();
  for (const c of ctx.upperSeries) if (!upByW.has(c.width)) upByW.set(c.width, c);

  for (const lo of lowerMods) {
    if (lo.type === 'tall') continue; // no upper above fridge/penal
    if (isBlocked(lo.x, lo.width)) continue;

    // Find upper with ±5mm tolerance
    let cab: CabinetRead | null = null;
    for (const [uw, uc] of upByW) {
      if (Math.abs(uw - lo.width) <= W_TOL) { cab = uc; break; }
    }

    if (cab) {
      ups.push(mkMod(cab, lo.x, wallId, 'upper', {
        yOffset: UPPER_Y, height: ctx.upperHeight, width: lo.width,
      }));
    } else if (lo.type === 'filler') {
      ups.push({
        id: nid(), cabinetId: -1, article: 'filler',
        x: lo.x, width: lo.width, height: ctx.upperHeight, depth: 300,
        type: 'filler', wallId, yOffset: UPPER_Y,
      });
    }
  }

  return ups;
}

// ── Antresols ──────────────────────────────────────────────────────────────────

function solveAntresols(
  uppers: PlacedModule[], talls: PlacedModule[],
  wallId: string, wallH: number, ctx: Ctx,
): PlacedModule[] {
  const result: PlacedModule[] = [];
  const upperAntY = UPPER_Y + ctx.upperHeight;

  const findAnt = (w: number, pfxs: string[]): CabinetRead | null => {
    for (const pfx of pfxs) {
      const c = (ctx.antresolByPrefix.get(pfx) ?? []).find(c => Math.abs(c.width - w) <= W_TOL);
      if (c) return c;
    }
    return null;
  };

  for (const m of uppers) {
    if (m.type === 'filler') {
      const antH = ctx.upperPrefixes.includes('ВПГ') ? 450 : 350;
      if (upperAntY + antH <= wallH) {
        result.push(mkFiller(m.x, m.width, wallId, {
          height: antH, depth: 300, yOffset: upperAntY,
        }));
      }
      continue;
    }
    const cab = findAnt(m.width, ctx.upperPrefixes);
    if (cab && upperAntY + cab.height <= wallH) {
      result.push(mkMod(cab, m.x, wallId, 'antresol', { yOffset: upperAntY, width: m.width }));
    }
  }

  for (const m of talls) {
    let pfx: string[];
    if (m.kind === CabinetKind.FRIDGE) pfx = ['ГВПГ'];
    else if (m.kind === CabinetKind.PENAL || m.kind === CabinetKind.PENAL_APPLIANCE_HOUSING) pfx = ['ГПГ'];
    else continue;
    const yOff = Math.max(m.height, upperAntY);
    const cab = findAnt(m.width, pfx);
    if (cab && yOff + cab.height <= wallH) {
      result.push(mkMod(cab, m.x, m.wallId, 'antresol', { yOffset: yOff, width: m.width }));
    }
  }

  return result;
}

// ── Output ─────────────────────────────────────────────────────────────────────

function buildOutput(
  mods: PlacedModule[], wallId: string, anchors: Anchor[], rank: number,
): SolverVariant {
  const cat = (s: number): CategoryDetail => ({ score: s, subMetrics: {} });
  const bd: ScoreBreakdown = {
    hardConstraintsPassed: true, violations: [],
    ergonomics: cat(80), workflow: cat(80), aesthetics: cat(80),
    manufacturability: cat(80), preferences: cat(80),
  };
  const sorted = [...mods].sort((a, b) => a.x - b.x);
  const wp: WallPlan = { wallId, modules: sorted, anchors };
  return {
    plan: { walls: [wp], cornerModules: [], score: 80, scoreBreakdown: bd },
    rank,
  };
}

// ── Main: planKitchen ──────────────────────────────────────────────────────────

export function planKitchen(input: PlannerInput): SolverVariant[] {
  resetModuleCounter();
  if (!input.walls.length) return [];

  const ctx = buildCtx(input);
  const wall = input.walls[0];
  const wallLen = wall.length;
  const wallId = wall.id;
  const effWidths = getEffectiveWidths(input.floorToCeiling);

  // Expand anchors into their module blocks
  const expanded = expandAnchors(wall.anchors, wallId, ctx, input);

  // ── Compute gaps between anchors ──────────────────────────────────────

  interface Gap { start: number; width: number }
  const gaps: Gap[] = [];
  let cursor = 0;

  for (const anchor of expanded) {
    const gapW = anchor.x - cursor;
    if (gapW > 0) gaps.push({ start: cursor, width: gapW });
    cursor = anchor.x + anchor.width;
  }
  // Remaining gap to wall end
  if (wallLen > cursor) gaps.push({ start: cursor, width: wallLen - cursor });

  // ── Generate fill variants for each gap ────────────────────────────────

  const gapVariants: number[][][] = []; // [gapIdx][variantIdx] = widths[]
  for (const g of gaps) {
    let variants = generateFillVariants(g.width, 10, effWidths);
    // Fallback: try with full widths if floorToCeiling restricted set found nothing
    if (variants.length === 0 && input.floorToCeiling) {
      variants = generateFillVariants(g.width, 10, CABINET_WIDTHS);
    }
    // If still nothing and gap is small, accept empty (gap at wall edge)
    if (variants.length === 0) {
      variants = [[]]; // no fill — gap remains
    }
    gapVariants.push(variants);
  }

  // ── Build plans: take first variant of each gap, then alternate ────────
  // Generate up to 10 different plans by varying gap fills

  const results: SolverVariant[] = [];
  const maxPlans = Math.min(10, gapVariants.reduce((m, v) => Math.max(m, v.length), 1));

  for (let planIdx = 0; planIdx < maxPlans; planIdx++) {
    _id = 0;
    const allLower: PlacedModule[] = [];
    const tallMods: PlacedModule[] = [];
    let cx = 0;
    let gapIdx = 0;

    for (const anchor of expanded) {
      // Fill gap before this anchor
      const gapW = anchor.x - cx;
      if (gapW > 0 && gapIdx < gapVariants.length) {
        const varIdx = Math.min(planIdx, gapVariants[gapIdx].length - 1);
        const fill = gapVariants[gapIdx][varIdx];
        allLower.push(...placeFillVariant(fill, cx, wallId, ctx));
        cx += fill.reduce((s, w) => s + w, 0);
        gapIdx++;
      }

      // Place anchor modules FLUSH (no gaps)
      for (const mod of anchor.modules) {
        allLower.push({ ...mod, x: cx });
        cx += mod.width;
      }
    }

    // Fill remaining gap
    if (gapIdx < gapVariants.length) {
      const varIdx = Math.min(planIdx, gapVariants[gapIdx].length - 1);
      const fill = gapVariants[gapIdx][varIdx];
      allLower.push(...placeFillVariant(fill, cx, wallId, ctx));
      cx += fill.reduce((s, w) => s + w, 0);
    }

    // Fridge/penal as anchors now — they're already in allLower via expanded
    // Check if fridge anchor exists
    const hasFridgeAnchor = wall.anchors.some(a => a.type === 'fridge');
    if (!hasFridgeAnchor && ctx.fridgeCab) {
      // No fridge anchor placed by user — put it flush at the end
      tallMods.push(mkMod(ctx.fridgeCab, cx, wallId, 'tall'));
      cx += ctx.fridgeCab.width;
    }

    // Uppers (1:1 with lowers)
    const uppers = solveUppers(allLower, wallId, ctx, input, wall.anchors);

    // Antresols
    const antresols = input.floorToCeiling
      ? solveAntresols(uppers, tallMods, wallId, input.wallHeight, ctx)
      : [];

    const allMods = [...allLower, ...tallMods, ...uppers, ...antresols];
    results.push(buildOutput(allMods, wallId, wall.anchors, planIdx + 1));
  }

  return results;
}
