import type { PlannerInput, SolverVariant, WallPlan } from './types';
import {
  resetModuleCounter,
  preparePlannerContext,
  placeCorners,
  processWall,
  combineAndScore,
} from './planner-helpers';
import { planLShaped } from './l-shaped-planner';

export { resetModuleCounter, buildModuleMaps } from './planner-helpers';

export function planKitchen(input: PlannerInput): SolverVariant[] {
  if (input.layoutType === 'l-shaped') {
    return planLShaped(input);
  }
  return planLinear(input);
}

function planLinear(input: PlannerInput): SolverVariant[] {
  resetModuleCounter();
  const ctx = preparePlannerContext(input);
  const { cornerModules, cornerOffsets } = placeCorners(input.corners, input.modules);
  const lastWallId = input.walls.length > 0 ? input.walls[input.walls.length - 1].id : null;

  const wallVariantSets: WallPlan[][] = [];
  for (const wallConfig of input.walls) {
    const offset = cornerOffsets.get(wallConfig.id);
    const hasFridge = wallConfig.id === lastWallId;
    const variants = processWall(wallConfig, ctx, offset, {
      fridgeCab: hasFridge ? ctx.fridgeCab : null,
      penalCab: hasFridge ? ctx.penalCab : null,
      fridgeSide: input.fridgeSide,
    }, input);
    wallVariantSets.push(variants);
  }

  return combineAndScore(wallVariantSets, cornerModules, input);
}
