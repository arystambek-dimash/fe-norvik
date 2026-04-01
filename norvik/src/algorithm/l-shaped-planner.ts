import type {
  Anchor,
  PlannerInput,
  SolverVariant,
  WallConfig,
  WallEndpoint,
  WallPlan,
} from './types';
import {
  resetModuleCounter,
  preparePlannerContext,
  selectCornerCabinet,
  processWall,
  combineAndScore,
} from './planner-helpers';
import { CORNER_WALL_OCCUPANCY, UPPER_Y } from './constants';
import { CabinetType } from '@/types/enums';

/**
 * Plan an L-shaped kitchen layout.
 *
 * Two walls connected at 90° by a corner cabinet (СУ).
 * The СУ is injected as an anchor on both walls so that segmentation
 * treats it exactly like sink/cooktop — gaps between anchors become segments,
 * and modules fill segments the same way as in linear layouts.
 *
 * The exact wall endpoint comes from input.corners, so left/right variants
 * share the same pipeline and only differ by corner orientation.
 */
export function planLShaped(input: PlannerInput): SolverVariant[] {
  resetModuleCounter();
  const ctx = preparePlannerContext(input);

  const [wall1, wall2] = input.walls;
  const junction = input.corners[0];

  // Select chosen lower/upper corner cabinets from the catalog
  const lowerCornerCabinets = input.modules.filter((m) => m.is_corner && m.type === CabinetType.LOWER);
  const upperCornerCabinets = input.modules.filter((m) => m.is_corner && m.type === CabinetType.UPPER);
  const lowerCornerModule = selectCornerCabinet(lowerCornerCabinets, 'corner-0', {
    cabinetId: input.selectedLowerCornerCabinetId,
    index: 0,
  });
  const upperCornerModule = selectCornerCabinet(upperCornerCabinets, 'corner-0', {
    cabinetId: input.selectedUpperCornerCabinetId,
    index: 0,
    yOffset: UPPER_Y,
  });
  const occupancy = lowerCornerModule?.width || CORNER_WALL_OCCUPANCY;

  const wallCornerSides = new Map<string, WallEndpoint>([
    [junction?.wallA.wallId ?? wall1.id, junction?.wallA.end ?? 'end'],
    [junction?.wallB.wallId ?? wall2.id, junction?.wallB.end ?? 'start'],
  ]);

  const buildCornerAnchor = (wall: WallConfig): Anchor => {
    const anchorWidth = Math.min(occupancy, wall.length);
    const endpoint = wallCornerSides.get(wall.id) ?? 'end';
    return {
      type: 'oven', // virtual blocker for the corner zone
      position: endpoint === 'start' ? 0 : Math.max(0, wall.length - anchorWidth),
      width: anchorWidth,
      isVirtual: true,
      virtualKind: 'corner',
    };
  };

  const cornerAnchorBackWall = buildCornerAnchor(wall1);
  const cornerAnchorSideWall = buildCornerAnchor(wall2);
  const cornerOffsetsByWallId = new Map<string, { startOffset?: number; endOffset?: number }>(
    wallConfigsFromEndpoints([wall1, wall2], wallCornerSides, occupancy),
  );

  // Build wall configs with injected corner anchors
  const wall1WithCorner: WallConfig = {
    ...wall1,
    anchors: wallCornerSides.get(wall1.id) === 'start'
      ? [cornerAnchorBackWall, ...wall1.anchors]
      : [...wall1.anchors, cornerAnchorBackWall],
  };
  const wall2WithCorner: WallConfig = {
    ...wall2,
    anchors: wallCornerSides.get(wall2.id) === 'start'
      ? [cornerAnchorSideWall, ...wall2.anchors]
      : [...wall2.anchors, cornerAnchorSideWall],
  };

  const wallConfigs = [wall1WithCorner, wall2WithCorner];
  const fridgeWallId = input.fridgeSide === 'left' ? wall1.id : wall2.id;

  const buildTallConfig = (wall: WallConfig) => ({
    fridgeCab: wall.id === fridgeWallId ? ctx.fridgeCab : null,
    penalCab: wall.id === fridgeWallId ? ctx.penalCab : null,
    fridgeSide: input.fridgeSide === 'left' ? 'left' as const : 'right' as const,
    ...(cornerOffsetsByWallId.get(wall.id) ?? {}),
  });

  const trimUppersForCorner = (
    variants: WallPlan[],
    wall: WallConfig,
    endpoint: WallEndpoint,
    cornerWidth: number,
  ) => {
    const zoneStart = endpoint === 'start' ? 0 : Math.max(0, wall.length - cornerWidth);
    const zoneEnd = endpoint === 'start' ? cornerWidth : wall.length;

    for (const variant of variants) {
      variant.modules = variant.modules.filter((mod) => {
        if (mod.type !== 'upper' && mod.type !== 'antresol') return true;
        return mod.x + mod.width <= zoneStart || mod.x >= zoneEnd;
      });
    }
  };

  // Process each wall with the injected virtual corner anchor.
  // Tall-module placement gets per-wall reserved offsets so fridge/penal
  // respect the same corner geometry without double-booking the wall.
  const wallVariantSets: WallPlan[][] = [];
  for (const wallConfig of wallConfigs) {
    const variants = processWall(
      wallConfig,
      ctx,
      undefined,
      buildTallConfig(wallConfig),
      input,
    );
    if (upperCornerModule) {
      trimUppersForCorner(
        variants,
        wallConfig,
        wallCornerSides.get(wallConfig.id) ?? 'end',
        Math.min(upperCornerModule.width, wallConfig.length),
      );
    }
    wallVariantSets.push(variants);
  }

  // Corner modules for 3D rendering
  const cornerModules = [lowerCornerModule, upperCornerModule].filter((module): module is NonNullable<typeof module> => Boolean(module));

  return combineAndScore(wallVariantSets, cornerModules, input);
}

function wallConfigsFromEndpoints(
  walls: WallConfig[],
  wallCornerSides: Map<string, WallEndpoint>,
  occupancy: number,
): Array<[string, { startOffset?: number; endOffset?: number }]> {
  return walls.map((wall) => {
    const endpoint = wallCornerSides.get(wall.id) ?? 'end';
    return [
      wall.id,
      endpoint === 'start'
        ? { startOffset: Math.min(occupancy, wall.length) }
        : { endOffset: Math.min(occupancy, wall.length) },
    ];
  });
}
