/**
 * Kitchen Planner v2 — complete rewrite.
 *
 * Key fixes over previous attempts:
 * - Width matching uses ±5mm tolerance (handles 600 vs 601 DB inconsistency)
 * - Antresol lookup by article prefix (ПГ stored as kind=door in DB)
 * - Fallback cascade for small segments (filler-only, then LOWER_WIDTHS without antresol)
 * - ALLOWED_WIDTHS = fuzzy intersection of lower ∩ upper ∩ antresol
 */

import type { CabinetRead } from '@/types/entities';
import { CabinetKind, CabinetSubtype, CabinetType } from '@/types/enums';
import type {
  Anchor, AnchorShift, CategoryDetail, KitchenPlan, PlacedModule,
  PlannerInput, ScoreBreakdown, SolverVariant, WallPlan,
} from './types';
import {
  LOWER_HEIGHT, LOWER_DEPTH, UPPER_Y, MAX_COUNTERTOP,
  MIN_SINK_COOKTOP_GAP, MODULE_GRID, MIN_SEGMENT, SIDE_PANEL_WIDTH,
  ARTICLE_PREFIX, MIN_AISLE_CLEARANCE,
} from './constants';
import { canFillWithFiller, findBestFill } from './dp-fill';

// ── ID counter ─────────────────────────────────────────────────────────────────
let _id = 0;
const nid = () => `mod-${_id++}`;
export function resetModuleCounter() { _id = 0; }

// ── Width tolerance ────────────────────────────────────────────────────────────
const W_TOL = 5; // mm tolerance for width matching (handles 600 vs 601)

/** Find cabinet in list whose width is within ±W_TOL of target */
function findByWidth(cabs: CabinetRead[], w: number): CabinetRead | null {
  return cabs.find(c => Math.abs(c.width - w) <= W_TOL) ?? null;
}

/** Check if a width has a fuzzy match in a set */
function hasWidth(widths: number[], w: number): boolean {
  return widths.some(v => Math.abs(v - w) <= W_TOL);
}

// ── Internal types ─────────────────────────────────────────────────────────────
interface Ctx {
  lowerCabs: CabinetRead[];
  upperSeries: CabinetRead[];
  // Antresol lookup: prefix → [cabinets]
  antresolByPrefix: Map<string, CabinetRead[]>;
  sinkCab: CabinetRead | null;
  drawerCab: CabinetRead | null;
  plateCab: CabinetRead | null;
  fridgeCab: CabinetRead | null;
  penalCab: CabinetRead | null;
  dishwasherCab: CabinetRead | null;
  sidePanelCab: CabinetRead | null;
  ALLOWED_WIDTHS: number[];   // primary DP widths (intersection with tolerance)
  LOWER_WIDTHS: number[];     // all lower widths (fallback)
  UPPER_HEIGHT: number;
  upperPrefixes: string[];    // antresol prefixes compatible with chosen upper series
}

interface WZ { start: number; end: number }
interface Tall { fridgeX: number; penalX: number | null; hasPenal: boolean; total: number }
interface Occ { x: number; w: number; mod: PlacedModule }
interface Seg { start: number; end: number; w: number }
interface ACfg { anchors: Anchor[]; shifts: AnchorShift[] }
interface Plan {
  lower: PlacedModule[]; upper: PlacedModule[]; antresol: PlacedModule[];
  tall: PlacedModule[]; fillers: PlacedModule[]; cfg: ACfg; score: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function pm(c: CabinetRead, x: number, wid: string,
  tp: PlacedModule['type'] = 'lower', ex?: Partial<PlacedModule>): PlacedModule {
  return {
    id: nid(), cabinetId: c.id, article: c.article, kind: c.kind, subtype: c.subtype,
    x, width: c.width, height: c.height, depth: c.depth,
    type: tp, wallId: wid, glbFile: c.glb_file ?? undefined, ...ex,
  };
}
function fil(x: number, w: number, wid: string): PlacedModule {
  return { id: nid(), cabinetId: -1, article: 'filler', x, width: w,
    height: LOWER_HEIGHT, depth: LOWER_DEPTH, type: 'filler', wallId: wid };
}
function ufil(x: number, w: number, wid: string, h: number): PlacedModule {
  return { id: nid(), cabinetId: -1, article: 'filler', x, width: w,
    height: h, depth: 300, type: 'filler', wallId: wid, yOffset: UPPER_Y };
}

// ── Step 0: Context ────────────────────────────────────────────────────────────
function prepCtx(input: PlannerInput): Ctx {
  const M = input.modules;

  const lowerCabs = M.filter(m =>
    m.type === CabinetType.LOWER && !m.is_corner && m.kind === CabinetKind.DOOR);
  const allUp = M.filter(m =>
    m.type === CabinetType.UPPER && m.kind === CabinetKind.DOOR && !m.is_corner);

  // Build antresol index by article prefix (handles ПГ stored as kind=door)
  // We look for articles matching known antresol prefixes regardless of kind
  const antresolPrefixes = ['ВПГ', 'ПГ', 'ГВПГ', 'ГПГ'];
  const antresolByPrefix = new Map<string, CabinetRead[]>();
  for (const pfx of antresolPrefixes) antresolByPrefix.set(pfx, []);

  for (const m of M) {
    const art = m.article.trim();
    // Match longest prefix first
    for (const pfx of ['ГВПГ', 'ВПГ', 'ГПГ', 'ПГ']) {
      if (art.startsWith(pfx)) {
        antresolByPrefix.get(pfx)!.push(m);
        break;
      }
    }
  }

  // Special cabs
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

  // Upper series selection
  const hGrp = new Map<number, CabinetRead[]>();
  for (const c of allUp) { const g = hGrp.get(c.height) ?? []; g.push(c); hGrp.set(c.height, g); }
  let bH = 720, bN = 0, bS: CabinetRead[] = [];
  for (const [h, cs] of hGrp) {
    const n = new Set(cs.map(c => c.width)).size;
    if (n > bN || (n === bN && h === 720)) { bN = n; bH = h; bS = cs; }
  }

  const LOWER_WIDTHS = [...new Set(lowerCabs.map(c => c.width))].sort((a, b) => a - b);
  const UPPER_WIDTHS = [...new Set(bS.map(c => c.width))].sort((a, b) => a - b);

  // Antresol prefixes for chosen upper series
  const upperPrefixes = bH === 900 ? ['ВПГ', 'ПГ'] : ['ПГ'];

  // Antresol widths for the chosen upper series prefixes
  const antWidths: number[] = [];
  for (const pfx of upperPrefixes) {
    for (const c of antresolByPrefix.get(pfx) ?? []) antWidths.push(c.width);
  }
  const ANT_WIDTHS = [...new Set(antWidths)].sort((a, b) => a - b);

  // ALLOWED_WIDTHS = fuzzy intersection
  let ALLOWED: number[];
  if (input.floorToCeiling && ANT_WIDTHS.length > 0) {
    ALLOWED = LOWER_WIDTHS.filter(lw =>
      hasWidth(UPPER_WIDTHS, lw) && hasWidth(ANT_WIDTHS, lw));
  } else {
    ALLOWED = LOWER_WIDTHS.filter(lw => hasWidth(UPPER_WIDTHS, lw));
  }

  // If ALLOWED is empty (catastrophic), fall back to LOWER ∩ UPPER only
  if (ALLOWED.length === 0) {
    ALLOWED = LOWER_WIDTHS.filter(lw => hasWidth(UPPER_WIDTHS, lw));
  }
  if (ALLOWED.length === 0) ALLOWED = [...LOWER_WIDTHS]; // last resort

  return {
    lowerCabs, upperSeries: bS, antresolByPrefix,
    sinkCab, drawerCab, plateCab, fridgeCab, penalCab, dishwasherCab, sidePanelCab,
    ALLOWED_WIDTHS: ALLOWED, LOWER_WIDTHS, UPPER_HEIGHT: bH, upperPrefixes,
  };
}

// ── Step 1: Zones ──────────────────────────────────────────────────────────────
function zones(wl: number, side: 'left' | 'right', ctx: Ctx) {
  if (!ctx.fridgeCab) return { wz: { start: 0, end: wl } as WZ, tall: null as Tall | null };
  const fw = ctx.fridgeCab.width, pw = ctx.penalCab?.width ?? 0;
  const tz = Math.max(0, wl - MAX_COUNTERTOP);
  const hp = ctx.penalCab != null && tz >= fw + pw;
  const tot = fw + (hp ? pw : 0);
  if (side === 'right') return {
    wz: { start: 0, end: wl - tot } as WZ,
    tall: { fridgeX: wl - tot, penalX: hp ? wl - pw : null, hasPenal: hp, total: tot } as Tall,
  };
  return {
    wz: { start: tot, end: wl } as WZ,
    tall: { fridgeX: hp ? pw : 0, penalX: hp ? 0 : null, hasPenal: hp, total: tot } as Tall,
  };
}

// ── Step 3: Anchor configs ─────────────────────────────────────────────────────
function genCfgs(anchors: Anchor[], wz: WZ): ACfg[] {
  const sh = anchors.filter(a => a.type === 'sink' || a.type === 'cooktop');
  const fx = anchors.filter(a => a.type !== 'sink' && a.type !== 'cooktop');
  if (!sh.length) return [{ anchors: [...anchors], shifts: [] }];
  const ds = [-100, -50, 0, 50, 100];
  const opts = sh.map(a => ({
    a, pos: [...new Set(ds.map(d => a.position + d)
      .filter(p => p % MODULE_GRID === 0 && p >= wz.start && p + a.width <= wz.end))],
  }));
  let combos: number[][] = [[]];
  for (const { pos } of opts) {
    const nx: number[][] = [];
    for (const c of combos) for (const p of pos) { nx.push([...c, p]); if (nx.length >= 256) break; }
    combos = nx; if (combos.length >= 256) break;
  }
  const cfgs: ACfg[] = [];
  for (const combo of combos) {
    const sa = opts.map(({ a }, i) => ({ ...a, position: combo[i] }));
    const all = [...fx, ...sa].sort((a, b) => a.position - b.position);
    let ok = true;
    for (let i = 1; i < all.length; i++)
      if (all[i].position < all[i - 1].position + all[i - 1].width) { ok = false; break; }
    if (!ok) continue;
    for (const s of all.filter(a => a.type === 'sink'))
      for (const c of all.filter(a => a.type === 'cooktop')) {
        const g = Math.max(c.position - (s.position + s.width), s.position - (c.position + c.width));
        if (g < MIN_SINK_COOKTOP_GAP) { ok = false; break; }
      }
    if (!ok) continue;
    cfgs.push({
      anchors: all,
      shifts: opts.map(({ a }, i) => ({ anchorType: a.type as 'sink' | 'cooktop' | 'oven',
        originalPosition: a.position, newPosition: combo[i], delta: combo[i] - a.position }))
        .filter(s => s.delta !== 0),
    });
  }
  return cfgs;
}

// ── Step 4: Place specials ─────────────────────────────────────────────────────
function placeSpec(anch: Anchor[], wz: WZ, wid: string, ctx: Ctx, inp: PlannerInput) {
  const occ: Occ[] = [];
  const sA = anch.find(a => a.type === 'sink');
  const cA = anch.find(a => a.type === 'cooktop');
  const sL = sA && cA ? sA.position < cA.position : true;
  const ov = (x: number, w: number) => occ.some(o => x < o.x + o.w && x + w > o.x);
  const inW = (x: number, w: number) => x >= wz.start && x + w <= wz.end;

  if (sA && ctx.sinkCab) {
    const m = pm(ctx.sinkCab, sA.position, wid);
    occ.push({ x: m.x, w: m.width, mod: m });
  }
  if (cA && ctx.plateCab) {
    const pw = inp.useInbuiltStove ? 600 : ctx.plateCab.width;
    const m = pm(ctx.plateCab, cA.position, wid, 'lower', { width: pw });
    occ.push({ x: m.x, w: pw, mod: m });
  }
  const sB = occ.find(o => o.mod.kind === CabinetKind.SINK);
  // Dishwasher
  if (ctx.dishwasherCab && sB) {
    const dw = ctx.dishwasherCab.width;
    const dx = sL ? sB.x + sB.w : sB.x - dw;
    if (inW(dx, dw) && !ov(dx, dw))
      occ.push({ x: dx, w: dw, mod: pm(ctx.dishwasherCab, dx, wid) });
  }
  // Drawer
  if (ctx.drawerCab && sB) {
    const dw = ctx.drawerCab.width;
    const dwB = occ.find(o => o.mod.article.startsWith(ARTICLE_PREFIX.DISHWASHER));
    const af = dwB ?? sB;
    let dx = sL ? af.x + af.w : af.x - dw;
    if (!inW(dx, dw) || ov(dx, dw)) dx = sL ? sB.x - dw : sB.x + sB.w;
    if (inW(dx, dw) && !ov(dx, dw))
      occ.push({ x: dx, w: dw, mod: pm(ctx.drawerCab, dx, wid) });
  }
  // Side panel
  if (ctx.sidePanelCab) {
    const pB = occ.find(o => o.mod.kind === CabinetKind.PLATE);
    const chain = occ.filter(o => o.mod.kind === CabinetKind.SINK ||
      o.mod.article.startsWith(ARTICLE_PREFIX.DISHWASHER) ||
      (o.mod.kind === CabinetKind.DRAWER_UNIT && o.mod.article.startsWith('СЯШ')));
    if (chain.length && pB) {
      const ce = sL ? Math.max(...chain.map(o => o.x + o.w)) : Math.min(...chain.map(o => o.x));
      const pe = sL ? pB.x : pB.x + pB.w;
      const gap = sL ? pe - ce : ce - pe;
      if (gap === SIDE_PANEL_WIDTH) {
        const sx = sL ? ce : pe;
        if (!ov(sx, SIDE_PANEL_WIDTH))
          occ.push({ x: sx, w: SIDE_PANEL_WIDTH, mod: pm(ctx.sidePanelCab, sx, wid) });
      } else if (inp.useSidePanel200 && gap > SIDE_PANEL_WIDTH) {
        const sx = sL ? ce : ce - SIDE_PANEL_WIDTH;
        if (inW(sx, SIDE_PANEL_WIDTH) && !ov(sx, SIDE_PANEL_WIDTH))
          occ.push({ x: sx, w: SIDE_PANEL_WIDTH, mod: pm(ctx.sidePanelCab, sx, wid) });
      }
    }
  }

  occ.sort((a, b) => a.x - b.x);
  const segs: Seg[] = [];
  let cur = wz.start;
  for (const o of occ) {
    if (o.x > cur) segs.push({ start: cur, end: o.x, w: o.x - cur });
    cur = Math.max(cur, o.x + o.w);
  }
  if (wz.end > cur) segs.push({ start: cur, end: wz.end, w: wz.end - cur });
  // Don't reject tiny segments — fillSegs will handle them as fillers or slack
  return { occ, segs };
}

// ── Step 5: DP fill with fallback cascade ──────────────────────────────────────

/** Try to fill a single segment. Returns modules+fillers or null. */
function fillOneSeg(
  s: Seg, wid: string, ctx: Ctx, cookCtr: number | null,
): { mods: PlacedModule[]; fills: PlacedModule[] } | null {
  const mods: PlacedModule[] = [];
  const fills: PlacedModule[] = [];

  // Try 1: ALLOWED_WIDTHS (ideal — all tiers compatible)
  let r = canFillWithFiller(s.w, ctx.ALLOWED_WIDTHS);
  let useWidths = ctx.ALLOWED_WIDTHS;

  // Try 2: fall back to ALL LOWER_WIDTHS (may lack antresol for some)
  if (!r.possible) {
    r = canFillWithFiller(s.w, ctx.LOWER_WIDTHS);
    useWidths = ctx.LOWER_WIDTHS;
  }

  // Try 3: segment ≤ 300mm → entire filler
  if (!r.possible && s.w <= 300) {
    fills.push(fil(s.start, s.w, wid));
    return { mods, fills };
  }

  if (!r.possible) return null;

  const target = s.w - r.fillerWidth;
  const ws = target > 0 ? findBestFill(target, useWidths) : [];
  let cx = s.start;
  for (const w of ws) {
    const near = cookCtr !== null && Math.abs(cx + w / 2 - cookCtr) <= 800;
    let cab = near ? ctx.lowerCabs.find(c => Math.abs(c.width - w) <= W_TOL && c.kind === CabinetKind.DRAWER_UNIT) : null;
    if (!cab) cab = ctx.lowerCabs.find(c => Math.abs(c.width - w) <= W_TOL && c.kind === CabinetKind.DOOR);
    if (!cab) cab = ctx.lowerCabs.find(c => Math.abs(c.width - w) <= W_TOL);
    if (!cab) return null;
    mods.push(pm(cab, cx, wid, 'lower', { width: w }));
    cx += w;
  }
  if (r.fillerWidth > 0) fills.push(fil(cx, r.fillerWidth, wid));
  return { mods, fills };
}

/**
 * Fill all free segments. The LAST segment (closest to fridge/wall edge)
 * gets special treatment: if it can't be filled exactly, we shrink it by
 * up to MAX_SLACK mm. The leftover becomes a gap next to the fridge —
 * acceptable per spec ("после холодильника можно оставить пустое место").
 */
const MAX_SLACK = 50; // max mm of acceptable gap near fridge

function fillSegs(segs: Seg[], wid: string, ctx: Ctx, cookCtr: number | null, wz: WZ) {
  const mods: PlacedModule[] = [];
  const fills: PlacedModule[] = [];
  let slack = 0; // accumulated unfillable space (goes next to fridge)

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.w <= 0) continue;

    // Tiny segments (≤ 50mm) → filler to keep continuity. Only the LAST
    // segment adjacent to the tall zone can become slack (invisible gap).
    if (s.w <= MIN_SEGMENT) {
      if (s.w > 0) {
        const isLastSeg = i === segs.length - 1;
        if (isLastSeg && s.end >= wz.end - 1) {
          // Last segment touching work zone boundary → slack (gap near fridge)
          slack += s.w;
        } else {
          fills.push(fil(s.start, s.w, wid));
        }
      }
      continue;
    }

    const result = fillOneSeg(s, wid, ctx, cookCtr);
    if (result) {
      mods.push(...result.mods);
      fills.push(...result.fills);
      continue;
    }

    // Segment can't be filled exactly. Try shrinking by 1mm up to MAX_SLACK.
    // This only works for edge segments touching the work zone boundary.
    const touchesWzEdge = (s.start <= wz.start + 1) || (s.end >= wz.end - 1);
    if (!touchesWzEdge) return null; // interior segment MUST fill exactly

    let filled = false;
    for (let shrink = 1; shrink <= MAX_SLACK; shrink++) {
      const reduced = s.w - shrink;
      if (reduced <= 0) break;

      // If reduced is tiny, just make it all a filler
      if (reduced <= MIN_SEGMENT) {
        fills.push(fil(s.start, reduced, wid));
        slack += shrink;
        filled = true;
        break;
      }
      if (reduced <= 300) {
        fills.push(fil(s.start, reduced, wid));
        slack += shrink;
        filled = true;
        break;
      }

      const shrunkSeg = { ...s, w: reduced, end: s.start + reduced };
      const res = fillOneSeg(shrunkSeg, wid, ctx, cookCtr);
      if (res) {
        mods.push(...res.mods);
        fills.push(...res.fills);
        slack += shrink;
        filled = true;
        break;
      }
    }

    if (!filled) return null;
  }

  return { mods, fills, slack };
}

// ── Step 6: Uppers (1:1 with tolerance + filler fallback) ──────────────────────
function solveUp(lower: PlacedModule[], wz: WZ, wid: string,
  ctx: Ctx, inp: PlannerInput, anch: Anchor[]): PlacedModule[] | null {
  const blocked: { s: number; e: number }[] = [];
  if (inp.useHood) {
    const c = anch.find(a => a.type === 'cooktop');
    if (c) blocked.push({ s: c.position, e: c.position + c.width });
  }
  const isB = (x: number, w: number) => blocked.some(b => x < b.e && x + w > b.s);

  const upByW = new Map<number, CabinetRead>();
  for (const c of ctx.upperSeries) if (!upByW.has(c.width)) upByW.set(c.width, c);

  // All lower-tier in work zone, deduplicated
  const ls = lower.filter(m => m.x >= wz.start && m.x + m.width <= wz.end)
    .sort((a, b) => a.x - b.x);
  const seen = new Set<number>();
  const uniq: PlacedModule[] = [];
  for (const m of ls) { if (!seen.has(m.x)) { seen.add(m.x); uniq.push(m); } }

  const ups: PlacedModule[] = [];
  for (const lo of uniq) {
    if (isB(lo.x, lo.width)) continue;

    if (lo.type === 'filler') {
      // Upper filler above lower filler
      ups.push(ufil(lo.x, lo.width, wid, ctx.UPPER_HEIGHT));
      continue;
    }

    // Find upper with ±5mm tolerance
    let cab: CabinetRead | null = null;
    for (const [uw, uc] of upByW) {
      if (Math.abs(uw - lo.width) <= W_TOL) { cab = uc; break; }
    }

    if (cab) {
      // FIX: use the lower module's width for the upper, not the upper cabinet's
      // nominal width. This prevents misalignment when upper width differs from
      // lower by up to W_TOL (e.g. П 601 has width=601, lower С 601 has width=600).
      ups.push(pm(cab, lo.x, wid, 'upper', { yOffset: UPPER_Y, height: ctx.UPPER_HEIGHT, width: lo.width }));
    } else {
      // No matching upper — place upper filler (fallback, small penalty in scoring)
      ups.push(ufil(lo.x, lo.width, wid, ctx.UPPER_HEIGHT));
    }
  }

  ups.sort((a, b) => a.x - b.x);
  return ups;
}

// ── Step 7: Antresols ──────────────────────────────────────────────────────────
function solveAnt(ups: PlacedModule[], talls: PlacedModule[],
  wid: string, wallH: number, ctx: Ctx): PlacedModule[] {
  const result: PlacedModule[] = [];

  const findAnt = (w: number, prefixes: string[]): CabinetRead | null => {
    for (const pfx of prefixes) {
      const cabs = ctx.antresolByPrefix.get(pfx) ?? [];
      const found = cabs.find(c => Math.abs(c.width - w) <= W_TOL);
      if (found) return found;
    }
    return null;
  };

  const upperAntresolY = UPPER_Y + ctx.UPPER_HEIGHT;

  // Over uppers
  for (const m of ups) {
    const cab = findAnt(m.width, ctx.upperPrefixes);
    if (cab && upperAntresolY + cab.height <= wallH) {
      // FIX: use the upper module's width for the antresol width to maintain
      // alignment (prevents edge mismatches from tolerance rounding).
      result.push(pm(cab, m.x, wid, 'antresol', { yOffset: upperAntresolY, width: m.width }));
    } else if (m.type === 'filler') {
      // FIX: place antresol-height filler above upper fillers to avoid visual
      // gaps in the antresol row when floorToCeiling=true.
      const antH = ctx.upperPrefixes.includes('ВПГ') ? 450 : 350;
      if (upperAntresolY + antH <= wallH) {
        result.push({
          id: nid(), cabinetId: -1, article: 'filler', x: m.x, width: m.width,
          height: antH, depth: 300, type: 'filler', wallId: wid, yOffset: upperAntresolY,
        });
      }
    }
    // If not found and not filler: skip silently (small gap under ceiling, acceptable)
  }

  // Over talls
  for (const m of talls) {
    let pfx: string[];
    if (m.kind === CabinetKind.FRIDGE) pfx = ['ГВПГ'];
    else if (m.kind === CabinetKind.PENAL || m.kind === CabinetKind.PENAL_APPLIANCE_HOUSING) pfx = ['ГПГ'];
    else continue;
    // FIX: antresol above a tall module sits on top of the tall module, not at
    // the generic upper-antresol Y.  Use the taller of (tallModuleHeight,
    // upperAntresolY) so that the antresol never overlaps the module below.
    const yOff = Math.max(m.height, upperAntresolY);
    const cab = findAnt(m.width, pfx);
    if (cab && yOff + cab.height <= wallH) {
      result.push(pm(cab, m.x, m.wallId, 'antresol', { yOffset: yOff, width: m.width }));
    }
  }

  return result;
}

// ── Step 8: Validate ───────────────────────────────────────────────────────────
function valid(p: Plan, inp: PlannerInput, wl: number): boolean {
  if (inp.roomDepth - LOWER_DEPTH < MIN_AISLE_CLEARANCE) return false;
  const all = [...p.lower, ...p.fillers, ...p.tall, ...p.upper, ...p.antresol];

  // No overlap per tier
  const tiers = new Map<string, PlacedModule[]>();
  const upperAntY = UPPER_Y + (p.upper[0]?.height ?? 720);
  for (const m of all) {
    let t: string;
    if (m.type === 'filler') {
      // FIX: classify fillers into proper tiers.  Antresol-height fillers
      // (yOffset >= upperAntY) go into 'antresol' tier, upper fillers into
      // 'upper', and the rest into 'lower'.
      if (m.yOffset != null && m.yOffset >= upperAntY) t = 'antresol';
      else if (m.yOffset != null) t = 'upper';
      else t = 'lower';
    } else {
      t = m.type;
    }
    const k = `${m.wallId}:${t}`;
    (tiers.get(k) ?? (tiers.set(k, []), tiers.get(k)!)).push(m);
  }
  for (const ms of tiers.values()) {
    ms.sort((a, b) => a.x - b.x);
    for (let i = 1; i < ms.length; i++)
      if (ms[i].x < ms[i - 1].x + ms[i - 1].width - 1) return false; // -1 for tolerance
  }

  // In bounds (allow small overshoot from slack adjustments)
  for (const m of all) if (m.x < -1 || m.x + m.width > wl + MAX_SLACK + 1) return false;

  return true;
}

// ── Step 9: Score ──────────────────────────────────────────────────────────────
function scorePlan(p: Plan, floorToCeiling: boolean = false): number {
  const nf = p.lower.filter(m => m.type !== 'filler');
  const fp = Math.min(p.fillers.length * 25, 100);
  const avg = nf.length > 0 ? nf.reduce((s, m) => s + m.width, 0) / nf.length : 400;
  const ws = Math.max(0, Math.min(100, ((avg - 200) / 400) * 100));
  const uq = new Set(nf.map(m => m.width)).size;
  const us = Math.max(0, 100 - (uq - 1) * 20);
  const sp = Math.min(p.cfg.shifts.reduce((s, h) => s + Math.abs(h.delta), 0) / 2, 100);

  // FIX: when floorToCeiling=true, heavily penalize antresol-tier gaps.
  // Count upper modules that have NO matching antresol (by x position).
  let antGapPenalty = 0;
  if (floorToCeiling) {
    const antXSet = new Set(p.antresol.map(a => a.x));
    const upperMissing = p.upper.filter(u => !antXSet.has(u.x));
    // Each missing antresol position is a visible gap — severe penalty
    antGapPenalty = Math.min(upperMissing.length * 30, 100);
  }

  const sc = 100 - fp * 0.3 - (100 - ws) * 0.15 - (100 - us) * 0.15 - sp * 0.15 - antGapPenalty * 0.25;
  return Math.round(Math.max(0, Math.min(100, sc)) * 100) / 100;
}

// ── Step 10: Output ────────────────────────────────────────────────────────────
function buildOut(p: Plan, wid: string, rank: number): SolverVariant {
  const c = (s: number): CategoryDetail => ({ score: s, subMetrics: {} });
  const bd: ScoreBreakdown = {
    hardConstraintsPassed: true, violations: [],
    ergonomics: c(p.score), workflow: c(p.score), aesthetics: c(p.score),
    manufacturability: c(p.score), preferences: c(p.score),
  };
  const mods = [...p.lower, ...p.fillers, ...p.tall, ...p.upper, ...p.antresol].sort((a, b) => a.x - b.x);
  return {
    plan: {
      walls: [{ wallId: wid, modules: mods, anchors: p.cfg.anchors,
        anchorShifts: p.cfg.shifts.length ? p.cfg.shifts : undefined }],
      cornerModules: [], score: p.score, scoreBreakdown: bd,
      anchorShifts: p.cfg.shifts.length ? p.cfg.shifts : undefined,
    },
    rank,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function planKitchen(input: PlannerInput): SolverVariant[] {
  resetModuleCounter();
  const ctx = prepCtx(input);
  if (!input.walls.length) return [];

  const wall = input.walls[0];
  const wl = wall.length;
  const { wz, tall } = zones(wl, input.fridgeSide, ctx);
  const cfgs = genCfgs(wall.anchors, wz);
  const plans: Plan[] = [];

  for (const cfg of cfgs) {
    _id = 0;
    const sp = placeSpec(cfg.anchors, wz, wall.id, ctx, input);
    if (!sp) continue;

    const ckA = cfg.anchors.find(a => a.type === 'cooktop');
    const ckC = ckA ? ckA.position + ckA.width / 2 : null;
    const fill = fillSegs(sp.segs, wall.id, ctx, ckC, wz);
    if (!fill) continue;

    const specL = sp.occ.map(o => o.mod).filter(m => m.type === 'lower');
    const specF = sp.occ.filter(o => o.mod.type === 'filler').map(o => o.mod);
    const lower = [...specL, ...fill.mods];
    const fillers = [...specF, ...fill.fills];

    // Tall modules — fridge goes FLUSH against last lower module.
    // Slack (unfillable mm) goes between penal and the WALL (or fridge and wall if no penal).
    // RULE: NO gap between any furniture. Gap only allowed against the wall.
    const tallMs: PlacedModule[] = [];
    const slack = fill.slack ?? 0;
    if (tall && ctx.fridgeCab) {
      // Find where the last lower-tier module ends
      const allLower = [...lower, ...fillers].filter(m => m.yOffset == null);
      const lastLowerEnd = allLower.length > 0
        ? Math.max(...allLower.map(m => m.x + m.width))
        : wz.start;

      if (input.fridgeSide === 'right') {
        // Fridge flush with last cabinet, penal flush with fridge, gap at wall end
        const fridgeX = lastLowerEnd;
        tallMs.push(pm(ctx.fridgeCab, fridgeX, wall.id, 'tall'));
        if (tall.hasPenal && ctx.penalCab) {
          tallMs.push(pm(ctx.penalCab, fridgeX + ctx.fridgeCab.width, wall.id, 'tall'));
        }
      } else {
        // left side: penal at wall start (gap between wall and penal), fridge flush with penal
        // Then work zone starts after fridge
        if (tall.hasPenal && ctx.penalCab) {
          const penalX = 0; // penal at wall start
          tallMs.push(pm(ctx.penalCab, penalX, wall.id, 'tall'));
          tallMs.push(pm(ctx.fridgeCab, penalX + ctx.penalCab.width, wall.id, 'tall'));
        } else {
          tallMs.push(pm(ctx.fridgeCab, 0, wall.id, 'tall'));
        }
        // Gap (slack) is between last lower and wall end — that's fine
      }
    }

    // All lower-tier for upper alignment (cabinets + fillers)
    const allLowerTier = [...lower, ...fillers].sort((a, b) => a.x - b.x);
    const ups = solveUp(allLowerTier, wz, wall.id, ctx, input, cfg.anchors);
    if (!ups) continue;

    const ant = input.floorToCeiling ? solveAnt(ups, tallMs, wall.id, input.wallHeight, ctx) : [];

    const plan: Plan = { lower, upper: ups, antresol: ant, tall: tallMs, fillers, cfg, score: 0 };
    if (!valid(plan, input, wl)) continue;
    plan.score = scorePlan(plan, input.floorToCeiling);
    plans.push(plan);
  }

  plans.sort((a, b) => b.score - a.score);
  resetModuleCounter();
  return plans.slice(0, 10).map((p, i) => buildOut(p, wall.id, i + 1));
}
