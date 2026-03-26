import type { CabinetRead } from '@/types/entities';
import type { SolverCandidate } from './types';

const MAX_CANDIDATES = 40;

export interface SolveOptions {
  /** When true, rewards 2-3 unique widths instead of penalizing variety */
  preferVariety?: boolean;
}

/**
 * Score a single candidate combination.
 * Prefers: fewer modules, larger widths, uniform sizes.
 * When preferVariety is set, rewards width diversity (for upper cabinets).
 */
function scoreCandidate(widths: number[], preferVariety = false): number {
  if (widths.length === 0) return 0;

  // Fewer modules is better (inverse of count, scaled)
  const countScore = 100 / widths.length;

  // Larger average width is better
  const avgWidth = widths.reduce((s, w) => s + w, 0) / widths.length;
  const sizeScore = Math.min(avgWidth / 10, 100);

  // Uniformity: low standard deviation is better
  const mean = avgWidth;
  const variance =
    widths.reduce((s, w) => s + (w - mean) ** 2, 0) / widths.length;
  const stdDev = Math.sqrt(variance);
  const uniformityScore = Math.max(0, 100 - stdDev / 2);

  if (preferVariety) {
    // Reward 2-3 unique widths for visually interesting layouts
    const uniqueCount = new Set(widths).size;
    const varietyBonus =
      uniqueCount === 1 ? 30
      : uniqueCount === 2 ? 80
      : uniqueCount === 3 ? 100
      : Math.max(0, 100 - (uniqueCount - 3) * 25);

    return countScore * 0.35 + sizeScore * 0.45 + uniformityScore * 0.05 + varietyBonus * 0.15;
  }

  return countScore * 0.45 + sizeScore * 0.45 + uniformityScore * 0.1;
}

/**
 * Backtracking solver: finds all combinations of module widths
 * that exactly sum to `targetWidth`.
 *
 * Returns top MAX_CANDIDATES candidates sorted by score (descending).
 */
export function solve(
  targetWidth: number,
  modules: CabinetRead[],
  options?: SolveOptions,
): SolverCandidate[] {
  const preferVariety = options?.preferVariety ?? false;
  // Deduplicate modules by width to avoid redundant branches
  const uniqueModules = deduplicateByWidth(modules);
  const sortedModules = [...uniqueModules].sort((a, b) => a.width - b.width);
  const minWidth = sortedModules.length > 0 ? sortedModules[0].width : Infinity;

  const results: SolverCandidate[] = [];

  function backtrack(
    remaining: number,
    startIdx: number,
    currentWidths: number[],
    currentIds: number[],
    currentArticles: string[],
  ): void {
    if (remaining === 0) {
      results.push({
        widths: [...currentWidths],
        cabinetIds: [...currentIds],
        articles: [...currentArticles],
        score: scoreCandidate(currentWidths, preferVariety),
      });
      return;
    }

    if (remaining < minWidth) return;

    for (let i = startIdx; i < sortedModules.length; i++) {
      const mod = sortedModules[i];

      if (mod.width > remaining) break; // sorted, so all subsequent are larger

      currentWidths.push(mod.width);
      currentIds.push(mod.id);
      currentArticles.push(mod.article);

      // Allow reuse of same module (same index), since we can place multiple
      backtrack(
        remaining - mod.width,
        i,
        currentWidths,
        currentIds,
        currentArticles,
      );

      currentWidths.pop();
      currentIds.pop();
      currentArticles.pop();
    }
  }

  backtrack(targetWidth, 0, [], [], []);

  // Sort by score descending and return top candidates
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, MAX_CANDIDATES);
}

/**
 * Keep only one module per unique width (preferring the first encountered).
 */
function deduplicateByWidth(modules: CabinetRead[]): CabinetRead[] {
  const seen = new Set<number>();
  const result: CabinetRead[] = [];

  for (const mod of modules) {
    if (!seen.has(mod.width)) {
      seen.add(mod.width);
      result.push(mod);
    }
  }

  return result;
}
