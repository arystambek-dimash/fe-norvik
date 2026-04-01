import type { KitchenPlan } from '../types';
import type { ScoringContext, CategoryDetail, ScoringAnchor } from './types';
import { smoothScore, toPercent } from './smooth';
import { allModules, anchorCenter, getWallLength } from './helpers';
import {
  CONTINUOUS_COUNTERTOP_MIN,
  CONTINUOUS_COUNTERTOP_MAX,
  CONTINUOUS_COUNTERTOP_TOLERANCE,
  LOWER_DEPTH,
  PREP_ZONE_MIN,
  PREP_ZONE_MAX,
  PREP_ZONE_TOLERANCE,
  SINK_HOB_MIN,
  SINK_HOB_MAX,
  SINK_HOB_TOLERANCE,
  AISLE_IDEAL_MIN,
  AISLE_IDEAL_MAX,
  AISLE_TOLERANCE,
  LANDING_MIN_WIDTH,
  LANDING_ADJACENCY_GAP,
  TRIANGLE_2PT_MIN,
  TRIANGLE_2PT_MAX,
  TRIANGLE_2PT_TOLERANCE,
  TRIANGLE_3PT_MIN,
  TRIANGLE_3PT_MAX,
  TRIANGLE_3PT_TOLERANCE,
} from '../constants';

/**
 * Distance between two anchors.
 * Same wall → absolute difference of centers.
 * Different walls → Manhattan approximation using room geometry.
 */
function anchorDistance(
  a: ScoringAnchor,
  b: ScoringAnchor,
  ctx: ScoringContext,
): number {
  if (a.wallId === b.wallId) {
    return Math.abs(anchorCenter(a) - anchorCenter(b));
  }

  // Cross-wall: Manhattan distance — distance from each anchor to the shared
  // corner plus the perpendicular offset along the other wall.
  const wallLength = (id: string) =>
    id === a.wallId ? ctx.roomWidth : ctx.roomDepth;

  const distAToCorner = wallLength(a.wallId) - anchorCenter(a);
  const distBFromCorner = anchorCenter(b);
  return distAToCorner + distBFromCorner;
}

function findAnchor(
  anchors: ScoringAnchor[],
  type: ScoringAnchor['type'],
): ScoringAnchor | undefined {
  return anchors.find((a) => a.type === type);
}

function anchorEdgeGap(a: ScoringAnchor, b: ScoringAnchor): number | null {
  if (a.wallId !== b.wallId) return null;
  const aEnd = a.position + a.width;
  const bEnd = b.position + b.width;
  return Math.max(0, Math.max(b.position - aEnd, a.position - bEnd));
}

function wallLengthById(
  wallId: string,
  plan: KitchenPlan,
  context: ScoringContext,
): number {
  const index = plan.walls.findIndex((wall) => wall.wallId === wallId);
  return index >= 0 ? getWallLength(index, context) : context.roomWidth;
}

// ---------------------------------------------------------------------------
// Sub-metric scorers
// ---------------------------------------------------------------------------

/**
 * 1. Prep zone + sink-hob distance — computed together since both
 * measure the same sink↔cooktop gap with different ideal ranges.
 * prepZone: ideal PREP_ZONE_MIN–PREP_ZONE_MAX (landing/counter space)
 * sinkHobDistance: ideal SINK_HOB_MIN–SINK_HOB_MAX (centre-to-centre comfort)
 */
function scoreSinkCooktopMetrics(ctx: ScoringContext): { prepZone: number; sinkHobDistance: number } {
  const sink = findAnchor(ctx.anchors, 'sink');
  const cooktop = findAnchor(ctx.anchors, 'cooktop');
  if (!sink || !cooktop) return { prepZone: 50, sinkHobDistance: 50 };

  const edgeGap = anchorEdgeGap(sink, cooktop);
  const centerDist = anchorDistance(sink, cooktop, ctx);
  return {
    prepZone: edgeGap == null
      ? 50
      : toPercent(smoothScore(edgeGap, PREP_ZONE_MIN, PREP_ZONE_MAX, PREP_ZONE_TOLERANCE)),
    sinkHobDistance: toPercent(smoothScore(centerDist, SINK_HOB_MIN, SINK_HOB_MAX, SINK_HOB_TOLERANCE)),
  };
}

function scoreContinuousCountertop(
  plan: KitchenPlan,
  ctx: ScoringContext,
): number {
  const runs = plan.walls
    .filter((wall) => wall.modules.some((m) => m.type === 'lower' || m.type === 'filler'))
    .map((wall) => {
      const wallAnchors = ctx.anchors
        .filter((anchor) => anchor.wallId === wall.wallId)
        .map((anchor) => ({ start: anchor.position, end: anchor.position + anchor.width }));
      const tallBlocks = wall.modules
        .filter((m) => m.type === 'tall')
        .map((m) => ({ start: m.x, end: m.x + m.width }));
      const blocks = [...wallAnchors, ...tallBlocks].sort((a, b) => a.start - b.start);

      let cursor = 0;
      let longest = 0;
      for (const block of blocks) {
        if (block.start > cursor) {
          longest = Math.max(longest, block.start - cursor);
        }
        cursor = Math.max(cursor, block.end);
      }

      return Math.max(longest, wallLengthById(wall.wallId, plan, ctx) - cursor);
    });

  if (runs.length === 0) return 50;
  const bestRun = Math.max(...runs);
  return toPercent(
    smoothScore(
      bestRun,
      CONTINUOUS_COUNTERTOP_MIN,
      CONTINUOUS_COUNTERTOP_MAX,
      CONTINUOUS_COUNTERTOP_TOLERANCE,
    ),
  );
}

/** 3. Aisle clearance — soft version of hard constraint (20%) */
function scoreAisleClearance(ctx: ScoringContext): number {
  const clearance = ctx.roomDepth - LOWER_DEPTH;
  return toPercent(smoothScore(clearance, AISLE_IDEAL_MIN, AISLE_IDEAL_MAX, AISLE_TOLERANCE));
}

/** 4. Landing area next to anchors (20%) */
function scoreLandingArea(
  plan: KitchenPlan,
  ctx: ScoringContext,
): number {
  const relevantTypes: ScoringAnchor['type'][] = ['sink', 'cooktop'];
  const targetAnchors = ctx.anchors.filter((a) =>
    relevantTypes.includes(a.type),
  );

  if (targetAnchors.length === 0) return 50;

  const modules = allModules(plan);
  let withLanding = 0;

  for (const anchor of targetAnchors) {
    const anchorLeft = anchor.position;
    const anchorRight = anchor.position + anchor.width;

    const hasGoodNeighbour = modules.some((m) => {
      if (m.wallId !== anchor.wallId) return false;
      if (m.type === 'filler') return false;
      if (m.width < LANDING_MIN_WIDTH) return false;

      const moduleLeft = m.x;
      const moduleRight = m.x + m.width;

      // Module is within LANDING_ADJACENCY_GAP on either side of the anchor
      const adjacentLeft = Math.abs(moduleRight - anchorLeft) <= LANDING_ADJACENCY_GAP;
      const adjacentRight = Math.abs(moduleLeft - anchorRight) <= LANDING_ADJACENCY_GAP;
      return adjacentLeft || adjacentRight;
    });

    if (hasGoodNeighbour) withLanding++;
  }

  return Math.round((withLanding / targetAnchors.length) * 100);
}

/** 5. Working triangle perimeter — sink + cooktop + oven (15%) */
function scoreWorkingTriangle(ctx: ScoringContext): number {
  const sink = findAnchor(ctx.anchors, 'sink');
  const cooktop = findAnchor(ctx.anchors, 'cooktop');
  const oven = findAnchor(ctx.anchors, 'oven');

  const points = [sink, cooktop, oven].filter(
    (a): a is ScoringAnchor => a !== undefined,
  );

  if (points.length < 2) return 50;

  // Sum all pairwise distances
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      perimeter += anchorDistance(points[i], points[j], ctx);
    }
  }

  // Ideal range is calibrated for 3 points; scale down for 2-point case
  if (points.length === 2) {
    return toPercent(smoothScore(perimeter, TRIANGLE_2PT_MIN, TRIANGLE_2PT_MAX, TRIANGLE_2PT_TOLERANCE));
  }
  return toPercent(smoothScore(perimeter, TRIANGLE_3PT_MIN, TRIANGLE_3PT_MAX, TRIANGLE_3PT_TOLERANCE));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SUB_WEIGHTS = {
  prepZone: 0.20,
  sinkHobDistance: 0.15,
  aisleClearance: 0.15,
  landingArea: 0.15,
  workingTriangle: 0.10,
  continuousCountertop: 0.25,
} as const;

export function scoreErgonomics(
  plan: KitchenPlan,
  context: ScoringContext,
): CategoryDetail {
  const sinkCooktop = scoreSinkCooktopMetrics(context);
  const subMetrics = {
    prepZone: sinkCooktop.prepZone,
    sinkHobDistance: sinkCooktop.sinkHobDistance,
    aisleClearance: scoreAisleClearance(context),
    landingArea: scoreLandingArea(plan, context),
    workingTriangle: scoreWorkingTriangle(context),
    continuousCountertop: scoreContinuousCountertop(plan, context),
  };

  const score =
    subMetrics.prepZone * SUB_WEIGHTS.prepZone +
    subMetrics.sinkHobDistance * SUB_WEIGHTS.sinkHobDistance +
    subMetrics.aisleClearance * SUB_WEIGHTS.aisleClearance +
    subMetrics.landingArea * SUB_WEIGHTS.landingArea +
    subMetrics.workingTriangle * SUB_WEIGHTS.workingTriangle +
    subMetrics.continuousCountertop * SUB_WEIGHTS.continuousCountertop;

  return {
    score: Math.round(score * 100) / 100,
    subMetrics,
  };
}
