import type { CabinetRead } from '@/types/entities';
import type { CabinetKind, CabinetSubtype } from '@/types/enums';

export type AnchorType = 'sink' | 'cooktop' | 'oven';
export type SegmentContext = 'sink' | 'standard';
export type LayoutType = 'linear' | 'l-shaped';

/** Which endpoint of a wall participates in a corner junction */
export type WallEndpoint = 'start' | 'end';

/**
 * A corner junction where two walls meet.
 * Defines exactly which wall endpoints connect and at what angle.
 */
export interface CornerJunction {
  id: string;
  wallA: { wallId: string; end: WallEndpoint };
  wallB: { wallId: string; end: WallEndpoint };
  angle: number; // interior angle in degrees (90 for standard L)
}

export interface Anchor {
  type: AnchorType;
  position: number; // mm from wall start
  width: number;    // mm
  glbFile?: string | null; // GLB 3D model URL from cabinet record
}

export interface WallConfig {
  id: string;
  length: number; // mm
  anchors: Anchor[];
}

export interface Segment {
  wallId: string;
  start: number;
  end: number;
  width: number;
  context: SegmentContext;
  isTrim: boolean;
}

export interface PlacedModule {
  id: string;
  cabinetId: number;
  article: string;
  kind?: CabinetKind;
  subtype?: CabinetSubtype;
  x: number;
  width: number;
  height: number;
  depth: number;
  type: 'lower' | 'upper' | 'tall' | 'filler' | 'corner' | 'antresol';
  wallId: string;
  rotation?: number; // radians around Y axis (used for corner cabinets)
  yOffset?: number;  // mm from floor to bottom of module (used for antresols)
  glbFile?: string | null; // GLB 3D model URL from cabinet record
}

export interface KitchenPlan {
  walls: WallPlan[];
  cornerModules: PlacedModule[]; // corner cabinets placed at wall junctions
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface WallPlan {
  wallId: string;
  modules: PlacedModule[];
}

export interface SolverVariant {
  plan: KitchenPlan;
  rank: number;
}

export interface GoldenRule {
  context: SegmentContext;
  width: number;
  moduleArticles: string[];
}

export interface PlannerInput {
  walls: WallConfig[];
  corners: CornerJunction[];
  modules: CabinetRead[];
  goldenRules: GoldenRule[];
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  layoutType: LayoutType;
  floorToCeiling: boolean;
  useSidePanel200: boolean;
  useHood: boolean;
  sinkModuleWidth: number;
  drawerHousingWidth: number;
}

export interface ScoringResult {
  total: number;
  breakdown: ScoreBreakdown;
}

export interface CategoryDetail {
  score: number;           // 0–100
  subMetrics: Record<string, number>; // each 0–100
}

export interface ScoreBreakdown {
  hardConstraintsPassed: boolean;
  violations: string[];
  ergonomics: CategoryDetail;
  workflow: CategoryDetail;
  aesthetics: CategoryDetail;
  manufacturability: CategoryDetail;
  preferences: CategoryDetail;
}

export interface SolverCandidate {
  widths: number[];
  cabinetIds: number[];
  articles: string[];
  score: number;
}
