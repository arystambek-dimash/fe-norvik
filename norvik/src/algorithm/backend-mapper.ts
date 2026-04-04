/**
 * Maps backend ArrangementResponse → SolverVariant[] for the planner store.
 *
 * The backend returns variants with separate lowers/uppers/antresols arrays.
 * The frontend viewer expects a single flat modules[] array per wall,
 * with each module having a `type` field ('lower', 'upper', 'tall', 'antresol').
 */

import type {
  ArrangementResponse,
  BackendPlacedModule,
  BackendScoreBreakdown,
} from '@/api/arrangements';
import type {
  PlacedModule,
  SolverVariant,
  KitchenPlan,
  ScoreBreakdown,
  CategoryDetail,
  WallViewPlan,
} from './types';

const LOWER_HEIGHT = 720;
const LOWER_DEPTH = 600;
const UPPER_HEIGHT = 720;
const UPPER_DEPTH = 350;
const ANTRESOL_HEIGHT = 360;
const ANTRESOL_DEPTH = 350;
const TALL_HEIGHT = 2100;
const TALL_DEPTH = 600;

function mapModule(m: BackendPlacedModule, tier: string): PlacedModule {
  // Backend type 'tall' stays 'tall'; lower/upper/antresol map to viewer types
  const viewerType = tier === 'antresol' ? 'upper' : tier;

  let height = LOWER_HEIGHT;
  let depth = LOWER_DEPTH;
  if (tier === 'upper') { height = UPPER_HEIGHT; depth = UPPER_DEPTH; }
  else if (tier === 'antresol') { height = ANTRESOL_HEIGHT; depth = ANTRESOL_DEPTH; }
  else if (m.type === 'tall') { height = TALL_HEIGHT; depth = TALL_DEPTH; }

  return {
    id: String(m.cabinet_id ?? m.article),
    article: m.article,
    kind: m.kind,
    type: m.type === 'tall' ? 'tall' : viewerType,
    width: m.width,
    height,
    depth,
    x: m.x,
    glbFile: m.glb_url ?? undefined,
    yOffset: tier === 'antresol' ? 1400 + UPPER_HEIGHT : undefined,
  };
}

function mapScoreBreakdown(b: BackendScoreBreakdown): ScoreBreakdown {
  const wrap = (score: number): CategoryDetail => ({
    score: score * 100,
    subMetrics: {},
  });

  return {
    hardConstraintsPassed: true,
    ergonomics: wrap(b.ergonomics),
    workflow: wrap(b.workflow),
    aesthetics: wrap(b.aesthetics),
    manufacturability: wrap(b.manufacturability),
    preferences: wrap(b.preferences),
  };
}

/**
 * Transform backend arrangement response into SolverVariant[]
 * compatible with the planner store and variant panel.
 */
export function mapBackendResponse(
  response: ArrangementResponse,
  wallLength: number,
): SolverVariant[] {
  return response.variants.map((variant, index) => {
    const modules: PlacedModule[] = [
      ...variant.lowers.map((m) => mapModule(m, 'lower')),
      ...variant.uppers.map((m) => mapModule(m, 'upper')),
      ...variant.antresols.map((m) => mapModule(m, 'antresol')),
    ];

    const wall: WallViewPlan = {
      wallId: 'back',
      wallLength,
      modules,
    };

    const scoreBreakdown = mapScoreBreakdown(variant.score_breakdown);

    const plan: KitchenPlan = {
      walls: [wall],
      score: variant.score * 100,
      scoreBreakdown,
    };

    return {
      rank: index + 1,
      plan,
      score: variant.score * 100,
    };
  });
}
