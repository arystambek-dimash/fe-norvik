import type { KitchenPlan, PlacedModule } from '../types';
import type { ScoringContext, ScoringAnchor } from './types';

/** Collect all modules from every wall in the plan. */
export function allModules(plan: KitchenPlan): PlacedModule[] {
  return plan.walls.flatMap((w) => w.modules);
}

/** Collect all modules including corner modules. */
export function allModulesWithCorners(plan: KitchenPlan): PlacedModule[] {
  return [...plan.walls.flatMap((w) => w.modules), ...plan.cornerModules];
}

/** Collect non-filler modules from all walls. */
export function nonFillerModules(plan: KitchenPlan): PlacedModule[] {
  return plan.walls.flatMap((w) => w.modules.filter((m) => m.type !== 'filler'));
}

/** Get wall length by index (wall 0 → roomWidth, wall 1 → roomDepth). */
export function getWallLength(wallIndex: number, context: ScoringContext): number {
  return wallIndex === 0 ? context.roomWidth : context.roomDepth;
}

/** Centre position of an anchor in mm from wall start. */
export function anchorCenter(a: ScoringAnchor): number {
  return a.position + a.width / 2;
}

/** Centre position of a placed module. */
export function moduleCenter(m: PlacedModule): number {
  return m.x + m.width / 2;
}

/** Population standard deviation. */
export function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
