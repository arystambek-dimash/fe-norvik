/**
 * Comprehensive tests for planner-v2.ts — exercises the algorithm with
 * realistic cabinet DB data to verify:
 *   1. No gaps between adjacent modules (cursor contiguity)
 *   2. Antresols placed above every upper/tall when floorToCeiling=true
 *   3. Scoring penalizes configs with unfillable antresol segments
 *   4. Small-kitchen edge cases (200mm СБ auto-fill)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { planKitchen, resetModuleCounter } from './planner-v2';
import type { PlannerInput } from './types';
import type { CabinetRead } from '@/types/entities';
import { CabinetKind, CabinetSubtype, CabinetType } from '@/types/enums';

// ── Helpers: build realistic cabinet DB ─────────────────────────────────────

let _cabId = 1;
function cab(
  overrides: Partial<CabinetRead> & Pick<CabinetRead, 'article' | 'width' | 'height' | 'depth' | 'kind' | 'type'>,
): CabinetRead {
  return {
    id: _cabId++,
    created_at: null,
    updated_at: null,
    article: overrides.article,
    kind: overrides.kind,
    type: overrides.type,
    subtype: overrides.subtype ?? CabinetSubtype.STANDARD,
    category_id: 1,
    price: '0',
    width: overrides.width,
    height: overrides.height,
    depth: overrides.depth,
    inbuilt: overrides.inbuilt ?? false,
    is_corner: overrides.is_corner ?? false,
    drawer_count: overrides.drawer_count ?? null,
    description: null,
    glb_file: null,
  };
}

function buildModules(): CabinetRead[] {
  _cabId = 1;
  return [
    // Lower doors (С series, kind=door, type=lower)
    cab({ article: 'С 200', width: 200, height: 820, depth: 470, kind: CabinetKind.DOOR, type: CabinetType.LOWER }),
    cab({ article: 'С 400', width: 400, height: 820, depth: 470, kind: CabinetKind.DOOR, type: CabinetType.LOWER }),
    cab({ article: 'С 450', width: 450, height: 820, depth: 470, kind: CabinetKind.DOOR, type: CabinetType.LOWER }),
    cab({ article: 'С 500', width: 500, height: 820, depth: 470, kind: CabinetKind.DOOR, type: CabinetType.LOWER }),
    cab({ article: 'С 601', width: 600, height: 820, depth: 470, kind: CabinetKind.DOOR, type: CabinetType.LOWER }),
    cab({ article: 'С 800', width: 800, height: 820, depth: 470, kind: CabinetKind.DOOR, type: CabinetType.LOWER }),

    // Upper П series (kind=door, type=upper) — note П 601 has width=601
    cab({ article: 'П 200', width: 200, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'П 400', width: 400, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'П 450', width: 450, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'П 500', width: 500, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'П 601', width: 601, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'П 800', width: 800, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),

    // Upper ВП series (kind=door, type=upper) — width correct
    cab({ article: 'ВП 200', width: 200, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ВП 400', width: 400, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ВП 450', width: 450, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ВП 500', width: 500, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ВП 601', width: 600, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ВП 800', width: 800, height: 720, depth: 291, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),

    // Antresol ВПГ (kind=antresol, h=450, d=300)
    cab({ article: 'ВПГ 400', width: 400, height: 450, depth: 300, kind: CabinetKind.ANTRESOL, type: CabinetType.UPPER }),
    cab({ article: 'ВПГ 450', width: 450, height: 450, depth: 300, kind: CabinetKind.ANTRESOL, type: CabinetType.UPPER }),
    cab({ article: 'ВПГ 500', width: 500, height: 450, depth: 300, kind: CabinetKind.ANTRESOL, type: CabinetType.UPPER }),
    cab({ article: 'ВПГ 600', width: 600, height: 450, depth: 300, kind: CabinetKind.ANTRESOL, type: CabinetType.UPPER }),
    cab({ article: 'ВПГ 800', width: 800, height: 450, depth: 300, kind: CabinetKind.ANTRESOL, type: CabinetType.UPPER }),

    // ПГ (kind=door, type=upper — stored as regular uppers in DB, antresols by function)
    cab({ article: 'ПГ 400', width: 400, height: 350, depth: 300, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ПГ 450', width: 450, height: 350, depth: 300, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ПГ 500', width: 500, height: 350, depth: 300, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ПГ 600', width: 600, height: 350, depth: 300, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),
    cab({ article: 'ПГ 800', width: 800, height: 350, depth: 300, kind: CabinetKind.DOOR, type: CabinetType.UPPER }),

    // ГВПГ (kind=antresol_fridge, h=450, d=600)
    cab({ article: 'ГВПГ 400', width: 400, height: 450, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГВПГ 450', width: 450, height: 450, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГВПГ 500', width: 500, height: 450, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГВПГ 600', width: 600, height: 450, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГВПГ 800', width: 800, height: 450, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),

    // ГПГ (kind=antresol_fridge, h=350, d=600)
    cab({ article: 'ГПГ 400', width: 400, height: 350, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГПГ 450', width: 450, height: 350, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГПГ 500', width: 500, height: 350, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГПГ 600', width: 600, height: 350, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),
    cab({ article: 'ГПГ 800', width: 800, height: 350, depth: 600, kind: CabinetKind.ANTRESOL_FRIDGE, type: CabinetType.UPPER }),

    // Sink
    cab({ article: 'СМ 601', width: 600, height: 820, depth: 470, kind: CabinetKind.SINK, type: CabinetType.LOWER, subtype: CabinetSubtype.SINK_BASE }),
    cab({ article: 'СМ 800', width: 800, height: 820, depth: 470, kind: CabinetKind.SINK, type: CabinetType.LOWER, subtype: CabinetSubtype.SINK_BASE }),

    // Drawer units
    cab({ article: 'СЯШ 400', width: 400, height: 820, depth: 470, kind: CabinetKind.DRAWER_UNIT, type: CabinetType.LOWER }),
    cab({ article: 'СЯШ 600', width: 600, height: 820, depth: 470, kind: CabinetKind.DRAWER_UNIT, type: CabinetType.LOWER }),

    // Plate (inbuilt)
    cab({ article: 'С 600', width: 600, height: 820, depth: 470, kind: CabinetKind.PLATE, type: CabinetType.LOWER, inbuilt: true }),

    // Fridge
    cab({ article: 'Холодильник', width: 600, height: 2050, depth: 600, kind: CabinetKind.FRIDGE, type: CabinetType.TALL }),

    // Penal
    cab({ article: 'ПН 600', width: 600, height: 2118, depth: 600, kind: CabinetKind.PENAL, type: CabinetType.TALL }),

    // Side panel (drawer_unit kind per DB)
    cab({ article: 'СБ 200', width: 200, height: 820, depth: 470, kind: CabinetKind.DRAWER_UNIT, type: CabinetType.LOWER }),

    // Corner lower (not used in these tests but included for completeness)
    cab({ article: 'СУ 1100', width: 1100, height: 820, depth: 600, kind: CabinetKind.DOOR, type: CabinetType.LOWER, is_corner: true }),
  ];
}

// ── Base input factory ─────────────────────────────────────────────────────

function baseInput(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    walls: [{ id: 'w1', length: 3000, anchors: [] }],
    corners: [],
    modules: buildModules(),
    goldenRules: [],
    roomWidth: 4000,
    roomDepth: 3000,
    wallHeight: 2700,
    layoutType: 'linear',
    floorToCeiling: false,
    useSidePanel200: false,
    useHood: false,
    sinkModuleWidth: 600,
    drawerHousingWidth: 400,
    fridgeSide: 'right',
    useInbuiltStove: true,
    selectedStoveId: null,
    selectedLowerCornerCabinetId: null,
    selectedUpperCornerCabinetId: null,
    ...overrides,
  };
}

// ── Gap / contiguity checker ───────────────────────────────────────────────

type TierKey = string;

/** Groups modules by wall + tier and checks that adjacent modules are contiguous. */
function checkNoGaps(modules: { x: number; width: number; type: string; wallId: string; yOffset?: number }[]) {
  const tiers = new Map<TierKey, typeof modules>();
  for (const m of modules) {
    let t: string;
    if (m.type === 'filler') {
      const upperAntY = 1400 + 720; // UPPER_Y + default upper height
      if (m.yOffset != null && m.yOffset >= upperAntY) t = 'antresol';
      else if (m.yOffset != null) t = 'upper';
      else t = 'lower';
    } else {
      t = m.type;
    }
    const k = `${m.wallId}:${t}`;
    if (!tiers.has(k)) tiers.set(k, []);
    tiers.get(k)!.push(m);
  }

  const errors: string[] = [];
  for (const [key, ms] of tiers) {
    if (key.includes('tall')) continue; // talls are isolated, not necessarily contiguous
    ms.sort((a, b) => a.x - b.x);
    for (let i = 1; i < ms.length; i++) {
      const prev = ms[i - 1];
      const cur = ms[i];
      const expectedX = prev.x + prev.width;
      const gap = cur.x - expectedX;
      // Allow 1mm tolerance. Also allow gaps in antresol tier between work-zone
      // and tall-zone modules (they're separated by the fridge/penal body).
      const isAntresolTier = key.includes('antresol');
      const maxAllowedGap = isAntresolTier ? 200 : 1; // antresols span across tall zone gap
      if (Math.abs(gap) > maxAllowedGap) {
        errors.push(
          `${key}: gap=${gap}mm between module at x=${prev.x}+${prev.width}=${expectedX} and next at x=${cur.x}`
        );
      }
    }
  }
  return errors;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('planner-v2', () => {
  beforeEach(() => resetModuleCounter());

  describe('Test 1: Basic 3000mm wall — no gaps', () => {
    it('should produce a plan with 0 gaps in lower and upper tiers', () => {
      const input = baseInput({
        walls: [{
          id: 'w1', length: 3000,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      const best = variants[0];
      const mods = best.plan.walls[0].modules;

      // Check no gaps
      const gaps = checkNoGaps(mods);
      expect(gaps).toEqual([]);

      // Verify total coverage: lower tier should cover work zone 0..2400 plus tall zone 2400..3000
      const lowerMods = mods.filter(m => m.type === 'lower' || (m.type === 'filler' && m.yOffset == null));
      lowerMods.sort((a, b) => a.x - b.x);
      if (lowerMods.length > 0) {
        const firstX = lowerMods[0].x;
        const lastEnd = lowerMods[lowerMods.length - 1].x + lowerMods[lowerMods.length - 1].width;
        expect(firstX).toBe(0);
        expect(lastEnd).toBe(2400); // work zone end (fridge at 2400)
      }

      // Verify fridge is present
      const tallMods = mods.filter(m => m.type === 'tall');
      expect(tallMods.length).toBeGreaterThan(0);
      const fridge = tallMods.find(m => m.kind === CabinetKind.FRIDGE);
      expect(fridge).toBeDefined();
    });
  });

  describe('Test 2: FloorToCeiling — antresols above every upper and tall', () => {
    it('should place antresols above every upper cabinet when floorToCeiling=true', () => {
      const input = baseInput({
        floorToCeiling: true,
        walls: [{
          id: 'w1', length: 3000,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      const best = variants[0];
      const mods = best.plan.walls[0].modules;

      // Separate tiers
      const upperAntY = 1400 + 720;
      const uppers = mods.filter(m => m.type === 'upper' || (m.type === 'filler' && m.yOffset != null && m.yOffset < upperAntY));
      const antresols = mods.filter(m => m.type === 'antresol' || (m.type === 'filler' && m.yOffset != null && m.yOffset >= upperAntY));

      // Every upper position should have an antresol at the same x
      const antXSet = new Set(antresols.map(a => a.x));
      const missingAntresol = uppers.filter(u => !antXSet.has(u.x));

      expect(missingAntresol).toEqual([]);

      // Verify antresol yOffset is correct
      for (const a of antresols) {
        expect(a.yOffset).toBe(upperAntY);
      }

      // No gaps in any tier
      const gaps = checkNoGaps(mods);
      expect(gaps).toEqual([]);
    });

    it('should place antresol above fridge (ГВПГ) at the correct yOffset', () => {
      const input = baseInput({
        floorToCeiling: true,
        walls: [{
          id: 'w1', length: 3000,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      const best = variants[0];
      const mods = best.plan.walls[0].modules;

      const fridgeMod = mods.find(m => m.kind === CabinetKind.FRIDGE);
      expect(fridgeMod).toBeDefined();

      // Find antresol above fridge
      const fridgeAnt = mods.find(m =>
        (m.type === 'antresol') && m.x === fridgeMod!.x
      );
      expect(fridgeAnt).toBeDefined();

      // yOffset should be at or above fridge height (2050), not at the generic upper+antresol Y (2120)
      // The fix uses Math.max(m.height, upperAntresolY), so for fridge (h=2050),
      // it should be max(2050, 2120) = 2120
      const expectedY = Math.max(2050, 1400 + 720); // 2120
      expect(fridgeAnt!.yOffset).toBe(expectedY);

      // And the antresol should fit within wall height
      expect(fridgeAnt!.yOffset! + fridgeAnt!.height).toBeLessThanOrEqual(2700);
    });
  });

  describe('Test 3: Small kitchen 1800mm — auto-fill 200mm segment', () => {
    it('should fill a 200mm gap without leaving visual gaps', () => {
      // Wall 1800mm, no fridge, sink at 0, plate at 800
      // Sink(600) + plate(600) + drawer(400) = 1600mm → 200mm left
      const input = baseInput({
        walls: [{
          id: 'w1', length: 1800,
          anchors: [
            { type: 'sink', position: 0, width: 600 },
            { type: 'cooktop', position: 800, width: 600 },
          ],
        }],
        // No fridge in small kitchen
        modules: buildModules().filter(m => m.kind !== CabinetKind.FRIDGE && m.kind !== CabinetKind.PENAL),
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      const best = variants[0];
      const mods = best.plan.walls[0].modules;

      // Lower tier should be contiguous from 0 to 1800
      const lowerMods = mods.filter(m => m.type === 'lower' || (m.type === 'filler' && m.yOffset == null));
      lowerMods.sort((a, b) => a.x - b.x);
      expect(lowerMods.length).toBeGreaterThan(0);

      const firstX = lowerMods[0].x;
      const lastEnd = lowerMods[lowerMods.length - 1].x + lowerMods[lowerMods.length - 1].width;
      expect(firstX).toBe(0);
      expect(lastEnd).toBe(1800);

      // No gaps
      const gaps = checkNoGaps(mods);
      expect(gaps).toEqual([]);
    });
  });

  describe('Test 4: Universal gap check — for every variant, no adjacent module gaps', () => {
    it('should produce gap-free plans across multiple scenarios', () => {
      const scenarios: { name: string; input: PlannerInput }[] = [
        {
          name: '3000mm sink+plate+fridge',
          input: baseInput({
            walls: [{
              id: 'w1', length: 3000,
              anchors: [
                { type: 'sink', position: 800, width: 600 },
                { type: 'cooktop', position: 1800, width: 600 },
              ],
            }],
          }),
        },
        {
          name: '2400mm no fridge',
          input: baseInput({
            walls: [{
              id: 'w1', length: 2400,
              anchors: [
                { type: 'sink', position: 400, width: 600 },
                { type: 'cooktop', position: 1400, width: 600 },
              ],
            }],
            modules: buildModules().filter(m => m.kind !== CabinetKind.FRIDGE && m.kind !== CabinetKind.PENAL),
          }),
        },
        {
          name: '3600mm with penal',
          input: baseInput({
            walls: [{
              id: 'w1', length: 3600,
              anchors: [
                { type: 'sink', position: 800, width: 600 },
                { type: 'cooktop', position: 2000, width: 600 },
              ],
            }],
          }),
        },
        {
          name: '3000mm floorToCeiling',
          input: baseInput({
            floorToCeiling: true,
            walls: [{
              id: 'w1', length: 3000,
              anchors: [
                { type: 'sink', position: 800, width: 600 },
                { type: 'cooktop', position: 1800, width: 600 },
              ],
            }],
          }),
        },
      ];

      for (const { name, input } of scenarios) {
        resetModuleCounter();
        const variants = planKitchen(input);
        expect(variants.length, `${name}: should produce at least 1 variant`).toBeGreaterThan(0);

        for (let vi = 0; vi < Math.min(variants.length, 3); vi++) {
          const mods = variants[vi].plan.walls[0].modules;
          const gaps = checkNoGaps(mods);
          expect(gaps, `${name} variant ${vi + 1}: found gaps:\n${gaps.join('\n')}`).toEqual([]);
        }
      }
    });
  });

  describe('Test 5: Width tolerance — П 601 (w=601) should not create drift', () => {
    it('upper modules should match lower module widths exactly, not cabinet nominal widths', () => {
      const input = baseInput({
        walls: [{
          id: 'w1', length: 3000,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      const mods = variants[0].plan.walls[0].modules;

      // Check that uppers use the lower's width, not the cabinet's nominal width
      const uppers = mods.filter(m => m.type === 'upper' && m.article !== 'filler');
      const lowers = mods.filter(m => m.type === 'lower');

      for (const up of uppers) {
        const matchingLower = lowers.find(lo => lo.x === up.x);
        if (matchingLower) {
          expect(up.width, `Upper at x=${up.x} width should match lower width`).toBe(matchingLower.width);
        }
      }

      // Specifically check that no upper has width=601 (the raw П 601 width)
      // when the lower at the same position has width=600
      for (const up of uppers) {
        const lo = lowers.find(l => l.x === up.x);
        if (lo && lo.width === 600) {
          expect(up.width).not.toBe(601);
        }
      }
    });
  });

  describe('Test 6: DP-fill edge cases', () => {
    it('should handle segments that are exact filler width (50-300mm)', () => {
      // Create a scenario where a small segment exists
      // Wall 1450mm, sink at 0 (w=600), plate at 800 (w=600):
      //   sink[0,600], drawer at 600[600,1000], plate at 800...
      // Actually let's just test the canFillWithFiller function edge case indirectly
      // by creating a wall where the leftover after specials is exactly a filler size
      const input = baseInput({
        walls: [{
          id: 'w1', length: 2250,
          anchors: [
            { type: 'sink', position: 0, width: 600 },
            { type: 'cooktop', position: 1050, width: 600 },
          ],
        }],
        modules: buildModules().filter(m => m.kind !== CabinetKind.FRIDGE && m.kind !== CabinetKind.PENAL),
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      const mods = variants[0].plan.walls[0].modules;
      const gaps = checkNoGaps(mods);
      expect(gaps).toEqual([]);
    });
  });

  describe('Test 7: Antresol prefix matching', () => {
    it('should correctly match ГВПГ prefix before ВПГ (longest-first matching)', () => {
      // This test verifies that the antresol above the fridge is ГВПГ (depth=600)
      // not ВПГ (depth=300), because ГВПГ is the correct type for fridge antresols
      const input = baseInput({
        floorToCeiling: true,
        walls: [{
          id: 'w1', length: 3000,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      const mods = variants[0].plan.walls[0].modules;
      const fridgeMod = mods.find(m => m.kind === CabinetKind.FRIDGE);
      expect(fridgeMod).toBeDefined();

      const fridgeAnt = mods.find(m =>
        m.type === 'antresol' && m.x === fridgeMod!.x && m.article !== 'filler'
      );
      expect(fridgeAnt).toBeDefined();

      // Should be ГВПГ, not ВПГ
      expect(fridgeAnt!.article.startsWith('ГВПГ')).toBe(true);
      expect(fridgeAnt!.depth).toBe(600); // deep antresol for fridge
    });
  });

  describe('Test 8: Scoring with floorToCeiling prefers full antresol coverage', () => {
    it('should rank plans with complete antresol coverage higher', () => {
      const input = baseInput({
        floorToCeiling: true,
        walls: [{
          id: 'w1', length: 3000,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      // The best variant should have good antresol coverage
      const best = variants[0];
      const mods = best.plan.walls[0].modules;

      const upperAntY = 1400 + 720;
      const uppers = mods.filter(m =>
        m.type === 'upper' || (m.type === 'filler' && m.yOffset != null && m.yOffset < upperAntY)
      );
      const antresols = mods.filter(m =>
        m.type === 'antresol' || (m.type === 'filler' && m.yOffset != null && m.yOffset >= upperAntY)
      );

      const antXSet = new Set(antresols.map(a => a.x));
      const coverage = uppers.filter(u => antXSet.has(u.x)).length / Math.max(uppers.length, 1);

      // Best variant should have at least 80% antresol coverage
      expect(coverage).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Test 9a: Non-standard wall width 3025mm — should NOT produce 0 variants', () => {
    it('should handle wall widths not divisible by 50 via slack near fridge', () => {
      const input = baseInput({
        walls: [{
          id: 'w1', length: 3025,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
        roomWidth: 3025,
      });

      const variants = planKitchen(input);
      expect(variants.length, '3025mm wall should produce at least 1 variant').toBeGreaterThan(0);

      const best = variants[0];
      const mods = best.plan.walls[0].modules;

      // Lower tier should be contiguous (no gaps between cabinets)
      const lowerTier = mods.filter(m =>
        m.type === 'lower' || (m.type === 'filler' && m.yOffset == null)
      ).sort((a, b) => a.x - b.x);

      for (let i = 1; i < lowerTier.length; i++) {
        const prev = lowerTier[i - 1];
        const cur = lowerTier[i];
        const gap = cur.x - (prev.x + prev.width);
        expect(Math.abs(gap), `Gap between lowers at x=${prev.x + prev.width} and x=${cur.x}`).toBeLessThanOrEqual(1);
      }

      // Fridge should exist
      const fridge = mods.find(m => m.kind === CabinetKind.FRIDGE);
      expect(fridge).toBeDefined();

      // Gap between work zone end and fridge is acceptable (up to 50mm)
      if (lowerTier.length > 0 && fridge) {
        const workEnd = lowerTier[lowerTier.length - 1].x + lowerTier[lowerTier.length - 1].width;
        const gap = fridge.x - workEnd;
        expect(gap, 'Gap between last lower and fridge should be ≤ 50mm').toBeLessThanOrEqual(50);
        expect(gap, 'Gap between last lower and fridge should be ≥ 0').toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle various non-standard widths', () => {
      for (const wallLen of [2510, 2775, 3025, 3333, 3517]) {
        resetModuleCounter();
        const input = baseInput({
          walls: [{
            id: 'w1', length: wallLen,
            anchors: [
              { type: 'sink', position: 400, width: 600 },
              { type: 'cooktop', position: 1400, width: 600 },
            ],
          }],
          roomWidth: wallLen,
        });

        const variants = planKitchen(input);
        expect(
          variants.length,
          `Wall ${wallLen}mm should produce at least 1 variant`
        ).toBeGreaterThan(0);

        // Verify no gaps in lower tier
        const mods = variants[0].plan.walls[0].modules;
        const gaps = checkNoGaps(mods);
        expect(gaps, `Wall ${wallLen}mm gaps: ${gaps.join(', ')}`).toEqual([]);
      }
    });
  });

  describe('Test 9b: Lower tier contiguity with cursor pattern', () => {
    it('adjacent lower modules should satisfy mod[i+1].x === mod[i].x + mod[i].width', () => {
      const input = baseInput({
        walls: [{
          id: 'w1', length: 3000,
          anchors: [
            { type: 'sink', position: 800, width: 600 },
            { type: 'cooktop', position: 1800, width: 600 },
          ],
        }],
      });

      const variants = planKitchen(input);
      expect(variants.length).toBeGreaterThan(0);

      for (const v of variants.slice(0, 3)) {
        const mods = v.plan.walls[0].modules;
        const lowerTier = mods.filter(m =>
          m.type === 'lower' || (m.type === 'filler' && m.yOffset == null)
        ).sort((a, b) => a.x - b.x);

        for (let i = 1; i < lowerTier.length; i++) {
          const prev = lowerTier[i - 1];
          const cur = lowerTier[i];
          const expected = prev.x + prev.width;
          expect(
            Math.abs(cur.x - expected),
            `Lower contiguity: prev ends at ${expected}, next starts at ${cur.x} (gap=${cur.x - expected})`
          ).toBeLessThanOrEqual(1); // 1mm tolerance
        }
      }
    });
  });
});
