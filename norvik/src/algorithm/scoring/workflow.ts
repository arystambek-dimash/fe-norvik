import type { KitchenPlan, PlacedModule } from '../types';
import type { ScoringContext, CategoryDetail } from './types';
import { allModules, anchorCenter, getWallLength, moduleCenter } from './helpers';
import { CabinetKind } from '@/types/enums';
import {
  ARTICLE_PREFIX,
  DRAWER_COOKTOP_RADIUS,
  DISHWASHER_ADJACENCY_GAP,
  TALL_EDGE_THRESHOLD,
  SCORE_SINK_NO_BASE,
  SCORE_DW_NOT_ADJACENT,
  SCORE_ZONE_REVERSED,
  SCORE_NO_TALL_UNITS,
} from '../constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wall length looked up by wallId (assumes "wall-0", "wall-1" naming). */
function wallLengthById(wallId: string, plan: KitchenPlan, context: ScoringContext): number {
  const index = plan.walls.findIndex((w) => w.wallId === wallId);
  return index >= 0 ? getWallLength(index, context) : context.roomWidth;
}

/** Check whether two 1-D ranges [aStart, aEnd) and [bStart, bEnd) overlap. */
function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Whether a module is a drawer unit (by CabinetKind). */
function isDrawerModule(m: PlacedModule): boolean {
  return m.kind === CabinetKind.DRAWER_UNIT;
}

/** Whether a module is a dishwasher (by article prefix "ПММ" — no dedicated kind yet). */
function isDishwasherModule(m: PlacedModule): boolean {
  return m.article.startsWith(ARTICLE_PREFIX.DISHWASHER);
}

// ---------------------------------------------------------------------------
// Sub-metric scorers (each returns 0 – 100)
// ---------------------------------------------------------------------------

/**
 * 1. sinkBasePresent (25 %)
 * Check if there is a lower module positioned at each sink anchor location.
 */
function scoreSinkBasePresent(plan: KitchenPlan, context: ScoringContext): number {
  const sinkAnchors = context.anchors.filter((a) => a.type === 'sink');
  if (sinkAnchors.length === 0) return 50; // neutral

  const modules = allModules(plan);

  const scores = sinkAnchors.map((anchor) => {
    const anchorStart = anchor.position;
    const anchorEnd = anchor.position + anchor.width;

    const hasBase = modules.some(
      (m) =>
        m.type === 'lower' &&
        m.wallId === anchor.wallId &&
        rangesOverlap(m.x, m.x + m.width, anchorStart, anchorEnd),
    );

    return hasBase ? 100 : SCORE_SINK_NO_BASE;
  });

  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * 2. drawersNearCooktop (20 %)
 * Favour drawer-type modules within DRAWER_COOKTOP_RADIUS of the cooktop centre.
 */
function scoreDrawersNearCooktop(plan: KitchenPlan, context: ScoringContext): number {
  const cooktopAnchors = context.anchors.filter((a) => a.type === 'cooktop');
  if (cooktopAnchors.length === 0) return 50; // neutral

  const modules = allModules(plan);

  const scores = cooktopAnchors.map((anchor) => {
    const center = anchorCenter(anchor);

    const nearby = modules.filter(
      (m) =>
        m.wallId === anchor.wallId &&
        m.type === 'lower' &&
        Math.abs(moduleCenter(m) - center) <= DRAWER_COOKTOP_RADIUS,
    );

    if (nearby.length === 0) return 50;

    const drawerCount = nearby.filter(isDrawerModule).length;
    return (drawerCount / nearby.length) * 100;
  });

  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * 3. dishwasherAdjacency (20 %)
 * Dishwasher should be adjacent to the sink (within DISHWASHER_ADJACENCY_GAP, same wall).
 */
function scoreDishwasherAdjacency(plan: KitchenPlan, context: ScoringContext): number {
  const sinkAnchors = context.anchors.filter((a) => a.type === 'sink');
  const modules = allModules(plan);
  const dishwashers = modules.filter(isDishwasherModule);

  if (dishwashers.length === 0) return 50; // no dishwasher — neutral
  if (sinkAnchors.length === 0) return 50;

  for (const sink of sinkAnchors) {
    const sinkStart = sink.position;
    const sinkEnd = sink.position + sink.width;

    for (const dw of dishwashers) {
      if (dw.wallId !== sink.wallId) continue;

      const dwStart = dw.x;
      const dwEnd = dw.x + dw.width;

      // Gap between edges (negative means they overlap — still adjacent)
      const gap = Math.max(dwStart - sinkEnd, sinkStart - dwEnd);

      if (gap <= DISHWASHER_ADJACENCY_GAP) return 100;
    }
  }

  // Dishwasher exists but is not adjacent to any sink
  return SCORE_DW_NOT_ADJACENT;
}

/**
 * 4. zoneOrdering (20 %)
 * Ideal linear order: storage/fridge → sink/prep → cooktop.
 * We approximate by checking that the sink anchor is before the cooktop anchor.
 */
function scoreZoneOrdering(context: ScoringContext): number {
  const sinkAnchors = context.anchors.filter((a) => a.type === 'sink');
  const cooktopAnchors = context.anchors.filter((a) => a.type === 'cooktop');

  if (sinkAnchors.length === 0 || cooktopAnchors.length === 0) return 50; // can't determine

  // Compare first matching pair on the same wall
  for (const sink of sinkAnchors) {
    for (const cooktop of cooktopAnchors) {
      if (sink.wallId !== cooktop.wallId) continue;

      const sinkCenter = anchorCenter(sink);
      const cooktopCenter = anchorCenter(cooktop);

      if (sinkCenter < cooktopCenter) return 100; // correct order
      return SCORE_ZONE_REVERSED; // reversed but still usable
    }
  }

  return 50; // anchors on different walls — can't determine
}

/**
 * 5. tallUnitPlacement (15 %)
 * Tall units should sit at wall edges, not in the middle.
 */
function scoreTallUnitPlacement(plan: KitchenPlan, context: ScoringContext): number {
  const modules = allModules(plan);
  const tallModules = modules.filter((m) => m.type === 'tall');

  if (tallModules.length === 0) return SCORE_NO_TALL_UNITS; // neutral — no tall units is fine

  let edgePlaced = 0;

  for (const m of tallModules) {
    const wallLength = wallLengthById(m.wallId, plan, context);
    const distFromStart = m.x;
    const distFromEnd = wallLength - (m.x + m.width);

    if (distFromStart <= TALL_EDGE_THRESHOLD || distFromEnd <= TALL_EDGE_THRESHOLD) {
      edgePlaced++;
    }
  }

  return (edgePlaced / tallModules.length) * 100;
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

const SUB_WEIGHTS = {
  sinkBasePresent: 0.25,
  drawersNearCooktop: 0.20,
  dishwasherAdjacency: 0.20,
  zoneOrdering: 0.20,
  tallUnitPlacement: 0.15,
} as const;

export function scoreWorkflow(plan: KitchenPlan, context: ScoringContext): CategoryDetail {
  const subMetrics: Record<string, number> = {
    sinkBasePresent: scoreSinkBasePresent(plan, context),
    drawersNearCooktop: scoreDrawersNearCooktop(plan, context),
    dishwasherAdjacency: scoreDishwasherAdjacency(plan, context),
    zoneOrdering: scoreZoneOrdering(context),
    tallUnitPlacement: scoreTallUnitPlacement(plan, context),
  };

  const score =
    subMetrics.sinkBasePresent * SUB_WEIGHTS.sinkBasePresent +
    subMetrics.drawersNearCooktop * SUB_WEIGHTS.drawersNearCooktop +
    subMetrics.dishwasherAdjacency * SUB_WEIGHTS.dishwasherAdjacency +
    subMetrics.zoneOrdering * SUB_WEIGHTS.zoneOrdering +
    subMetrics.tallUnitPlacement * SUB_WEIGHTS.tallUnitPlacement;

  return {
    score: Math.round(score * 100) / 100,
    subMetrics,
  };
}
