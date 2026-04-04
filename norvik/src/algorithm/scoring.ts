import type { ScoreBreakdown } from './types';

/** Scoring category weights — must sum to 1.0. */
export const CATEGORY_WEIGHTS = {
  ergonomics: 0.35,
  workflow: 0.25,
  aesthetics: 0.20,
  manufacturability: 0.10,
  preferences: 0.10,
} as const;

const EMPTY_CATEGORY = { score: 0, subMetrics: {} };

/** Default empty score breakdown. */
export const EMPTY_SCORE_BREAKDOWN: ScoreBreakdown = {
  hardConstraintsPassed: true,
  ergonomics: { ...EMPTY_CATEGORY },
  workflow: { ...EMPTY_CATEGORY },
  aesthetics: { ...EMPTY_CATEGORY },
  manufacturability: { ...EMPTY_CATEGORY },
  preferences: { ...EMPTY_CATEGORY },
};
