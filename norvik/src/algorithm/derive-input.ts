import type { CabinetRead } from '@/types/entities';
import type {
  Anchor,
  CornerJunction,
  GoldenRule,
  LayoutType,
  PlannerInput,
  WallConfig,
} from './types';
import { ANCHOR_TO_KIND, buildAnchorGlbByKindMap } from './constants';

/**
 * Generic store shape that the deriver reads from.
 * This decouples the algorithm from any specific state management library.
 */
export interface KitchenStoreState {
  /** Room dimensions in mm */
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;

  /** Layout type */
  layoutType: LayoutType;

  /** Wall configurations */
  walls: WallConfig[];

  /** Anchored appliances (sink, cooktop, oven) with their positions */
  anchors: Record<string, Anchor[]>; // wallId → Anchor[]

  /** Available cabinets from catalog */
  availableCabinets: CabinetRead[];

  /** Custom golden rules (optional overrides) */
  goldenRules?: GoldenRule[];

  /** Floor-to-ceiling mode (places antresols above tall cabinets) */
  floorToCeiling?: boolean;

  /** Place СБ 200 side panels next to dishwashers / cooktop */
  useSidePanel200?: boolean;

  /** Leave space for hood above cooktop (skip cooktop zone for uppers) */
  useHood?: boolean;

  /** Sink module width: 600 or 800 mm (СМ 600 / СМ 800) */
  sinkModuleWidth?: number;

  /** Drawer unit width: 400 or 600 mm (СЯШ 400 / СЯШ 600) */
  drawerHousingWidth?: number;

  /** Fridge placement side: left or right edge of last wall */
  fridgeSide?: 'left' | 'right';
}

/**
 * Derive corner junctions from layout type and wall list.
 *
 * L-shaped: wall[0].end meets wall[1].start at 90°.
 * Linear / other: no corners.
 */
function deriveCorners(layoutType: LayoutType, walls: WallConfig[]): CornerJunction[] {
  if (layoutType === 'l-shaped' && walls.length >= 2) {
    return [{
      id: 'corner-0',
      wallA: { wallId: walls[0].id, end: 'end' },
      wallB: { wallId: walls[1].id, end: 'start' },
      angle: 90,
    }];
  }
  return [];
}

/**
 * Convert a generic kitchen store state into PlannerInput.
 *
 * This function merges wall configs with their anchors and
 * packages everything the planner needs.
 */
export function deriveInput(state: KitchenStoreState): PlannerInput {
  const glbByKind = buildAnchorGlbByKindMap(state.availableCabinets);

  const walls: WallConfig[] = state.walls.map((wall) => {
    const anchors = (state.anchors[wall.id] ?? []).map((a) => ({
      ...a,
      glbFile: a.glbFile ?? glbByKind.get(ANCHOR_TO_KIND[a.type]) ?? null,
    }));
    return { ...wall, anchors };
  });

  return {
    walls,
    corners: deriveCorners(state.layoutType, walls),
    modules: state.availableCabinets,
    goldenRules: state.goldenRules ?? [],
    roomWidth: state.roomWidth,
    roomDepth: state.roomDepth,
    wallHeight: state.wallHeight,
    layoutType: state.layoutType,
    floorToCeiling: state.floorToCeiling ?? false,
    useSidePanel200: state.useSidePanel200 ?? false,
    useHood: state.useHood ?? false,
    sinkModuleWidth: state.sinkModuleWidth ?? 600,
    drawerHousingWidth: state.drawerHousingWidth ?? 400,
    fridgeSide: state.fridgeSide ?? 'right',
  };
}
