import type { CabinetRead } from '@/types/entities';
import type {
  Anchor,
  GoldenRule,
  LayoutType,
  PlannerInput,
  WallConfig,
} from './types';

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
}

/**
 * Convert a generic kitchen store state into PlannerInput.
 *
 * This function merges wall configs with their anchors and
 * packages everything the planner needs.
 */
export function deriveInput(state: KitchenStoreState): PlannerInput {
  const walls: WallConfig[] = state.walls.map((wall) => ({
    ...wall,
    anchors: state.anchors[wall.id] ?? [],
  }));

  return {
    walls,
    modules: state.availableCabinets,
    goldenRules: state.goldenRules ?? [],
    roomWidth: state.roomWidth,
    roomDepth: state.roomDepth,
    wallHeight: state.wallHeight,
    layoutType: state.layoutType,
  };
}
