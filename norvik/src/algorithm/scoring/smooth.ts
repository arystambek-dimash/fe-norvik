/**
 * Smooth scoring function that returns 0..1.
 *
 * Returns 1.0 when value is within [idealMin, idealMax].
 * Degrades linearly to 0.0 outside that range over `tolerance` distance.
 *
 * Example: smoothScore(650, 800, 1200, 400) → 0.625
 *   (650 is 150mm below idealMin=800, tolerance=400 → 1 - 150/400 = 0.625)
 */
export function smoothScore(
  value: number,
  idealMin: number,
  idealMax: number,
  tolerance: number,
): number {
  if (tolerance <= 0) return (value >= idealMin && value <= idealMax) ? 1 : 0;
  if (value >= idealMin && value <= idealMax) return 1.0;
  if (value < idealMin) return Math.max(0, 1 - (idealMin - value) / tolerance);
  return Math.max(0, 1 - (value - idealMax) / tolerance);
}

/** Convert a 0..1 score to 0..100 scale */
export function toPercent(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score * 100)) * 100) / 100;
}
