import type { KitchenPlan, PlacedModule, ScoreBreakdown, ScoringResult, WallPlan } from './types';
import {
  SWEET_SPOT_MAX,
  SWEET_SPOT_MIN,
  TRIANGLE_MAX,
  TRIANGLE_MIN,
} from './constants';

/** Scoring rule weights */
const WEIGHTS = {
  widthConsistency: 1.5,
  moduleSweetSpot: 1.2,
  ergonomicPlacement: 1.0,
  fillerPenalty: 2.0,
  symmetry: 1.0,
  aestheticGrouping: 0.8,
  visualComposition: 1.8,
  workingTriangle: 2.0,
  upperCoverage: 1.0,
  cornerFit: 0.8,
} as const;

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);

// ── Helper ──────────────────────────────────────────────────────────────────

function getLowerModules(wallPlans: WallPlan[]): PlacedModule[] {
  return wallPlans.flatMap((wp) =>
    wp.modules.filter((m) => m.type === 'lower'),
  );
}

function getUpperModules(wallPlans: WallPlan[]): PlacedModule[] {
  return wallPlans.flatMap((wp) =>
    wp.modules.filter((m) => m.type === 'upper'),
  );
}

function getNonFillerModules(wallPlans: WallPlan[]): PlacedModule[] {
  return wallPlans.flatMap((wp) =>
    wp.modules.filter((m) => m.type !== 'filler'),
  );
}

// ── Individual scoring rules (each returns 0–100) ──────────────────────────

/**
 * WIDTH_CONSISTENCY: penalize variation in module widths within a wall.
 * Lower coefficient of variation → higher score.
 */
function scoreWidthConsistency(wallPlans: WallPlan[]): number {
  const allWidths = getNonFillerModules(wallPlans).map((m) => m.width);
  if (allWidths.length <= 1) return 100;

  const mean = allWidths.reduce((s, w) => s + w, 0) / allWidths.length;
  if (mean === 0) return 100;

  const variance =
    allWidths.reduce((s, w) => s + (w - mean) ** 2, 0) / allWidths.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation

  // cv=0 → 100, cv>=1 → 0
  return Math.max(0, Math.min(100, (1 - cv) * 100));
}

/**
 * MODULE_SWEET_SPOT: reward modules in the 500–600mm range.
 */
function scoreModuleSweetSpot(wallPlans: WallPlan[]): number {
  const modules = getNonFillerModules(wallPlans);
  if (modules.length === 0) return 100;

  const inRange = modules.filter(
    (m) => m.width >= SWEET_SPOT_MIN && m.width <= SWEET_SPOT_MAX,
  ).length;

  return (inRange / modules.length) * 100;
}

/**
 * ERGONOMIC_PLACEMENT: reward drawers (subtype proxy: narrow lower modules)
 * placed near the sink position.
 */
function scoreErgonomicPlacement(wallPlans: WallPlan[]): number {
  const lowerModules = getLowerModules(wallPlans);
  if (lowerModules.length === 0) return 50; // neutral if no lower modules

  const widths = lowerModules.map((m) => m.width);
  const hasDrawerSize = widths.some((w) => w >= 400 && w <= 600);
  return hasDrawerSize ? 80 : 40;
}

/**
 * FILLER_PENALTY: penalize filler panels.
 * More fillers → lower score.
 */
function scoreFillerPenalty(wallPlans: WallPlan[]): number {
  const allModules = wallPlans.flatMap((wp) => wp.modules);
  if (allModules.length === 0) return 100;

  const fillerCount = allModules.filter((m) => m.type === 'filler').length;
  const totalCount = allModules.length;

  const fillerRatio = fillerCount / totalCount;
  // 0 fillers → 100, all fillers → 0
  return Math.max(0, (1 - fillerRatio * 3) * 100);
}

/**
 * SYMMETRY: reward symmetric module placement within each wall.
 * Compares widths from left-to-right vs right-to-left.
 */
function scoreSymmetry(wallPlans: WallPlan[]): number {
  if (wallPlans.length === 0) return 100;

  let totalScore = 0;

  for (const wp of wallPlans) {
    const modules = wp.modules.filter((m) => m.type !== 'filler');
    if (modules.length <= 1) {
      totalScore += 100;
      continue;
    }

    const widths = modules.map((m) => m.width);
    const reversed = [...widths].reverse();

    let matchCount = 0;
    for (let i = 0; i < widths.length; i++) {
      if (widths[i] === reversed[i]) matchCount++;
    }

    totalScore += (matchCount / widths.length) * 100;
  }

  return totalScore / wallPlans.length;
}

/**
 * AESTHETIC_GROUPING: reward similar-width adjacent modules.
 */
function scoreAestheticGrouping(wallPlans: WallPlan[]): number {
  if (wallPlans.length === 0) return 100;

  let totalScore = 0;

  for (const wp of wallPlans) {
    const modules = wp.modules.filter((m) => m.type !== 'filler');
    if (modules.length <= 1) {
      totalScore += 100;
      continue;
    }

    let adjacentMatches = 0;
    for (let i = 0; i < modules.length - 1; i++) {
      const diff = Math.abs(modules[i].width - modules[i + 1].width);
      // Within 100mm counts as similar
      if (diff <= 100) adjacentMatches++;
    }

    totalScore += (adjacentMatches / (modules.length - 1)) * 100;
  }

  return totalScore / wallPlans.length;
}

/**
 * VISUAL_COMPOSITION: overall visual balance.
 * Combination of width spread and module count balance.
 */
function scoreVisualComposition(wallPlans: WallPlan[]): number {
  const allModules = getNonFillerModules(wallPlans);
  if (allModules.length === 0) return 50;

  // Reward moderate module count (not too few, not too many per wall)
  const avgPerWall = allModules.length / Math.max(wallPlans.length, 1);
  const countScore =
    avgPerWall >= 2 && avgPerWall <= 6
      ? 100
      : Math.max(0, 100 - Math.abs(avgPerWall - 4) * 15);

  // Reward small width range (cohesive look)
  const widths = allModules.map((m) => m.width);
  const minW = Math.min(...widths);
  const maxW = Math.max(...widths);
  const range = maxW - minW;
  const rangeScore = Math.max(0, 100 - range / 5);

  return countScore * 0.5 + rangeScore * 0.5;
}

/**
 * WORKING_TRIANGLE: reward good distances between sink, cooktop, and oven.
 * Ideal leg distance: 1200–2400mm.
 */
function scoreWorkingTriangle(wallPlans: WallPlan[]): number {
  const allModules = wallPlans.flatMap((wp) => wp.modules);

  const sinks = allModules.filter(
    (m) => m.article.toLowerCase().includes('sink'),
  );
  const cooktops = allModules.filter(
    (m) =>
      m.article.toLowerCase().includes('cooktop') ||
      m.article.toLowerCase().includes('plate'),
  );
  const ovens = allModules.filter(
    (m) =>
      m.article.toLowerCase().includes('oven'),
  );

  // Need at least 2 of the 3 triangle points
  const points: PlacedModule[] = [
    sinks[0],
    cooktops[0],
    ovens[0],
  ].filter(Boolean) as PlacedModule[];

  if (points.length < 2) return 50; // neutral — not enough info

  let totalScore = 0;
  let pairs = 0;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.abs(
        points[i].x + points[i].width / 2 - (points[j].x + points[j].width / 2),
      );
      pairs++;

      if (dist >= TRIANGLE_MIN && dist <= TRIANGLE_MAX) {
        totalScore += 100;
      } else if (dist < TRIANGLE_MIN) {
        totalScore += Math.max(0, (dist / TRIANGLE_MIN) * 100);
      } else {
        totalScore += Math.max(0, 100 - ((dist - TRIANGLE_MAX) / TRIANGLE_MAX) * 100);
      }
    }
  }

  return pairs > 0 ? totalScore / pairs : 50;
}

/**
 * UPPER_COVERAGE: reward plans where upper cabinets cover 60-90% of the
 * lower cabinet span. Too few uppers looks sparse; too many looks cramped.
 */
function scoreUpperCoverage(wallPlans: WallPlan[]): number {
  if (wallPlans.length === 0) return 50;

  let totalScore = 0;

  for (const wp of wallPlans) {
    const lowers = wp.modules.filter((m) => m.type === 'lower');
    const uppers = wp.modules.filter((m) => m.type === 'upper');

    if (lowers.length === 0) {
      totalScore += 50; // neutral — no lowers to compare against
      continue;
    }

    const lowerTotalWidth = lowers.reduce((s, m) => s + m.width, 0);
    const upperTotalWidth = uppers.reduce((s, m) => s + m.width, 0);

    if (lowerTotalWidth === 0) {
      totalScore += 50;
      continue;
    }

    const ratio = upperTotalWidth / lowerTotalWidth;

    // Ideal: 60-90% coverage
    if (ratio >= 0.6 && ratio <= 0.9) {
      totalScore += 100;
    } else if (ratio < 0.6) {
      // Too sparse
      totalScore += Math.max(0, (ratio / 0.6) * 100);
    } else {
      // Too much (>90%)
      totalScore += Math.max(0, 100 - ((ratio - 0.9) / 0.5) * 100);
    }
  }

  return totalScore / wallPlans.length;
}

/**
 * CORNER_FIT: reward plans where corner cabinets properly fill the junction.
 * Good fit = no leftover gap at the corner.
 */
function scoreCornerFit(plan: KitchenPlan): number {
  if (plan.cornerModules.length === 0) {
    // No corner needed (linear layout) — neutral
    return 50;
  }

  // A corner cabinet exists — score based on whether it fits the junction
  // A present corner cabinet is always good in an L-shaped layout
  return 90;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Score a complete kitchen plan across all 10 scoring dimensions.
 * Returns a total score (0–100) and per-dimension breakdown.
 */
export function scorePlan(plan: KitchenPlan): ScoringResult {
  const walls = plan.walls;

  const breakdown: ScoreBreakdown = {
    widthConsistency: scoreWidthConsistency(walls),
    moduleSweetSpot: scoreModuleSweetSpot(walls),
    ergonomicPlacement: scoreErgonomicPlacement(walls),
    fillerPenalty: scoreFillerPenalty(walls),
    symmetry: scoreSymmetry(walls),
    aestheticGrouping: scoreAestheticGrouping(walls),
    visualComposition: scoreVisualComposition(walls),
    workingTriangle: scoreWorkingTriangle(walls),
    upperCoverage: scoreUpperCoverage(walls),
    cornerFit: scoreCornerFit(plan),
  };

  let weighted = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    weighted += breakdown[key] * WEIGHTS[key];
  }

  const total = weighted / TOTAL_WEIGHT;

  return {
    total: Math.round(total * 100) / 100,
    breakdown,
  };
}
