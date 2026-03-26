import type { KitchenPlan } from '../types';
import type { ScoringContext, CategoryDetail, ScoringAnchor } from './types';
import { smoothScore, toPercent } from './smooth';
import { allModules, anchorCenter } from './helpers';
import {
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

  const dist = anchorDistance(sink, cooktop, ctx);
  return {
    prepZone: toPercent(smoothScore(dist, PREP_ZONE_MIN, PREP_ZONE_MAX, PREP_ZONE_TOLERANCE)),
    sinkHobDistance: toPercent(smoothScore(dist, SINK_HOB_MIN, SINK_HOB_MAX, SINK_HOB_TOLERANCE)),
  };
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
  prepZone: 0.25,
  sinkHobDistance: 0.20,
  aisleClearance: 0.20,
  landingArea: 0.20,
  workingTriangle: 0.15,
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
  };

  const score =
    subMetrics.prepZone * SUB_WEIGHTS.prepZone +
    subMetrics.sinkHobDistance * SUB_WEIGHTS.sinkHobDistance +
    subMetrics.aisleClearance * SUB_WEIGHTS.aisleClearance +
    subMetrics.landingArea * SUB_WEIGHTS.landingArea +
    subMetrics.workingTriangle * SUB_WEIGHTS.workingTriangle;

  return {
    score: Math.round(score * 100) / 100,
    subMetrics,
  };
}
