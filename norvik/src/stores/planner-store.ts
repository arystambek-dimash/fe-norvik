import { create } from 'zustand';

// Types needed for the kitchen planner
interface WallConfig {
  id: string;
  length: number;
  anchors: Anchor[];
}

interface Anchor {
  type: 'sink' | 'cooktop' | 'oven';
  position: number;
  width: number;
  glbFile?: string | null;
}

interface GoldenRule {
  context: 'sink' | 'standard';
  width: number;
  moduleArticles: string[];
}

interface PlannerState {
  // Room config
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  layoutType: 'linear' | 'l-shaped';
  walls: WallConfig[];

  // Catalog
  selectedCatalogId: number | null;
  modules: any[]; // CabinetRead[] - will be typed properly when algorithm types exist

  // Golden table
  goldenRules: GoldenRule[];

  // Algorithm results
  variants: any[]; // SolverVariant[]
  selectedVariantIndex: number;

  // Floor-to-ceiling (antresol) mode
  floorToCeiling: boolean;

  // СБ 200 side panels next to dishwasher/cooktop
  useSidePanel200: boolean;

  // Hood above cooktop
  useHood: boolean;

  // Sink module width (СМ 600 or СМ 800)
  sinkModuleWidth: 600 | 800;

  // Drawer unit width (СЯШ 400 or СЯШ 600)
  drawerHousingWidth: 400 | 600;

  // Fridge placement side
  fridgeSide: 'left' | 'right';

  // Countertop customization
  countertopColor: string | null;
  countertopTextureUrl: string | null;

  // 3D viewer
  selectedModuleId: string | null;

  // Actions
  setRoomConfig: (config: {
    roomWidth?: number;
    roomDepth?: number;
    wallHeight?: number;
    layoutType?: 'linear' | 'l-shaped';
  }) => void;
  setWalls: (walls: WallConfig[]) => void;
  setSelectedCatalogId: (id: number | null) => void;
  setModules: (modules: any[]) => void;
  setGoldenRules: (rules: GoldenRule[]) => void;
  setVariants: (variants: any[]) => void;
  setSelectedVariantIndex: (index: number) => void;
  setFloorToCeiling: (v: boolean) => void;
  setUseSidePanel200: (v: boolean) => void;
  setUseHood: (v: boolean) => void;
  setSinkModuleWidth: (v: 600 | 800) => void;
  setDrawerHousingWidth: (v: 400 | 600) => void;
  setFridgeSide: (v: 'left' | 'right') => void;
  setCountertopColor: (color: string | null) => void;
  setCountertopTextureUrl: (url: string | null) => void;
  setSelectedModuleId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  roomWidth: 3000,
  roomDepth: 2500,
  wallHeight: 2700,
  layoutType: 'linear' as const,
  walls: [] as WallConfig[],
  selectedCatalogId: null,
  modules: [] as any[],
  goldenRules: [] as GoldenRule[],
  floorToCeiling: false,
  useSidePanel200: false,
  useHood: false,
  sinkModuleWidth: 600 as 600 | 800,
  drawerHousingWidth: 400 as 400 | 600,
  fridgeSide: 'right' as 'left' | 'right',
  countertopColor: null as string | null,
  countertopTextureUrl: null as string | null,
  variants: [] as any[],
  selectedVariantIndex: 0,
  selectedModuleId: null,
};

export const usePlannerStore = create<PlannerState>((set) => ({
  ...initialState,
  setRoomConfig: (config) => set(config),
  setWalls: (walls) => set({ walls }),
  setSelectedCatalogId: (id) => set({ selectedCatalogId: id }),
  setModules: (modules) => set({ modules }),
  setGoldenRules: (rules) => set({ goldenRules: rules }),
  setVariants: (variants) => set({ variants }),
  setSelectedVariantIndex: (index) => set({ selectedVariantIndex: index }),
  setFloorToCeiling: (v) => set({ floorToCeiling: v }),
  setUseSidePanel200: (v) => set({ useSidePanel200: v }),
  setUseHood: (v) => set({ useHood: v }),
  setSinkModuleWidth: (v) => set({ sinkModuleWidth: v }),
  setDrawerHousingWidth: (v) => set({ drawerHousingWidth: v }),
  setFridgeSide: (v) => set({ fridgeSide: v }),
  setCountertopColor: (color) => set({ countertopColor: color, countertopTextureUrl: null }),
  setCountertopTextureUrl: (url) => set({ countertopTextureUrl: url, countertopColor: null }),
  setSelectedModuleId: (id) => set({ selectedModuleId: id }),
  reset: () => set(initialState),
}));
