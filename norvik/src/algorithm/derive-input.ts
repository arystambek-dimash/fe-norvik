/**
 * Derives algorithm input from the planner store state.
 */

export interface KitchenStoreState {
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  layoutType: 'linear' | 'l-shaped';
  lShapedSide: 'left' | 'right';
  walls: { id: string; length: number; anchors: { type: string; position: number; width: number }[] }[];
  anchors: Record<string, { type: string; position: number; width: number }[]>;
  availableCabinets: unknown[];
  goldenRules: unknown[];
  floorToCeiling: boolean;
  useSidePanel200: boolean;
  useHood: boolean;
  useInbuiltStove: boolean;
  selectedStoveId: number | null;
  sinkModuleWidth: 600 | 800;
  drawerHousingWidth: 400 | 600;
  fridgeSide: 'left' | 'right';
  selectedLowerCornerCabinetId: number | null;
  selectedUpperCornerCabinetId: number | null;
}

/**
 * Convert planner store state into algorithm input.
 * Currently a pass-through — the backend API accepts its own schema.
 */
export function deriveInput(state: KitchenStoreState): KitchenStoreState {
  return state;
}
