import type { AnchorType, CategoryDetail, LayoutType } from '../types';

export type { CategoryDetail } from '../types';

/** Context data needed by scoring functions beyond the KitchenPlan itself */
export interface ScoringContext {
  roomWidth: number;   // mm
  roomDepth: number;   // mm
  wallHeight: number;  // mm
  layoutType: LayoutType;
  anchors: ScoringAnchor[];
}

export interface ScoringAnchor {
  wallId: string;
  type: AnchorType;
  position: number; // mm from wall start
  width: number;    // mm
}

/** Result of hard constraint validation */
export interface HardConstraintResult {
  valid: boolean;
  violations: string[];
}

/** Category weights — must sum to 1.0 */
export const CATEGORY_WEIGHTS = {
  ergonomics: 0.35,
  workflow: 0.25,
  aesthetics: 0.20,
  manufacturability: 0.10,
  preferences: 0.10,
} as const;
