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

/** Available filler panel widths in mm */
export const FILLER_WIDTHS = [150, 200] as const;

/** Segments narrower than this are marked as trim */
export const MIN_SEGMENT = 50;

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
