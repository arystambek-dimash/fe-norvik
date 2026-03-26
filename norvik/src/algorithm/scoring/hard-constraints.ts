import type { KitchenPlan, WallPlan, PlacedModule } from '../types';
import type { ScoringContext, HardConstraintResult, ScoringAnchor } from './types';
import { getWallLength } from './helpers';
import { MIN_SINK_COOKTOP_GAP, LOWER_DEPTH, MIN_SEGMENT, MIN_AISLE_CLEARANCE } from '../constants';

const MIN_FILLER_WIDTH = MIN_SEGMENT; // mm

type Tier = 'lower' | 'upper' | 'antresol';

function getTier(mod: PlacedModule): Tier | null {
  if (mod.type === 'lower') return 'lower';
  if (mod.type === 'upper') return 'upper';
  if (mod.type === 'antresol') return 'antresol';
  return null;
}

function checkModuleOverlap(wall: WallPlan, violations: string[]): void {
  const byTier: Record<Tier, PlacedModule[]> = { lower: [], upper: [], antresol: [] };

  for (const mod of wall.modules) {
    if (mod.type === 'filler') continue;
    const tier = getTier(mod);
    if (tier) byTier[tier].push(mod);
  }

  for (const tier of ['lower', 'upper', 'antresol'] as Tier[]) {
    const mods = byTier[tier];
    for (let i = 0; i < mods.length; i++) {
      for (let j = i + 1; j < mods.length; j++) {
        const a = mods[i];
        const b = mods[j];
        if (a.x < b.x + b.width && a.x + a.width > b.x) {
          violations.push(
            `Modules overlap on wall ${wall.wallId}: ${a.article} and ${b.article}`,
          );
        }
      }
    }
  }
}

function checkModulesInBounds(
  wall: WallPlan,
  wallLength: number,
  violations: string[],
): void {
  for (const mod of wall.modules) {
    if (mod.x + mod.width > wallLength) {
      violations.push(
        `Module ${mod.article} exceeds wall ${wall.wallId} bounds`,
      );
    }
  }
}

function checkLeftoverWidth(
  wall: WallPlan,
  wallLength: number,
  violations: string[],
): void {
  // Only check lower and upper tiers — antresols sit above them, not beside
  const widthByTier: Record<'lower' | 'upper', number> = { lower: 0, upper: 0 };

  for (const mod of wall.modules) {
    const tier = getTier(mod);
    if (tier === 'lower' || tier === 'upper') widthByTier[tier] += mod.width;
  }

  for (const tier of ['lower', 'upper'] as const) {
    const totalWidth = widthByTier[tier];
    if (totalWidth === 0) continue;

    const gap = wallLength - totalWidth;
    if (gap > 0 && gap < MIN_FILLER_WIDTH) {
      violations.push(
        `Bad leftover ${gap}mm on wall ${wall.wallId} (${tier} tier) — too small for any filler`,
      );
    }
  }
}

function checkAisleClearance(
  context: ScoringContext,
  violations: string[],
): void {
  const clearance = context.roomDepth - LOWER_DEPTH;
  if (clearance < MIN_AISLE_CLEARANCE) {
    violations.push(
      `Aisle too narrow: ${clearance}mm (minimum ${MIN_AISLE_CLEARANCE}mm)`,
    );
  }
}

function checkSinkCooktopGap(
  context: ScoringContext,
  violations: string[],
): void {
  // Group anchors by wall
  const byWall = new Map<string, ScoringAnchor[]>();
  for (const a of context.anchors) {
    if (!byWall.has(a.wallId)) byWall.set(a.wallId, []);
    byWall.get(a.wallId)!.push(a);
  }

  for (const [wallId, anchors] of byWall) {
    const sinks = anchors.filter((a) => a.type === 'sink');
    const cooktops = anchors.filter((a) => a.type === 'cooktop');
    for (const s of sinks) {
      const sEnd = s.position + s.width;
      for (const c of cooktops) {
        const cEnd = c.position + c.width;
        const gap = Math.max(c.position - sEnd, s.position - cEnd);
        if (gap >= 0 && gap < MIN_SINK_COOKTOP_GAP) {
          violations.push(
            `Sink and cooktop too close on wall ${wallId}: ${gap}mm gap (minimum ${MIN_SINK_COOKTOP_GAP}mm)`,
          );
        }
      }
    }
  }
}

export function validateHardConstraints(
  plan: KitchenPlan,
  context: ScoringContext,
): HardConstraintResult {
  const violations: string[] = [];

  plan.walls.forEach((wall, index) => {
    const wallLength = getWallLength(index, context);

    checkModuleOverlap(wall, violations);
    checkModulesInBounds(wall, wallLength, violations);
    checkLeftoverWidth(wall, wallLength, violations);
  });

  checkAisleClearance(context, violations);
  checkSinkCooktopGap(context, violations);

  return { valid: violations.length === 0, violations };
}
