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
  setSelectedModuleId: (id) => set({ selectedModuleId: id }),
  reset: () => set(initialState),
}));
