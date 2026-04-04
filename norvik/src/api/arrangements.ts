import { apiClient } from './client';

export interface ArrangementRequest {
  width: number;
  height: number;
  fridge_position: 'left' | 'right';
  sink_position: number;
  plate_position: number;
  has_sb200?: boolean;
  built_in_stave?: boolean;
  sink_size?: 600 | 800;
  drawer_size?: 400 | 600;
  to_ceiling?: boolean;
  max_variants?: number;
}

export interface BackendPlacedModule {
  cabinet_id: number | null;
  article: string;
  kind: string;
  type: string;
  width: number;
  x: number;
  glb_url: string | null;
}

export interface BackendScoreBreakdown {
  ergonomics: number;
  workflow: number;
  aesthetics: number;
  manufacturability: number;
  preferences: number;
}

export interface BackendVariant {
  lowers: BackendPlacedModule[];
  uppers: BackendPlacedModule[];
  antresols: BackendPlacedModule[];
  score: number;
  score_breakdown: BackendScoreBreakdown;
}

export interface ArrangementResponse {
  variants: BackendVariant[];
  total_width: number;
}

export const arrangementsApi = {
  generate: (data: ArrangementRequest) =>
    apiClient.post<ArrangementResponse>('/arrangements', data).then((r) => r.data),
};
