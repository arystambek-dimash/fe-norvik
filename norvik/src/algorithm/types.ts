/**
 * Core types for the kitchen arrangement algorithm.
 *
 * These types are consumed by:
 * - scene-builder.ts  (KitchenPlan, PlacedModule, Anchor)
 * - variant-panel.tsx (SolverVariant, ScoreBreakdown, CategoryDetail)
 * - editor.tsx        (KitchenPlan, SolverVariant)
 * - module-panel.tsx  (PlacedModule)
 * - golden-table-panel.tsx (GoldenRule, SegmentContext)
 */

/** A cabinet module placed at a specific x position on a wall. */
export interface PlacedModule {
  id: string;
  article: string;
  kind: string;
  type: string;
  subtype?: string;
  width: number;
  height: number;
  depth: number;
  x: number;
  glbFile?: string | null;
  yOffset?: number | null;
  rotation?: number;
  cabinetId?: number | null;
  wallId?: string;
}

/** Anchor point for sink, cooktop, or oven on a wall. */
export interface Anchor {
  type: 'sink' | 'cooktop' | 'oven';
  position: number;
  width: number;
  isBuiltIn?: boolean;
  glbFile?: string | null;
  isVirtual?: boolean;
  virtualKind?: 'corner' | 'reserved';
}

/** A single wall's layout — modules placed along it. */
export interface WallViewPlan {
  wallId: string;
  wallLength: number;
  modules: PlacedModule[];
  anchors?: Anchor[];
}

/** Describes an anchor that was shifted from its original position. */
export interface AnchorShift {
  anchorType: string;
  delta: number;
  originalPosition: number;
  newPosition: number;
}

/** Per-category scoring detail with sub-metric breakdown. */
export interface CategoryDetail {
  score: number;
  subMetrics: Record<string, number>;
}

/** Full score breakdown across all evaluation categories. */
export interface ScoreBreakdown {
  hardConstraintsPassed: boolean;
  ergonomics: CategoryDetail;
  workflow: CategoryDetail;
  aesthetics: CategoryDetail;
  manufacturability: CategoryDetail;
  preferences: CategoryDetail;
}

/** Complete kitchen plan for a single variant. */
export interface KitchenPlan {
  walls: WallViewPlan[];
  score: number;
  scoreBreakdown: ScoreBreakdown;
  anchorShifts?: AnchorShift[];
  cornerModules?: PlacedModule[];
}

/** A scored variant produced by the solver. */
export interface SolverVariant {
  rank: number;
  plan: KitchenPlan;
  score: number;
}

/** Segment context for golden table rules. */
export type SegmentContext = 'sink' | 'standard';

/** Golden table rule mapping context+width to module articles. */
export interface GoldenRule {
  context: SegmentContext;
  width: number;
  moduleArticles: string[];
}
