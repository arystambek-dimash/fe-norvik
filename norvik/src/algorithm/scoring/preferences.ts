import type { KitchenPlan, WallPlan } from '../types';
import type { ScoringContext, CategoryDetail } from './types';
import { smoothScore, toPercent } from './smooth';
import { CabinetKind } from '@/types/enums';
import {
  DRAWER_RATIO_MIN,
  DRAWER_RATIO_MAX,
  DRAWER_RATIO_TOLERANCE,
  UPPER_COVERAGE_MIN,
  UPPER_COVERAGE_MAX,
  UPPER_COVERAGE_TOLERANCE,
} from '../constants';

/**
 * Upper continuity — penalizes gaps between upper cabinets on the same wall.
 * Continuous upper runs → high score. Isolated uppers with gaps → low score.
 */
function scoreUpperContinuity(walls: WallPlan[]): number {
  const wallScores = walls.map((wall) => {
    const uppers = wall.modules
      .filter((m) => m.type === 'upper')
      .sort((a, b) => a.x - b.x);

    if (uppers.length <= 1) return uppers.length === 1 ? 100 : 50;

    let totalGap = 0;
    for (let i = 0; i < uppers.length - 1; i++) {
      const gap = uppers[i + 1].x - (uppers[i].x + uppers[i].width);
      if (gap > 0) totalGap += gap;
    }

    const spanStart = uppers[0].x;
    const spanEnd = uppers[uppers.length - 1].x + uppers[uppers.length - 1].width;
    const totalSpan = spanEnd - spanStart;

    if (totalSpan === 0) return 100;
    return Math.round(Math.max(0, 1 - totalGap / totalSpan) * 100);
  });

  return wallScores.length > 0
    ? wallScores.reduce((a, b) => a + b, 0) / wallScores.length
    : 100;
}

export function scorePreferences(
  plan: KitchenPlan,
  _context: ScoringContext,
): CategoryDetail {
  const walls = plan.walls;

  // 1. Drawer ratio among lower modules (35%)
  const lowerModules = walls.flatMap((w) =>
    w.modules.filter((m) => m.type === 'lower'),
  );
  const drawerCount = lowerModules.filter((m) =>
    m.kind === CabinetKind.DRAWER_UNIT,
  ).length;
  const drawerRatio =
    lowerModules.length > 0 ? drawerCount / lowerModules.length : 0;
  const drawerRatioScore = toPercent(smoothScore(drawerRatio, DRAWER_RATIO_MIN, DRAWER_RATIO_MAX, DRAWER_RATIO_TOLERANCE));

  // 2. Upper coverage per wall (40%)
  const wallCoverages = walls
    .map((wall) => {
      const lowerWidth = wall.modules
        .filter((m) => m.type === 'lower')
        .reduce((sum, m) => sum + m.width, 0);
      const upperWidth = wall.modules
        .filter((m) => m.type === 'upper')
        .reduce((sum, m) => sum + m.width, 0);
      if (lowerWidth === 0) return null;
      return upperWidth / lowerWidth;
    })
    .filter((r): r is number => r !== null);

  const upperCoverageScore =
    wallCoverages.length > 0
      ? toPercent(
          wallCoverages.reduce(
            (sum, r) => sum + smoothScore(r, UPPER_COVERAGE_MIN, UPPER_COVERAGE_MAX, UPPER_COVERAGE_TOLERANCE),
            0,
          ) / wallCoverages.length,
        )
      : 100;

  // 3. Upper continuity (25%)
  const upperContinuityScore = scoreUpperContinuity(walls);

  const score =
    drawerRatioScore * 0.35 +
    upperCoverageScore * 0.40 +
    upperContinuityScore * 0.25;

  return {
    score: Math.round(score * 100) / 100,
    subMetrics: {
      drawerRatio: drawerRatioScore,
      upperCoverage: upperCoverageScore,
      upperContinuity: upperContinuityScore,
    },
  };
}
