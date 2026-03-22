import type { CabinetRead } from '@/types/entities';
import type { SolverCandidate } from './types';

const MAX_CANDIDATES = 40;

/**
 * Score a single candidate combination.
 * Prefers: fewer modules, larger widths, uniform sizes.
 */
function scoreCandidate(widths: number[]): number {
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

  return countScore * 0.3 + sizeScore * 0.3 + uniformityScore * 0.4;
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
): SolverCandidate[] {
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
        score: scoreCandidate(currentWidths),
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

  console.log(result);
  return result;
}
