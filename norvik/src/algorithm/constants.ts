import { CabinetKind } from '@/types/enums';
import type { AnchorType } from './types';

/** Standard lower cabinet height in mm */
export const LOWER_HEIGHT = 820;

/** Standard lower cabinet depth in mm */
export const LOWER_DEPTH = 470;

/** Standard upper cabinet height in mm */
export const UPPER_HEIGHT = 720;

/** Standard upper cabinet depth in mm */
export const UPPER_DEPTH = 291;

/** Y-position for upper cabinets in mm (distance from floor) */
export const UPPER_Y = 1400;

/** Plinth (kick-board) height in mm */
export const PLINTH_HEIGHT = 80;

/** Available filler panel widths in mm (for golden table lookup) */
export const FILLER_WIDTHS = [150, 200] as const;

/** Upper cabinet filler range in mm */
export const MIN_UPPER_FILLER = 50;
export const MAX_UPPER_FILLER = 300;

/** Lower cabinet flexible filler range in mm */
export const MIN_LOWER_FILLER = 50;
export const MAX_LOWER_FILLER = 300;
export const FILLER_STEP = 10;

/** Module width grid alignment in mm */
export const MODULE_GRID = 50;

/** Segments narrower than this are marked as trim */
export const MIN_SEGMENT = 50;

/** Minimum gap between sink and cooktop anchors in mm */
export const MIN_SINK_COOKTOP_GAP = 200;

/** Valid sink-cooktop gap must be a multiple of this value (mm) */
export const SINK_COOKTOP_GAP_GRID = 200;

/** Sweet-spot range for module widths (mm) */
export const SWEET_SPOT_MIN = 500;
export const SWEET_SPOT_MAX = 600;

/** Working triangle distance limits (mm) */
export const TRIANGLE_MIN = 1200;
export const TRIANGLE_MAX = 2400;

/** Countertop thickness in mm */
export const COUNTERTOP_THICKNESS = 32;

/** Top of countertop in mm (LOWER_HEIGHT + COUNTERTOP_THICKNESS) */
export const COUNTERTOP_TOP = LOWER_HEIGHT + COUNTERTOP_THICKNESS; // 852

/** Wall thickness in mm */
export const WALL_THICKNESS = 120;

/** Baseboard height in mm */
export const BASEBOARD_HEIGHT = 80;

/** Backsplash height in mm */
export const BACKSPLASH_HEIGHT = 600;

/** Corner cabinet standard depth in mm (both legs) */
export const CORNER_CABINET_DEPTH = 600;

/** How much wall space a corner cabinet occupies on each adjacent wall (mm) */
export const CORNER_WALL_OCCUPANCY = 600;

// ── Scoring constants ───────────────────────────────────────────────────────

/** Minimum aisle clearance between cabinet front and opposite wall (mm) */
export const MIN_AISLE_CLEARANCE = 900;

// -- Workflow scoring --

/** Radius around cooktop centre to search for drawer modules (mm) */
export const DRAWER_COOKTOP_RADIUS = 800;

/** Max gap between dishwasher and sink edges to count as adjacent (mm) */
export const DISHWASHER_ADJACENCY_GAP = 100;

/** Distance from wall edge for tall unit to count as edge-placed (mm) */
export const TALL_EDGE_THRESHOLD = 600;

/** Workflow sub-metric fallback scores */
export const SCORE_SINK_NO_BASE = 30;
export const SCORE_DW_NOT_ADJACENT = 20;
export const SCORE_ZONE_REVERSED = 60;
export const SCORE_NO_TALL_UNITS = 80;

// -- Aesthetics scoring --

/** Std-dev divisor for width rhythm penalty */
export const RHYTHM_STD_DIVISOR = 200;

/** Per-unique-width penalty factor for rhythm */
export const RHYTHM_UNIQUE_FACTOR = 0.08;

/** Max width difference between adjacent modules for grouping (mm) */
export const ADJACENT_WIDTH_TOLERANCE = 100;

/** Modules narrower than this are penalized as "small" (mm) */
export const SMALL_MODULE_THRESHOLD = 400;

/** Filler ratio multiplier (1 / MAX_FILLER_RATIO) */
export const FILLER_RATIO_MULTIPLIER = 3;

/** Tolerance for upper-lower edge alignment (mm) */
export const ALIGNMENT_TOLERANCE = 20;

// -- Ergonomics scoring --

/** Prep zone ideal range and tolerance (mm) */
export const PREP_ZONE_MIN = 600;
export const PREP_ZONE_MAX = 1200;
export const PREP_ZONE_TOLERANCE = 400;

/** Sink-to-hob centre distance ideal range and tolerance (mm) */
export const SINK_HOB_MIN = 900;
export const SINK_HOB_MAX = 1800;
export const SINK_HOB_TOLERANCE = 600;

/** Soft aisle clearance ideal range and tolerance (mm) */
export const AISLE_IDEAL_MIN = 1000;
export const AISLE_IDEAL_MAX = 1500;
export const AISLE_TOLERANCE = 400;

/** Minimum module width to qualify as landing area (mm) */
export const LANDING_MIN_WIDTH = 400;

/** Max gap for landing adjacency check (mm) */
export const LANDING_ADJACENCY_GAP = 100;

/** Working triangle ideal perimeter for 2 anchor points (mm) */
export const TRIANGLE_2PT_MIN = 1200;
export const TRIANGLE_2PT_MAX = 2400;
export const TRIANGLE_2PT_TOLERANCE = 800;

/** Working triangle ideal perimeter for 3 anchor points (mm) */
export const TRIANGLE_3PT_MIN = 3600;
export const TRIANGLE_3PT_MAX = 7300;
export const TRIANGLE_3PT_TOLERANCE = 2000;

// -- Preferences scoring --

/** Drawer ratio ideal range among lower modules (0..1) */
export const DRAWER_RATIO_MIN = 0.3;
export const DRAWER_RATIO_MAX = 0.6;
export const DRAWER_RATIO_TOLERANCE = 0.3;

/** Upper coverage ideal range relative to lower width (0..1) */
export const UPPER_COVERAGE_MIN = 0.6;
export const UPPER_COVERAGE_MAX = 0.9;
export const UPPER_COVERAGE_TOLERANCE = 0.3;

// -- Manufacturability scoring --

/** Standard module width range and step for production (mm) */
export const STD_WIDTH_MIN = 150;
export const STD_WIDTH_MAX = 900;
export const STD_WIDTH_STEP = 50;

/** Score penalty per filler panel in manufacturability */
export const FILLER_PENALTY_PER_UNIT = 25;

/** Score penalty per additional unique width in manufacturability */
export const UNIQUE_WIDTH_PENALTY = 15;

// ── Article prefix constants ────────────────────────────────────────────────

/** Well-known article prefixes used to identify module categories. */
export const ARTICLE_PREFIX = {
  SIDE_PANEL: 'СБ',
  DISHWASHER: 'ПММ',
  TALL_UPPER: 'ВП',
  UPPER: 'П',
  ANTRESOL_TALL_UPPER: 'ВПГ',
  ANTRESOL_DEEP: 'ГПГ',
  ANTRESOL_STANDARD: 'ПГ',
} as const;

/**
 * Antresol placement rules — maps a lower module article prefix
 * to the compatible antresol article prefixes that can sit above it.
 *
 * Order matters: longer prefixes checked first to avoid false matches.
 */
export const ANTRESOL_RULES: { lowerPrefix: string; antresolPrefixes: string[] }[] = [
  { lowerPrefix: ARTICLE_PREFIX.TALL_UPPER, antresolPrefixes: [ARTICLE_PREFIX.ANTRESOL_TALL_UPPER, ARTICLE_PREFIX.ANTRESOL_STANDARD] },
  { lowerPrefix: ARTICLE_PREFIX.UPPER,      antresolPrefixes: [ARTICLE_PREFIX.ANTRESOL_DEEP, ARTICLE_PREFIX.ANTRESOL_STANDARD] },
];

/** Map anchor type → cabinet kind for appliance GLB lookup */
export const ANCHOR_TO_KIND: Record<AnchorType, CabinetKind> = {
  sink: CabinetKind.SINK,
  cooktop: CabinetKind.PLATE,
  oven: CabinetKind.APPLIANCE_HOUSING,
};

/** Find the first GLB URL per cabinet kind from a list of cabinets */
export function buildGlbByKindMap(
  cabinets: { kind: CabinetKind; glb_file: string | null }[],
): Map<CabinetKind, string> {
  const map = new Map<CabinetKind, string>();
  for (const cab of cabinets) {
    if (cab.glb_file && !map.has(cab.kind)) {
      map.set(cab.kind, cab.glb_file);
    }
  }
  return map;
}
