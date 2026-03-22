import type { CabinetRead } from '@/types/entities';

export type AnchorType = 'sink' | 'cooktop' | 'oven';
export type SegmentContext = 'sink' | 'standard';
export type LayoutType = 'linear' | 'l-shaped';

export interface Anchor {
  type: AnchorType;
  position: number; // mm from wall start
  width: number;    // mm
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
  x: number;
  width: number;
  height: number;
  depth: number;
  type: 'lower' | 'upper' | 'tall' | 'filler' | 'corner';
  wallId: string;
  rotation?: number; // radians around Y axis (used for corner cabinets)
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
  modules: CabinetRead[];
  goldenRules: GoldenRule[];
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  layoutType: LayoutType;
}

export interface ScoringResult {
  total: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  widthConsistency: number;
  moduleSweetSpot: number;
  ergonomicPlacement: number;
  fillerPenalty: number;
  symmetry: number;
  aestheticGrouping: number;
  visualComposition: number;
  workingTriangle: number;
  upperCoverage: number;
  cornerFit: number;
}

export interface SolverCandidate {
  widths: number[];
  cabinetIds: number[];
  articles: string[];
  score: number;
}
