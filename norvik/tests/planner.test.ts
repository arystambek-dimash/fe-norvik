import { describe, it, expect, beforeEach } from 'vitest';
import { planKitchen, resetModuleCounter, solveSegment, buildModuleMaps } from '../src/algorithm/planner';
import { GoldenTable } from '../src/algorithm/golden-table';
import type { CabinetRead } from '../src/types/entities';
import type { PlannerInput, Segment } from '../src/algorithm/types';
import { CabinetKind, CabinetType, CabinetSubtype } from '../src/types/enums';

let nextId = 1000;

function makeCabinet(overrides: Partial<CabinetRead> = {}): CabinetRead {
  const id = overrides.id ?? nextId++;
  return {
    id,
    article: overrides.article ?? `CAB-${id}`,
    kind: CabinetKind.DOOR,
    type: CabinetType.LOWER,
    subtype: CabinetSubtype.STANDARD,
    category_id: 1,
    price: '100.00',
    width: 300,
    height: 820,
    depth: 470,
    inbuilt: false,
    is_corner: false,
    drawer_count: null,
    description: null,
    glb_file: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function standardModules(): CabinetRead[] {
  return [
    makeCabinet({ width: 150, article: 'W150' }),
    makeCabinet({ width: 200, article: 'W200' }),
    makeCabinet({ width: 250, article: 'W250' }),
    makeCabinet({ width: 300, article: 'W300' }),
    makeCabinet({ width: 350, article: 'W350' }),
    makeCabinet({ width: 400, article: 'W400' }),
    makeCabinet({ width: 450, article: 'W450' }),
    makeCabinet({ width: 500, article: 'W500' }),
    makeCabinet({ width: 600, article: 'W600' }),
    makeCabinet({ width: 750, article: 'W750' }),
    makeCabinet({ width: 900, article: 'W900' }),
  ];
}

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  const start = overrides.start ?? 0;
  const width = overrides.width ?? 600;
  return {
    wallId: 'wall-0',
    start,
    end: start + width,
    width,
    context: 'standard',
    isTrim: false,
    ...overrides,
  };
}

describe('solveSegment', () => {
  let modules: CabinetRead[];
  let maps: ReturnType<typeof buildModuleMaps>;
  let goldenTable: GoldenTable;

  beforeEach(() => {
    resetModuleCounter();
    nextId = 1000;
    modules = standardModules();
    maps = buildModuleMaps(modules);
    goldenTable = new GoldenTable();
  });

  it('finds solutions for exact-match width (600mm)', () => {
    const segment = makeSegment({ width: 600 });
    const solutions = solveSegment(segment, goldenTable, modules, maps);
    expect(solutions.length).toBeGreaterThan(0);
    // Every solution should sum to segment width
    for (const sol of solutions) {
      const totalWidth = sol.reduce((s, m) => s + m.width, 0);
      expect(totalWidth).toBe(600);
    }
  });

  it('finds solutions for non-50-divisible width (730mm) via filler', () => {
    const segment = makeSegment({ width: 730 });
    const solutions = solveSegment(segment, goldenTable, modules, maps);
    expect(solutions.length).toBeGreaterThan(0);
    // Total placed width (modules + fillers) should equal segment width
    for (const sol of solutions) {
      const totalWidth = sol.reduce((s, m) => s + m.width, 0);
      expect(totalWidth).toBe(730);
    }
    // At least one solution should contain a filler
    const hasFiller = solutions.some((sol) =>
      sol.some((m) => m.type === 'filler'),
    );
    expect(hasFiller).toBe(true);
  });

  it('returns full-filler for width below smallest module (100mm)', () => {
    const segment = makeSegment({ width: 100 });
    const solutions = solveSegment(segment, goldenTable, modules, maps);
    expect(solutions.length).toBeGreaterThan(0);
    // Should be a single filler
    expect(solutions[0]).toHaveLength(1);
    expect(solutions[0][0].type).toBe('filler');
    expect(solutions[0][0].width).toBe(100);
  });

  it('returns empty for trim segments', () => {
    const segment = makeSegment({ width: 30, isTrim: true });
    const solutions = solveSegment(segment, goldenTable, modules, maps);
    expect(solutions).toEqual([[]]);
  });

  it('never returns [[]] for a non-trim segment with positive width', () => {
    // Test various awkward widths
    const awkwardWidths = [51, 73, 99, 101, 137, 211, 333, 487, 631, 777, 999];
    for (const w of awkwardWidths) {
      const segment = makeSegment({ width: w });
      const solutions = solveSegment(segment, goldenTable, modules, maps);
      expect(solutions.length).toBeGreaterThan(0);
      // At least one non-empty solution
      const hasNonEmpty = solutions.some((sol) => sol.length > 0);
      expect(hasNonEmpty).toBe(true);
      // Width should always sum correctly
      for (const sol of solutions) {
        if (sol.length > 0) {
          const totalWidth = sol.reduce((s, m) => s + m.width, 0);
          expect(totalWidth).toBe(w);
        }
      }
    }
  });

  it('places modules with correct x positions starting from segment.start', () => {
    const segment = makeSegment({ start: 1200, width: 600 });
    const solutions = solveSegment(segment, goldenTable, modules, maps);
    expect(solutions.length).toBeGreaterThan(0);
    for (const sol of solutions) {
      if (sol.length === 0) continue;
      // First module starts at segment.start
      expect(sol[0].x).toBe(1200);
      // Modules are contiguous
      for (let i = 1; i < sol.length; i++) {
        expect(sol[i].x).toBe(sol[i - 1].x + sol[i - 1].width);
      }
    }
  });
});

describe('planKitchen integration', () => {
  beforeEach(() => {
    resetModuleCounter();
    nextId = 1000;
  });

  function makeInput(overrides: Partial<PlannerInput> = {}): PlannerInput {
    return {
      walls: [{ id: 'Back Wall', length: 2800, anchors: [] }],
      corners: [],
      modules: standardModules(),
      goldenRules: [],
      roomWidth: 2800,
      roomDepth: 3000,
      wallHeight: 2700,
      layoutType: 'linear',
      floorToCeiling: false,
      useSidePanel200: false,
      useHood: false,
      sinkModuleWidth: 600,
      drawerHousingWidth: 400,
      ...overrides,
    };
  }

  it('generates variants for a simple wall with no anchors', () => {
    const input = makeInput();
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      expect(v.plan.walls).toHaveLength(1);
      expect(v.plan.walls[0].modules.length).toBeGreaterThan(0);
    }
  });

  it('generates variants with sink+cooktop anchors', () => {
    const input = makeInput({
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [
          { type: 'sink', position: 0, width: 600 },
          { type: 'cooktop', position: 600, width: 600 },
        ],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    // Remaining segment is 1600mm — should be fully filled
    for (const v of variants) {
      const lowerModules = v.plan.walls[0].modules.filter(
        (m) => m.type === 'lower' || m.type === 'filler',
      );
      const totalWidth = lowerModules.reduce((s, m) => s + m.width, 0);
      // Lower modules should fill the 1600mm segment
      expect(totalWidth).toBe(1600);
    }
  });

  it('handles non-grid-aligned anchor positions', () => {
    // Anchor at position 130 (not a multiple of 50)
    const input = makeInput({
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [
          { type: 'sink', position: 130, width: 600 },
        ],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    // Segments: [0-130]=130mm, [730-2800]=2070mm
    // Both should produce solutions (130mm = filler, 2070mm = modules+filler)
    for (const v of variants) {
      const lowerModules = v.plan.walls[0].modules.filter(
        (m) => m.type === 'lower' || m.type === 'filler',
      );
      const totalWidth = lowerModules.reduce((s, m) => s + m.width, 0);
      // Total placed width should equal wall - anchor width (2800-600=2200)
      expect(totalWidth).toBe(2200);
    }
  });

  it('coverage invariant: module widths + anchor widths = wall length', () => {
    const wallLength = 2800;
    const anchors = [
      { type: 'sink' as const, position: 200, width: 600 },
      { type: 'cooktop' as const, position: 1400, width: 600 },
    ];
    const anchorTotal = anchors.reduce((s, a) => s + a.width, 0);
    const input = makeInput({
      walls: [{ id: 'Back Wall', length: wallLength, anchors }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      const lowerModules = v.plan.walls[0].modules.filter(
        (m) => m.type === 'lower' || m.type === 'filler',
      );
      const moduleTotal = lowerModules.reduce((s, m) => s + m.width, 0);
      expect(moduleTotal + anchorTotal).toBe(wallLength);
    }
  });

  it('places drawer unit after sink when room is available', () => {
    const sinkModule = makeCabinet({
      width: 600, article: 'СМ 600',
      kind: CabinetKind.SINK, subtype: CabinetSubtype.SINK_BASE,
    });
    const drawerUnit = makeCabinet({
      width: 400, article: 'СЯШ 400',
      kind: CabinetKind.DRAWER_UNIT, subtype: CabinetSubtype.DRAWER_ONLY,
    });
    const input = makeInput({
      modules: [...standardModules(), sinkModule, drawerUnit],
      sinkModuleWidth: 600,
      drawerHousingWidth: 400,
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [{ type: 'sink', position: 0, width: 600 }],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    // Drawer should be placed at x=600 (right after sink)
    for (const v of variants) {
      const drawer = v.plan.walls[0].modules.find(
        (m) => m.kind === CabinetKind.DRAWER_UNIT && m.subtype === CabinetSubtype.DRAWER_ONLY,
      );
      expect(drawer).toBeDefined();
      expect(drawer!.x).toBe(600);
    }
  });

  it('places drawer unit before the sink when no room after', () => {
    const sinkModule = makeCabinet({
      width: 600, article: 'СМ 600',
      kind: CabinetKind.SINK, subtype: CabinetSubtype.SINK_BASE,
    });
    const drawerUnit = makeCabinet({
      width: 400, article: 'СЯШ 400',
      kind: CabinetKind.DRAWER_UNIT, subtype: CabinetSubtype.DRAWER_ONLY,
    });
    const input = makeInput({
      modules: [...standardModules(), sinkModule, drawerUnit],
      sinkModuleWidth: 600,
      drawerHousingWidth: 400,
      walls: [{
        id: 'Back Wall',
        length: 2800,
        // Sink at position 2200 — only 600mm left, no room for 400mm drawer after
        anchors: [{ type: 'sink', position: 2200, width: 600 }],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    // Drawer should be placed before the sink when no room after
    for (const v of variants) {
      const drawer = v.plan.walls[0].modules.find(
        (m) => m.kind === CabinetKind.DRAWER_UNIT && m.subtype === CabinetSubtype.DRAWER_ONLY,
      );
      expect(drawer).toBeDefined();
      expect(drawer!.x).toBeLessThan(2200); // placed before sink
    }
  });

  it('does not place drawer unit when another anchor blocks placement after sink', () => {
    const sinkModule = makeCabinet({
      width: 600, article: 'СМ 600',
      kind: CabinetKind.SINK, subtype: CabinetSubtype.SINK_BASE,
    });
    const drawerUnit = makeCabinet({
      width: 400, article: 'СЯШ 400',
      kind: CabinetKind.DRAWER_UNIT, subtype: CabinetSubtype.DRAWER_ONLY,
    });
    const input = makeInput({
      modules: [...standardModules(), sinkModule, drawerUnit],
      sinkModuleWidth: 600,
      drawerHousingWidth: 400,
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [
          // Sink at 0-600, cooktop at 800-1400 — only 200mm gap, drawer (400mm) won't fit
          { type: 'sink', position: 0, width: 600 },
          { type: 'cooktop', position: 800, width: 600 },
        ],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    // Drawer should NOT overlap the cooktop — must not be placed at x=600
    for (const v of variants) {
      const drawer = v.plan.walls[0].modules.find(
        (m) => m.kind === CabinetKind.DRAWER_UNIT && m.subtype === CabinetSubtype.DRAWER_ONLY,
      );
      // Drawer can't go after sink because it would overlap the cooktop anchor.
      // It must not be moved elsewhere, so this configuration stays without a drawer.
      expect(drawer).toBeUndefined();
    }
  });

  it('places drawer unit right after an adjacent dishwasher', () => {
    const sinkModule = makeCabinet({
      width: 600, article: 'СМ 600',
      kind: CabinetKind.SINK, subtype: CabinetSubtype.SINK_BASE,
    });
    const dishwasher = makeCabinet({
      width: 600, article: 'ПММ 600',
    });
    const drawerUnit = makeCabinet({
      width: 400, article: 'СЯШ 400',
      kind: CabinetKind.DRAWER_UNIT, subtype: CabinetSubtype.DRAWER_ONLY,
    });
    const input = makeInput({
      modules: [dishwasher, sinkModule, drawerUnit],
      sinkModuleWidth: 600,
      drawerHousingWidth: 400,
      walls: [{
        id: 'Back Wall',
        length: 1800,
        anchors: [{ type: 'sink', position: 0, width: 600 }],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      const dishwasherModule = v.plan.walls[0].modules.find(
        (m) => m.type === 'lower' && m.article.startsWith('ПММ'),
      );
      const drawer = v.plan.walls[0].modules.find(
        (m) => m.kind === CabinetKind.DRAWER_UNIT && m.subtype === CabinetSubtype.DRAWER_ONLY,
      );

      expect(dishwasherModule).toBeDefined();
      expect(dishwasherModule!.x).toBe(600);
      expect(drawer).toBeDefined();
      expect(drawer!.x).toBe(1200);
    }
  });

  it('auto-places СБ 200 in exact 200mm sink-cooktop gap', () => {
    const sinkModule = makeCabinet({
      width: 600, article: 'СМ 600',
      kind: CabinetKind.SINK, subtype: CabinetSubtype.SINK_BASE,
    });
    const sidePanel = makeCabinet({
      width: 200, article: 'СБ 200',
      kind: CabinetKind.DOOR, subtype: CabinetSubtype.STANDARD,
    });
    const input = makeInput({
      modules: [...standardModules(), sinkModule, sidePanel],
      sinkModuleWidth: 600,
      useSidePanel200: true, // flag ON — auto-place in 200mm gap
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [
          { type: 'sink', position: 0, width: 600 },
          { type: 'cooktop', position: 800, width: 600 },
        ],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      // Should have СБ 200 at position 600-800 (the 200mm gap)
      const panel = v.plan.walls[0].modules.find(
        (m) => m.article.startsWith('СБ') && m.x >= 599 && m.x <= 601,
      );
      expect(panel).toBeDefined();
      expect(panel!.width).toBe(200);
    }
  });

  it('does not auto-place СБ 200 when gap is not exactly 200mm', () => {
    const sinkModule = makeCabinet({
      width: 600, article: 'СМ 600',
      kind: CabinetKind.SINK, subtype: CabinetSubtype.SINK_BASE,
    });
    const sidePanel = makeCabinet({
      width: 200, article: 'СБ 200',
      kind: CabinetKind.DOOR, subtype: CabinetSubtype.STANDARD,
    });
    const input = makeInput({
      modules: [...standardModules(), sinkModule, sidePanel],
      sinkModuleWidth: 600,
      useSidePanel200: false,
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [
          { type: 'sink', position: 0, width: 600 },
          // 400mm gap (not 200mm) — should NOT auto-place СБ
          { type: 'cooktop', position: 1000, width: 600 },
        ],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      const panel = v.plan.walls[0].modules.find(
        (m) => m.article.startsWith('СБ') && m.x >= 599 && m.x <= 601,
      );
      expect(panel).toBeUndefined();
    }
  });

  it('produces no gaps — all segments have at least one module or filler', () => {
    const input = makeInput({
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [
          { type: 'sink', position: 0, width: 600 },
          { type: 'cooktop', position: 1000, width: 600 },
        ],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);
    // Segments: [600-1000]=400mm, [1600-2800]=1200mm
    // Both should have modules
    for (const v of variants) {
      const lowerModules = v.plan.walls[0].modules.filter(
        (m) => m.type === 'lower' || m.type === 'filler',
      );
      expect(lowerModules.length).toBeGreaterThan(0);
      const totalWidth = lowerModules.reduce((s, m) => s + m.width, 0);
      // Should fill all segments: 400 + 1200 = 1600mm
      expect(totalWidth).toBe(1600);
    }
  });
});
