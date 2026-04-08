/**
 * DP-based segment filling — "coin change" with unlimited supply.
 * Replaces the old backtracking solver.
 */

// ── canFill ────────────────────────────────────────────────────────────────────

/** Check if `target` mm can be filled exactly using the given widths. */
export function canFill(target: number, widths: number[]): boolean {
  if (target <= 0) return target === 0;
  const dp = new Uint8Array(target + 1); // 0 = false, 1 = true
  dp[0] = 1;
  for (const w of widths) {
    for (let s = w; s <= target; s++) {
      if (dp[s - w]) dp[s] = 1;
    }
  }
  return dp[target] === 1;
}

// ── canFillWithFiller ──────────────────────────────────────────────────────────

export interface FillResult {
  possible: boolean;
  fillerWidth: number;
}

/**
 * Try to fill `target` mm with cabinets.  If not possible, try adding a
 * filler (50–300 mm, step 10 mm) and filling the reduced width.
 */
export function canFillWithFiller(
  target: number,
  widths: number[],
): FillResult {
  if (target <= 0) return { possible: target === 0, fillerWidth: 0 };
  if (canFill(target, widths)) return { possible: true, fillerWidth: 0 };

  for (let f = 50; f <= 300; f += 10) {
    const reduced = target - f;
    // FIX: allow reduced === 0 (filler-only fill) — previously skipped due to
    // `reduced > 0` guard, causing segments of exactly 50–300mm to be
    // incorrectly reported as unfillable when no cabinet combination works.
    if (reduced >= 0 && (reduced === 0 || canFill(reduced, widths))) {
      return { possible: true, fillerWidth: f };
    }
  }
  return { possible: false, fillerWidth: 0 };
}

// ── findBestFill ───────────────────────────────────────────────────────────────

/**
 * Return an array of cabinet widths whose sum === `target`.
 * Prefers wider cabinets (fewer modules).
 * Caller must ensure `canFill(target, widths)` is true.
 */
export function findBestFill(target: number, widths: number[]): number[] {
  if (target <= 0) return [];

  const dp = new Int32Array(target + 1).fill(-1);
  const parent = new Int32Array(target + 1);
  dp[0] = 0;

  // Process wider widths first so the first reachable path uses big cabinets
  const sorted = [...widths].sort((a, b) => b - a);

  for (const w of sorted) {
    for (let s = w; s <= target; s++) {
      if (dp[s] === -1 && dp[s - w] !== -1) {
        dp[s] = dp[s - w] + 1;
        parent[s] = w;
      }
    }
  }

  const result: number[] = [];
  let remaining = target;
  while (remaining > 0) {
    const w = parent[remaining];
    if (w <= 0) break; // safety
    result.push(w);
    remaining -= w;
  }
  return result;
}

// ── generateFillVariants ───────────────────────────────────────────────────────

export interface FillVariant {
  widths: number[];
  fillerWidth: number;
}

/**
 * Generate up to 3 fill variants for a segment:
 *   A — minimum modules (prefer wide cabinets)
 *   B — uniform width (all same width if possible)
 *   C — sweet-spot 500-600 mm only, fallback to all widths
 */
export function generateFillVariants(
  target: number,
  widths: number[],
): FillVariant[] {
  const variants: FillVariant[] = [];
  const seen = new Set<string>();

  const add = (fill: number[], filler: number) => {
    const key = [...fill].sort((a, b) => a - b).join(',') + '|' + filler;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({ widths: fill, fillerWidth: filler });
  };

  // Variant A — minimum modules (default findBestFill)
  const resA = canFillWithFiller(target, widths);
  if (resA.possible) {
    const fillTarget = target - resA.fillerWidth;
    if (fillTarget > 0) {
      add(findBestFill(fillTarget, widths), resA.fillerWidth);
    } else if (resA.fillerWidth > 0) {
      add([], resA.fillerWidth);
    }
  }

  // Variant B — uniform width
  const uniformOrder = [600, 500, 400, 800, 450, 200];
  for (const w of uniformOrder) {
    if (!widths.includes(w)) continue;
    if (target % w === 0) {
      add(Array(target / w).fill(w) as number[], 0);
      break;
    }
  }
  // Uniform with filler
  if (variants.length < 2) {
    for (const w of uniformOrder) {
      if (!widths.includes(w)) continue;
      for (let f = 50; f <= 300; f += 10) {
        const reduced = target - f;
        if (reduced > 0 && reduced % w === 0) {
          add(Array(reduced / w).fill(w) as number[], f);
          break;
        }
      }
      if (variants.length >= 2) break;
    }
  }

  // Variant C — sweet-spot widths [500, 600]
  const sweetWidths = widths.filter((w) => w >= 500 && w <= 600);
  if (sweetWidths.length > 0) {
    const resC = canFillWithFiller(target, sweetWidths);
    if (resC.possible) {
      const fillTarget = target - resC.fillerWidth;
      if (fillTarget > 0) {
        add(findBestFill(fillTarget, sweetWidths), resC.fillerWidth);
      }
    }
  }

  return variants;
}
