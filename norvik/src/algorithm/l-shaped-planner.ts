import type { Anchor, PlannerInput, SolverVariant, WallConfig, WallPlan } from './types';
import {
  resetModuleCounter,
  preparePlannerContext,
  selectCornerCabinet,
  processWall,
  combineAndScore,
} from './planner-helpers';
import { CORNER_WALL_OCCUPANCY } from './constants';

/**
 * Plan an L-shaped kitchen layout.
 *
 * Two walls connected at 90° by a corner cabinet (СУ).
 * The СУ is injected as an anchor on both walls so that segmentation
 * treats it exactly like sink/cooktop — gaps between anchors become segments,
 * and modules fill segments the same way as in linear layouts.
 *
 * Back Wall: СУ anchor at the END (last CORNER_WALL_OCCUPANCY mm)
 * Side Wall: СУ anchor at the START (first CORNER_WALL_OCCUPANCY mm)
 */
export function planLShaped(input: PlannerInput): SolverVariant[] {
  resetModuleCounter();
  const ctx = preparePlannerContext(input);

  const [wall1, wall2] = input.walls;

  // Select corner cabinet from catalog
  const cornerCabinets = input.modules.filter((m) => m.is_corner);
  const cornerModule = selectCornerCabinet(cornerCabinets, 'corner-0', 0);
  const occupancy = cornerModule?.width || CORNER_WALL_OCCUPANCY;

  // Inject СУ as anchor on each wall
  const cornerAnchorBackWall: Anchor = {
    type: 'oven', // reuse existing anchor type (won't affect context resolution meaningfully)
    position: wall1.length - occupancy,
    width: occupancy,
  };
  const cornerAnchorSideWall: Anchor = {
    type: 'oven',
    position: 0,
    width: occupancy,
  };

  // Build wall configs with injected corner anchors
  const wall1WithCorner: WallConfig = {
    ...wall1,
    anchors: [...wall1.anchors, cornerAnchorBackWall],
  };
  const wall2WithCorner: WallConfig = {
    ...wall2,
    anchors: [cornerAnchorSideWall, ...wall2.anchors],
  };

  const wallConfigs = [wall1WithCorner, wall2WithCorner];

  // Process each wall — no cornerOffset, no fridge/penal for now
  // Segmentation works purely from anchors (including the injected СУ anchor)
  const wallVariantSets: WallPlan[][] = [];
  for (const wallConfig of wallConfigs) {
    const variants = processWall(wallConfig, ctx, undefined, {
      fridgeCab: null,
      penalCab: null,
      fridgeSide: 'right', // irrelevant when fridgeCab is null
    }, input);
    wallVariantSets.push(variants);
  }

  // Corner modules for 3D rendering
  const cornerModules = cornerModule ? [cornerModule] : [];

  return combineAndScore(wallVariantSets, cornerModules, input);
}
