import { apiClient } from "./client";

export interface AnchorPayload {
  type: "supersink" | "plate" | "fridge" | "penal" | "sidepanel";
  position: number;
  width: number;
}

export interface ArrangementRequest {
  width: number;
  height: number;
  anchors: AnchorPayload[];
  sink_size?: number;
  drawer_size?: number;
  has_dishwasher?: boolean;
  supersink_orientation?: "left" | "right";
  built_in_stove?: boolean;
  has_sb200?: boolean;
  sb200_side?: "left" | "right";
  primary_wall?: "left" | "right";
  to_ceiling?: boolean;
  use_hood?: boolean;
  max_variants?: number;
  // Legacy
  fridge_position?: "left" | "right";
  sink_position?: number;
  plate_position?: number;
}

export interface PlacedModuleResponse {
  cabinet_id: number | null;
  article: string;
  kind: string;
  type: string;
  width: number;
  x: number;
  height: number;
  depth: number;
  glb_url: string | null;
}

export interface VariantResponse {
  lowers: PlacedModuleResponse[];
  uppers: PlacedModuleResponse[];
  antresols: PlacedModuleResponse[];
  score: number;
  score_breakdown: {
    ergonomics: number;
    workflow: number;
    aesthetics: number;
    manufacturability: number;
    preferences: number;
  };
}

export interface ArrangementResponse {
  variants: VariantResponse[];
  total_width: number;
}

export async function generateArrangement(data: ArrangementRequest): Promise<ArrangementResponse> {
  const res = await apiClient.post<ArrangementResponse>("/arrangements", data);
  return res.data;
}

export interface LShapedArrangementRequest {
  wall1_length: number;
  wall2_length: number;
  height: number;
  corner_side: "left" | "right";
  wall1_anchors: AnchorPayload[];
  wall2_anchors: AnchorPayload[];
  sink_size?: number;
  drawer_size?: number;
  has_dishwasher?: boolean;
  supersink_orientation?: "left" | "right";
  built_in_stove?: boolean;
  has_sb200?: boolean;
  to_ceiling?: boolean;
  use_hood?: boolean;
  max_variants?: number;
}

export interface LShapedVariantResponse {
  wall1_lowers: PlacedModuleResponse[];
  wall1_uppers: PlacedModuleResponse[];
  wall1_antresols: PlacedModuleResponse[];
  wall2_lowers: PlacedModuleResponse[];
  wall2_uppers: PlacedModuleResponse[];
  wall2_antresols: PlacedModuleResponse[];
  corner_lower: PlacedModuleResponse | null;
  corner_upper: PlacedModuleResponse | null;
  score: number;
}

export interface LShapedArrangementResponse {
  variants: LShapedVariantResponse[];
  wall1_length: number;
  wall2_length: number;
}

export async function generateLShapedArrangement(data: LShapedArrangementRequest): Promise<LShapedArrangementResponse> {
  const res = await apiClient.post<LShapedArrangementResponse>("/arrangements/l-shaped", data);
  return res.data;
}
