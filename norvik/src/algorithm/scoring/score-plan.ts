import type { KitchenPlan, ScoringResult, ScoreBreakdown } from '../types';
import type { ScoringContext } from './types';
import { CATEGORY_WEIGHTS } from './types';
import { validateHardConstraints } from './hard-constraints';
import { scoreErgonomics } from './ergonomics';
import { scoreWorkflow } from './workflow';
import { scoreAesthetics } from './aesthetics';
import { scoreManufacturability } from './manufacturability';
import { scorePreferences } from './preferences';

const EMPTY_CATEGORY = Object.freeze({ score: 0, subMetrics: {} });

export const EMPTY_SCORE_BREAKDOWN: ScoreBreakdown = Object.freeze({
  hardConstraintsPassed: true,
  violations: [],
  ergonomics: EMPTY_CATEGORY,
  workflow: EMPTY_CATEGORY,
  aesthetics: EMPTY_CATEGORY,
  manufacturability: EMPTY_CATEGORY,
  preferences: EMPTY_CATEGORY,
});

/**
 * Score a complete kitchen plan using the 3-layer scoring system:
 * 1. Hard constraints — reject invalid layouts (score = -1)
 * 2. Soft scoring — 5 weighted categories (ergonomics, workflow, aesthetics, manufacturability, preferences)
 * 3. Final weighted total (0–100)
 */
export function scorePlan(plan: KitchenPlan, context: ScoringContext): ScoringResult {
  // Layer 1: Hard constraints
  const hardResult = validateHardConstraints(plan, context);

  if (!hardResult.valid) {
    const breakdown: ScoreBreakdown = {
      hardConstraintsPassed: false,
      violations: hardResult.violations,
      ergonomics: { ...EMPTY_CATEGORY },
      workflow: { ...EMPTY_CATEGORY },
      aesthetics: { ...EMPTY_CATEGORY },
      manufacturability: { ...EMPTY_CATEGORY },
      preferences: { ...EMPTY_CATEGORY },
    };
    return { total: -1, breakdown };
  }

  // Layer 2: Soft scoring — 5 categories
  const ergonomics = scoreErgonomics(plan, context);
  const workflow = scoreWorkflow(plan, context);
  const aesthetics = scoreAesthetics(plan);
  const manufacturability = scoreManufacturability(plan);
  const preferences = scorePreferences(plan, context);

  // Layer 3: Weighted total
  const total =
    ergonomics.score * CATEGORY_WEIGHTS.ergonomics +
    workflow.score * CATEGORY_WEIGHTS.workflow +
    aesthetics.score * CATEGORY_WEIGHTS.aesthetics +
    manufacturability.score * CATEGORY_WEIGHTS.manufacturability +
    preferences.score * CATEGORY_WEIGHTS.preferences;

  const breakdown: ScoreBreakdown = {
    hardConstraintsPassed: true,
    violations: [],
    ergonomics,
    workflow,
    aesthetics,
    manufacturability,
    preferences,
  };

  return {
    total: Math.round(total * 100) / 100,
    breakdown,
  };
}
