import type { KitchenPlan, WallPlan } from '../types';
import type { CategoryDetail } from './types';
import { toPercent } from './smooth';
import { nonFillerModules, std } from './helpers';
import {
  RHYTHM_STD_DIVISOR,
  RHYTHM_UNIQUE_FACTOR,
  ADJACENT_WIDTH_TOLERANCE,
  SMALL_MODULE_THRESHOLD,
  FILLER_RATIO_MULTIPLIER,
  ALIGNMENT_TOLERANCE,
} from '../constants';

/**
 * Width rhythm — penalize chaotic width distribution (20%).
 * Low std-dev and few unique widths → high score.
 */
function scoreWidthRhythm(plan: KitchenPlan): number {
  const modules = nonFillerModules(plan);
  if (modules.length === 0) return 100;

  const widths = modules.map((m) => m.width);
  const uniqueWidthCount = new Set(widths).size;
  const rhythmPenalty = std(widths) / RHYTHM_STD_DIVISOR + uniqueWidthCount * RHYTHM_UNIQUE_FACTOR;

  return toPercent(1 - Math.min(1, rhythmPenalty));
}

/**
 * Symmetry — per wall, compare module widths left-to-right vs right-to-left (15%).
 * Walls with ≤ 1 module score 100.
 */
function scoreSymmetry(walls: WallPlan[]): number {
  if (walls.length === 0) return 100;

  const wallScores = walls.map((wall) => {
    const widths = wall.modules.filter((m) => m.type !== 'filler').map((m) => m.width);
    if (widths.length <= 1) return 100;

    const pairs = Math.floor(widths.length / 2);
    let matchCount = 0;
    for (let i = 0; i < pairs; i++) {
      if (widths[i] === widths[widths.length - 1 - i]) {
        matchCount++;
      }
    }
    return (matchCount / pairs) * 100;
  });

  return toPercent(
    wallScores.reduce((a, b) => a + b, 0) / wallScores.length / 100,
  );
}

/**
 * Adjacent grouping — pairs of adjacent non-filler modules with width difference
 * ≤ ADJACENT_WIDTH_TOLERANCE (15%).
 */
function scoreAdjacentGrouping(walls: WallPlan[]): number {
  if (walls.length === 0) return 100;

  const wallScores = walls.map((wall) => {
    const modules = wall.modules.filter((m) => m.type !== 'filler');
    if (modules.length <= 1) return 100;

    let adjacentMatches = 0;
    for (let i = 0; i < modules.length - 1; i++) {
      if (Math.abs(modules[i].width - modules[i + 1].width) <= ADJACENT_WIDTH_TOLERANCE) {
        adjacentMatches++;
      }
    }
    return (adjacentMatches / (modules.length - 1)) * 100;
  });

  return toPercent(
    wallScores.reduce((a, b) => a + b, 0) / wallScores.length / 100,
  );
}

/**
 * Small module penalty — penalize non-filler modules narrower than SMALL_MODULE_THRESHOLD (15%).
 */
function scoreSmallModulePenalty(plan: KitchenPlan): number {
  const modules = nonFillerModules(plan);
  if (modules.length === 0) return 100;

  const smallCount = modules.filter((m) => m.width < SMALL_MODULE_THRESHOLD).length;
  return toPercent(1 - smallCount / modules.length);
}

/**
 * Filler penalty — penalize high filler ratio (15%).
 * Scores visual clutter from fillers; manufacturability scores production cost separately.
 * 0 fillers → 100, ≥ 1/FILLER_RATIO_MULTIPLIER fillers → 0.
 */
function scoreFillerPenalty(walls: WallPlan[]): number {
  const all = walls.flatMap((w) => w.modules);
  if (all.length === 0) return 100;

  const fillerCount = all.filter((m) => m.type === 'filler').length;
  const fillerRatio = fillerCount / all.length;
  return toPercent(Math.max(0, 1 - fillerRatio * FILLER_RATIO_MULTIPLIER));
}

/**
 * Upper-lower alignment — reward when upper cabinet edges align with lower edges (20%).
 * Checks within ALIGNMENT_TOLERANCE. Good alignment = clean vertical lines.
 */
function scoreUpperLowerAlignment(walls: WallPlan[]): number {
  if (walls.length === 0) return 100;

  const wallScores = walls.map((wall) => {
    const lowerEdges = new Set<number>();
    const upperEdges: number[] = [];

    for (const m of wall.modules) {
      if (m.type === 'filler') continue;
      if (m.type === 'lower' || m.type === 'tall') {
        lowerEdges.add(m.x);
        lowerEdges.add(m.x + m.width);
      } else if (m.type === 'upper') {
        upperEdges.push(m.x);
        upperEdges.push(m.x + m.width);
      }
    }

    if (upperEdges.length === 0 || lowerEdges.size === 0) return 100;

    let aligned = 0;
    for (const edge of upperEdges) {
      for (const le of lowerEdges) {
        if (Math.abs(edge - le) <= ALIGNMENT_TOLERANCE) {
          aligned++;
          break;
        }
      }
    }

    return (aligned / upperEdges.length) * 100;
  });

  return toPercent(
    wallScores.reduce((a, b) => a + b, 0) / wallScores.length / 100,
  );
}

/**
 * Aesthetics scoring category (20% of total score).
 *
 * Evaluates visual harmony: width rhythm, symmetry, adjacent grouping,
 * small-module penalty, filler penalty, and upper-lower alignment.
 */
export function scoreAesthetics(plan: KitchenPlan): CategoryDetail {
  const { walls } = plan;

  const widthRhythm = scoreWidthRhythm(plan);
  const symmetry = scoreSymmetry(walls);
  const adjacentGrouping = scoreAdjacentGrouping(walls);
  const smallModulePenalty = scoreSmallModulePenalty(plan);
  const fillerPenalty = scoreFillerPenalty(walls);
  const upperLowerAlignment = scoreUpperLowerAlignment(walls);

  const score =
    widthRhythm * 0.10 +
    symmetry * 0.15 +
    adjacentGrouping * 0.15 +
    smallModulePenalty * 0.15 +
    fillerPenalty * 0.15 +
    upperLowerAlignment * 0.30;

  return {
    score: Math.round(score * 100) / 100,
    subMetrics: {
      widthRhythm,
      symmetry,
      adjacentGrouping,
      smallModulePenalty,
      fillerPenalty,
      upperLowerAlignment,
    },
  };
}
