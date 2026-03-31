export type {
    Anchor,
    AnchorType,
    CategoryDetail,
    GoldenRule,
    KitchenPlan,
    LayoutType,
    PlacedModule,
    PlannerInput,
    ScoreBreakdown,
    ScoringResult,
    Segment,
    SegmentContext,
    SolverCandidate,
    SolverVariant,
    WallConfig,
    WallPlan,
} from './types';

export {
    CORNER_CABINET_DEPTH,
    CORNER_WALL_OCCUPANCY,
    FILLER_WIDTHS,
    LOWER_DEPTH,
    LOWER_HEIGHT,
    MIN_SEGMENT,
    PLINTH_HEIGHT,
    SWEET_SPOT_MAX,
    SWEET_SPOT_MIN,
    TRIANGLE_MAX,
    TRIANGLE_MIN,
    UPPER_DEPTH,
    UPPER_HEIGHT,
    UPPER_Y,
} from './constants';

// Segmenter
export {segmentWall, segmentWallForUppers} from './segmenter';

// Golden Table
export {GoldenTable} from './golden-table';
export type {FillerMatch} from './golden-table';

// Solver
export {solve} from './solver';

// Scoring
export {scorePlan} from './scoring';
export type {ScoringContext} from './scoring';

// Planner (orchestrator)
export {planKitchen, resetModuleCounter} from './planner';

// L-shaped planner
export { planLShaped } from './l-shaped-planner';

// Planner helpers
export { solveSegment } from './planner-helpers';

// Derive input
export {deriveInput} from './derive-input';
export type {KitchenStoreState} from './derive-input';
