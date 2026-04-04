import type { CabinetRead } from '@/types/entities';
import { CabinetKind } from '@/types/enums';

// ── Scene dimensions (mm) ───────────────────────────────────────────

export const UPPER_HEIGHT = 720;
export const UPPER_DEPTH = 350;
export const UPPER_Y = 1400;
export const WALL_THICKNESS = 100;
export const BASEBOARD_HEIGHT = 80;
export const BACKSPLASH_HEIGHT = 600;

// ── Layout constraints (mm) ────────────────────────────────────────

/** Maximum countertop span before a penal is added. */
export const MAX_COUNTERTOP = 3600;

/** Default corner module wall occupancy for L-shaped kitchens (mm). */
export const CORNER_WALL_OCCUPANCY = 580;

// ── Anchor ↔ CabinetKind mapping ───────────────────────────────────

export const ANCHOR_TO_KIND: Record<string, CabinetKind> = {
  sink: CabinetKind.SINK,
  cooktop: CabinetKind.PLATE,
};

/**
 * Build a map from CabinetKind → glb_file URL for anchor appliances.
 *
 * For cooktop: if `useInbuiltStove` is true, find a PLATE cabinet with inbuilt=true.
 *              Otherwise, use the selected stove cabinet by ID.
 * For sink:    find the first SINK cabinet with a GLB file.
 */
export function buildAnchorGlbByKindMap(
  modules: CabinetRead[],
  useInbuiltStove: boolean,
  selectedStoveId: number | null,
): Map<CabinetKind, string> {
  const result = new Map<CabinetKind, string>();

  // Sink GLB
  const sinkCab = modules.find(
    (m) => m.kind === CabinetKind.SINK && m.glb_file,
  );
  if (sinkCab?.glb_file) {
    result.set(CabinetKind.SINK, sinkCab.glb_file);
  }

  // Cooktop / plate GLB
  if (useInbuiltStove) {
    const plateCab = modules.find(
      (m) => m.kind === CabinetKind.PLATE && m.inbuilt && m.glb_file,
    );
    if (plateCab?.glb_file) {
      result.set(CabinetKind.PLATE, plateCab.glb_file);
    }
  } else if (selectedStoveId != null) {
    const stoveCab = modules.find(
      (m) => m.id === selectedStoveId && m.glb_file,
    );
    if (stoveCab?.glb_file) {
      result.set(CabinetKind.PLATE, stoveCab.glb_file);
    }
  }

  return result;
}
