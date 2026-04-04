/** Grid step for snapping positions (mm). */
const GRID_STEP = 50;

/** Round a position to the nearest grid step. */
export function snapToGrid(value: number, step: number = GRID_STEP): number {
  return Math.round(value / step) * step;
}
