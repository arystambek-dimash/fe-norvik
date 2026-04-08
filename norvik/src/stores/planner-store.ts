import { create } from 'zustand';

// Types needed for the kitchen planner
interface Anchor {
  type: 'sink' | 'cooktop' | 'oven' | 'fridge';
  position: number;
  width: number;
  glbFile?: string | null;
  isVirtual?: boolean;
  virtualKind?: 'corner' | 'reserved';
}

interface WallConfig {
  id: string;
  length: number;
  anchors: Anchor[];
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
  lShapedSide: 'left' | 'right';
  sideWallWidth: number;
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

  // Built-in cooktop vs standalone stove
  useInbuiltStove: boolean;

  // Selected standalone stove cabinet ID (used when useInbuiltStove = false)
  selectedStoveId: number | null;

  // Sink module width (СМ 600 or СМ 800)
  sinkModuleWidth: 600 | 800;

  // Drawer unit width (СЯШ 400 or СЯШ 600)
  drawerHousingWidth: 400 | 600;

  // Fridge placement side
  fridgeSide: 'left' | 'right';

  // Selected corner cabinets for L-shaped layouts
  selectedLowerCornerCabinetId: number | null;
  selectedUpperCornerCabinetId: number | null;

  // Countertop customization
  countertopColor: string | null;
  countertopTextureUrl: string | null;

  // Facade (door) customization
  facadeColor: string | null;
  facadeTextureUrl: string | null;

  // V3: Appliance selection
  hasDishwasher: boolean;
  ovenPlacement: 'under-cooktop' | 'penal';  // СДШ 600 or ПНС 600
  supersinkOrientation: 'left' | 'right';     // which side СЯШ goes
  primaryWall: 'left' | 'right';              // which side has NO gaps (main wall)

  // 3D viewer
  selectedModuleId: string | null;

  // Actions
  setRoomConfig: (config: {
    roomWidth?: number;
    roomDepth?: number;
    wallHeight?: number;
    layoutType?: 'linear' | 'l-shaped';
    lShapedSide?: 'left' | 'right';
    sideWallWidth?: number;
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
  setUseInbuiltStove: (v: boolean) => void;
  setSelectedStoveId: (id: number | null) => void;
  setSinkModuleWidth: (v: 600 | 800) => void;
  setDrawerHousingWidth: (v: 400 | 600) => void;
  setLShapedSide: (v: 'left' | 'right') => void;
  setSideWallWidth: (v: number) => void;
  setFridgeSide: (v: 'left' | 'right') => void;
  setSelectedLowerCornerCabinetId: (id: number | null) => void;
  setSelectedUpperCornerCabinetId: (id: number | null) => void;
  setCountertopColor: (color: string | null) => void;
  setCountertopTextureUrl: (url: string | null) => void;
  setFacadeColor: (color: string | null) => void;
  setFacadeTextureUrl: (url: string | null) => void;
  setHasDishwasher: (v: boolean) => void;
  setOvenPlacement: (v: 'under-cooktop' | 'penal') => void;
  setSupersinkOrientation: (v: 'left' | 'right') => void;
  setPrimaryWall: (v: 'left' | 'right') => void;
  setSelectedModuleId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  roomWidth: 3000,
  roomDepth: 2500,
  wallHeight: 2700,
  layoutType: 'linear' as const,
  lShapedSide: 'left' as 'left' | 'right',
  sideWallWidth: 1800,
  walls: [] as WallConfig[],
  selectedCatalogId: null,
  modules: [] as any[],
  goldenRules: [] as GoldenRule[],
  floorToCeiling: false,
  useSidePanel200: false,
  useHood: false,
  useInbuiltStove: true,
  selectedStoveId: null as number | null,
  sinkModuleWidth: 600 as 600 | 800,
  drawerHousingWidth: 400 as 400 | 600,
  fridgeSide: 'right' as 'left' | 'right',
  selectedLowerCornerCabinetId: null as number | null,
  selectedUpperCornerCabinetId: null as number | null,
  countertopColor: null as string | null,
  countertopTextureUrl: null as string | null,
  facadeColor: null as string | null,
  facadeTextureUrl: null as string | null,
  hasDishwasher: false,
  ovenPlacement: 'under-cooktop' as 'under-cooktop' | 'penal',
  supersinkOrientation: 'right' as 'left' | 'right',
  primaryWall: 'left' as 'left' | 'right',
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
  setUseInbuiltStove: (v) => set({ useInbuiltStove: v }),
  setSelectedStoveId: (id) => set({ selectedStoveId: id }),
  setSinkModuleWidth: (v) => set({ sinkModuleWidth: v }),
  setDrawerHousingWidth: (v) => set({ drawerHousingWidth: v }),
  setLShapedSide: (v) => set({ lShapedSide: v }),
  setSideWallWidth: (v) => set({ sideWallWidth: v }),
  setFridgeSide: (v) => set({ fridgeSide: v }),
  setSelectedLowerCornerCabinetId: (id) => set({ selectedLowerCornerCabinetId: id }),
  setSelectedUpperCornerCabinetId: (id) => set({ selectedUpperCornerCabinetId: id }),
  setCountertopColor: (color) => set({ countertopColor: color, countertopTextureUrl: null }),
  setCountertopTextureUrl: (url) => set({ countertopTextureUrl: url, countertopColor: null }),
  setFacadeColor: (color) => set({ facadeColor: color, facadeTextureUrl: null }),
  setFacadeTextureUrl: (url) => set({ facadeTextureUrl: url, facadeColor: null }),
  setHasDishwasher: (v) => set({ hasDishwasher: v }),
  setOvenPlacement: (v) => set({ ovenPlacement: v }),
  setSupersinkOrientation: (v) => set({ supersinkOrientation: v }),
  setPrimaryWall: (v) => set({ primaryWall: v }),
  setSelectedModuleId: (id) => set({ selectedModuleId: id }),
  reset: () => set(initialState),
}));
