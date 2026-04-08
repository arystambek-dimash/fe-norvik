/**
 * Kitchen planner entry point — delegates to v3 (greedy fill).
 */
import type { PlannerInput, SolverVariant } from './types';
import { planKitchen as planV3, resetModuleCounter as resetV3 } from './planner-v3';

export function resetModuleCounter(): void { resetV3(); }

export function planKitchen(input: PlannerInput): SolverVariant[] {
  return planV3(input);
}

// Re-export for backwards compatibility
export { solveSegment, buildModuleMaps } from './planner-helpers';
