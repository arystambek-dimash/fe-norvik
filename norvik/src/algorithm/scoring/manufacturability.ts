import type { KitchenPlan } from '../types';
import type { CategoryDetail } from './types';
import { allModulesWithCorners } from './helpers';
import {
  STD_WIDTH_MIN,
  STD_WIDTH_MAX,
  STD_WIDTH_STEP,
  FILLER_PENALTY_PER_UNIT,
  UNIQUE_WIDTH_PENALTY,
} from '../constants';

const STANDARD_WIDTHS = new Set<number>();
for (let w = STD_WIDTH_MIN; w <= STD_WIDTH_MAX; w += STD_WIDTH_STEP) {
  STANDARD_WIDTHS.add(w);
}

export function scoreManufacturability(plan: KitchenPlan): CategoryDetail {
  const modules = allModulesWithCorners(plan);

  const fillers = modules.filter((m) => m.type === 'filler');
  const nonFillers = modules.filter((m) => m.type !== 'filler');
  const fillerCount = fillers.length;

  // 1. Fewer fillers = better (40%)
  const fillerScore = Math.max(0, 100 - fillerCount * FILLER_PENALTY_PER_UNIT);

  // 2. Standard widths ratio (30%)
  const standardCount = nonFillers.filter((m) =>
    STANDARD_WIDTHS.has(m.width),
  ).length;
  const standardWidthsScore =
    nonFillers.length > 0 ? (standardCount / nonFillers.length) * 100 : 100;

  // 3. Fewer unique widths = simpler production (30%)
  const uniqueWidths = new Set(nonFillers.map((m) => m.width));
  const uniqueCount = uniqueWidths.size;
  const uniqueWidthsScore =
    uniqueCount === 0 ? 100 : Math.max(0, 100 - (uniqueCount - 1) * UNIQUE_WIDTH_PENALTY);

  const score =
    fillerScore * 0.4 + standardWidthsScore * 0.3 + uniqueWidthsScore * 0.3;

  return {
    score: Math.round(score * 100) / 100,
    subMetrics: {
      fillerCount: fillerScore,
      standardWidths: standardWidthsScore,
      uniqueWidths: uniqueWidthsScore,
    },
  };
}
