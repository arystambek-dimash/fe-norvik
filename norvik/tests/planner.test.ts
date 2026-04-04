import { describe, it, expect, beforeEach } from 'vitest';
import { planKitchen, resetModuleCounter, solveSegment, buildModuleMaps } from '../src/algorithm/planner';
import { GoldenTable } from '../src/algorithm/golden-table';
import type { CabinetRead } from '../src/types/entities';
import type { PlannerInput, Segment } from '../src/algorithm/types';
import { CabinetKind, CabinetType, CabinetSubtype } from '../src/types/enums';
import { deriveInput } from '../src/algorithm/derive-input';

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
      fridgeSide: 'right',
      useInbuiltStove: true,
      selectedStoveId: null,
      selectedLowerCornerCabinetId: null,
      selectedUpperCornerCabinetId: null,
      ...overrides,
    };
  }

  it('derives left L-shaped corner on the back-wall start', () => {
    const input = deriveInput({
      roomWidth: 2800,
      roomDepth: 2500,
      wallHeight: 2700,
      layoutType: 'l-shaped',
      lShapedSide: 'left',
      walls: [
        { id: 'Back Wall', length: 2800, anchors: [] },
        { id: 'Left Wall', length: 1800, anchors: [] },
      ],
      anchors: {
        'Back Wall': [],
        'Left Wall': [],
      },
      availableCabinets: standardModules(),
    });

    expect(input.corners).toHaveLength(1);
    expect(input.corners[0].wallA).toEqual({ wallId: 'Back Wall', end: 'start' });
    expect(input.corners[0].wallB).toEqual({ wallId: 'Left Wall', end: 'start' });
  });

  it('keeps lower modules out of the back-wall corner zone for left L-shaped layouts', () => {
    const input = makeInput({
      layoutType: 'l-shaped',
      walls: [
        { id: 'Back Wall', length: 2800, anchors: [] },
        { id: 'Left Wall', length: 1800, anchors: [] },
      ],
      corners: [{
        id: 'corner-0',
        wallA: { wallId: 'Back Wall', end: 'start' },
        wallB: { wallId: 'Left Wall', end: 'start' },
        angle: 90,
      }],
      roomDepth: 1800,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const backWallLower = variant.plan.walls[0].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Back Wall',
      );
      const sideWallLower = variant.plan.walls[1].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Left Wall',
      );

      expect(backWallLower.length).toBeGreaterThan(0);
      expect(sideWallLower.length).toBeGreaterThan(0);
      expect(Math.min(...backWallLower.map((m) => m.x))).toBeGreaterThanOrEqual(600);
      expect(Math.min(...sideWallLower.map((m) => m.x))).toBeGreaterThanOrEqual(600);
    }
  });

  it('keeps lower modules out of the back-wall corner zone for right L-shaped layouts', () => {
    const input = makeInput({
      layoutType: 'l-shaped',
      walls: [
        { id: 'Back Wall', length: 2800, anchors: [] },
        { id: 'Right Wall', length: 1800, anchors: [] },
      ],
      corners: [{
        id: 'corner-0',
        wallA: { wallId: 'Back Wall', end: 'end' },
        wallB: { wallId: 'Right Wall', end: 'start' },
        angle: 90,
      }],
      roomDepth: 1800,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const backWallLower = variant.plan.walls[0].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Back Wall',
      );
      const sideWallLower = variant.plan.walls[1].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Right Wall',
      );

      expect(backWallLower.length).toBeGreaterThan(0);
      expect(sideWallLower.length).toBeGreaterThan(0);
      expect(Math.max(...backWallLower.map((m) => m.x + m.width))).toBeLessThanOrEqual(2200);
      expect(Math.min(...sideWallLower.map((m) => m.x))).toBeGreaterThanOrEqual(600);
    }
  });

  it('uses the selected lower corner cabinet width for L-shaped reservation', () => {
    const lowerCorner = makeCabinet({
      id: 5001,
      article: 'СУ 1100',
      type: CabinetType.LOWER,
      width: 1100,
      depth: 600,
      is_corner: true,
    });
    const fallbackLowerCorner = makeCabinet({
      id: 5002,
      article: 'СУ 800',
      type: CabinetType.LOWER,
      width: 800,
      depth: 600,
      is_corner: true,
    });

    const input = makeInput({
      layoutType: 'l-shaped',
      modules: [...standardModules(), fallbackLowerCorner, lowerCorner],
      walls: [
        { id: 'Back Wall', length: 3700, anchors: [] },
        { id: 'Left Wall', length: 1800, anchors: [] },
      ],
      corners: [{
        id: 'corner-0',
        wallA: { wallId: 'Back Wall', end: 'start' },
        wallB: { wallId: 'Left Wall', end: 'start' },
        angle: 90,
      }],
      roomWidth: 3700,
      roomDepth: 1800,
      selectedLowerCornerCabinetId: 5001,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const backWallLower = variant.plan.walls[0].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Back Wall',
      );
      const sideWallLower = variant.plan.walls[1].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Left Wall',
      );

      expect(Math.min(...backWallLower.map((m) => m.x))).toBeGreaterThanOrEqual(1100);
      expect(Math.min(...sideWallLower.map((m) => m.x))).toBeGreaterThanOrEqual(1100);
      expect(variant.plan.cornerModules.some((m) => m.article === 'СУ 1100')).toBe(true);
    }
  });

  it('adds the selected upper corner cabinet as a separate corner module', () => {
    const lowerCorner = makeCabinet({
      id: 5101,
      article: 'СУ 900',
      type: CabinetType.LOWER,
      width: 900,
      depth: 600,
      is_corner: true,
    });
    const upperCorner = makeCabinet({
      id: 5102,
      article: 'ВУ 900',
      type: CabinetType.UPPER,
      width: 900,
      height: 720,
      depth: 320,
      is_corner: true,
    });

    const input = makeInput({
      layoutType: 'l-shaped',
      modules: [...standardModules(), lowerCorner, upperCorner],
      walls: [
        { id: 'Back Wall', length: 3200, anchors: [] },
        { id: 'Left Wall', length: 1800, anchors: [] },
      ],
      corners: [{
        id: 'corner-0',
        wallA: { wallId: 'Back Wall', end: 'start' },
        wallB: { wallId: 'Left Wall', end: 'start' },
        angle: 90,
      }],
      roomWidth: 3200,
      roomDepth: 1800,
      selectedLowerCornerCabinetId: 5101,
      selectedUpperCornerCabinetId: 5102,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const upperCornerModule = variant.plan.cornerModules.find((m) => m.article === 'ВУ 900');
      expect(upperCornerModule).toBeDefined();
      expect(upperCornerModule?.yOffset).toBe(1400);
    }
  });

  it('keeps L-shaped tall modules on the back wall when fridge side is left', () => {
    const lowerCorner = makeCabinet({
      id: 5201,
      article: 'СУ 600',
      type: CabinetType.LOWER,
      width: 600,
      depth: 600,
      is_corner: true,
    });
    const fridge = makeCabinet({
      id: 5202,
      article: 'Х 600',
      type: CabinetType.TALL,
      kind: CabinetKind.FRIDGE,
      width: 600,
      height: 2100,
      depth: 600,
    });
    const penal = makeCabinet({
      id: 5203,
      article: 'П 300',
      type: CabinetType.TALL,
      kind: CabinetKind.PENAL,
      width: 300,
      height: 2100,
      depth: 600,
    });

    const input = makeInput({
      layoutType: 'l-shaped',
      modules: [...standardModules(), lowerCorner, fridge, penal],
      walls: [
        { id: 'Back Wall', length: 5000, anchors: [] },
        { id: 'Left Wall', length: 2200, anchors: [] },
      ],
      corners: [{
        id: 'corner-0',
        wallA: { wallId: 'Back Wall', end: 'start' },
        wallB: { wallId: 'Left Wall', end: 'start' },
        angle: 90,
      }],
      roomWidth: 5000,
      roomDepth: 2200,
      fridgeSide: 'left',
      selectedLowerCornerCabinetId: 5201,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const backTall = variant.plan.walls[0].modules.filter(
        (m) => m.type === 'tall' && m.wallId === 'Back Wall',
      );
      const sideTall = variant.plan.walls[1].modules.filter(
        (m) => m.type === 'tall' && m.wallId === 'Left Wall',
      );
      const backLower = variant.plan.walls[0].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Back Wall',
      );

      expect(backTall.map((m) => m.article).sort()).toEqual(['П 300', 'Х 600']);
      expect(sideTall).toHaveLength(0);
      expect(Math.min(...backTall.map((m) => m.x))).toBeGreaterThanOrEqual(600);
      expect(Math.min(...backLower.map((m) => m.x))).toBeGreaterThanOrEqual(1500);
    }
  });

  it('keeps L-shaped tall modules on the side wall when fridge side is right', () => {
    const lowerCorner = makeCabinet({
      id: 5301,
      article: 'СУ 600',
      type: CabinetType.LOWER,
      width: 600,
      depth: 600,
      is_corner: true,
    });
    const fridge = makeCabinet({
      id: 5302,
      article: 'Х 600',
      type: CabinetType.TALL,
      kind: CabinetKind.FRIDGE,
      width: 600,
      height: 2100,
      depth: 600,
    });
    const penal = makeCabinet({
      id: 5303,
      article: 'П 300',
      type: CabinetType.TALL,
      kind: CabinetKind.PENAL,
      width: 300,
      height: 2100,
      depth: 600,
    });

    const input = makeInput({
      layoutType: 'l-shaped',
      modules: [...standardModules(), lowerCorner, fridge, penal],
      walls: [
        { id: 'Back Wall', length: 5000, anchors: [] },
        { id: 'Right Wall', length: 5000, anchors: [] },
      ],
      corners: [{
        id: 'corner-0',
        wallA: { wallId: 'Back Wall', end: 'end' },
        wallB: { wallId: 'Right Wall', end: 'start' },
        angle: 90,
      }],
      roomWidth: 5000,
      roomDepth: 5000,
      fridgeSide: 'right',
      selectedLowerCornerCabinetId: 5301,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const backTall = variant.plan.walls[0].modules.filter(
        (m) => m.type === 'tall' && m.wallId === 'Back Wall',
      );
      const sideTall = variant.plan.walls[1].modules.filter(
        (m) => m.type === 'tall' && m.wallId === 'Right Wall',
      );
      const sideLower = variant.plan.walls[1].modules.filter(
        (m) => (m.type === 'lower' || m.type === 'filler') && m.wallId === 'Right Wall',
      );

      expect(backTall).toHaveLength(0);
      expect(sideTall.map((m) => m.article).sort()).toEqual(['П 300', 'Х 600']);
      expect(Math.min(...sideTall.map((m) => m.x))).toBeGreaterThanOrEqual(4100);
      expect(Math.max(...sideLower.map((m) => m.x + m.width))).toBeLessThanOrEqual(4100);
    }
  });

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

  it('prefers placing СБ 200 into a matching left filler and aligns ВП 200 above it', () => {
    const sinkModule = makeCabinet({
      width: 600, article: 'СМ 600',
      kind: CabinetKind.SINK, subtype: CabinetSubtype.SINK_BASE,
    });
    const drawerUnit = makeCabinet({
      width: 400, article: 'СЯШ 400',
      kind: CabinetKind.DRAWER_UNIT, subtype: CabinetSubtype.DRAWER_ONLY,
    });
    const sidePanel = makeCabinet({
      width: 200, article: 'СБ 200',
      kind: CabinetKind.DOOR, subtype: CabinetSubtype.STANDARD,
    });
    const upper200 = makeCabinet({
      width: 200, article: 'ВП 200',
      type: CabinetType.UPPER,
      kind: CabinetKind.DOOR,
    });
    const upper600 = makeCabinet({
      width: 600, article: 'ВП 600',
      type: CabinetType.UPPER,
      kind: CabinetKind.DOOR,
    });
    const input = makeInput({
      modules: [
        makeCabinet({ width: 300, article: 'W300' }),
        makeCabinet({ width: 400, article: 'W400' }),
        makeCabinet({ width: 500, article: 'W500' }),
        makeCabinet({ width: 600, article: 'W600' }),
        sinkModule,
        drawerUnit,
        sidePanel,
        upper200,
        upper600,
      ],
      sinkModuleWidth: 600,
      drawerHousingWidth: 400,
      useSidePanel200: true,
      walls: [{
        id: 'Back Wall',
        length: 2800,
        anchors: [
          { type: 'sink', position: 0, width: 600 },
          { type: 'cooktop', position: 1200, width: 600 },
        ],
      }],
    });
    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    const matched = variants.some((variant) => {
      const sidePanelLeftOfCooktop = variant.plan.walls[0].modules.find(
        (m) => m.article.startsWith('СБ') && m.x === 1000,
      );
      const upper200Above = variant.plan.walls[0].modules.find(
        (m) => m.type === 'upper' && m.width === 200 && m.x === 1000,
      );
      return sidePanelLeftOfCooktop && upper200Above;
    });

    expect(matched).toBe(true);
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

  it('places the fridge after the full lower run including filler on non-grid wall lengths', () => {
    const sinkModule = makeCabinet({
      width: 600,
      article: 'СМ 600',
      kind: CabinetKind.SINK,
      subtype: CabinetSubtype.SINK_BASE,
    });
    const plateModule = makeCabinet({
      width: 600,
      article: 'СПУ 600',
      kind: CabinetKind.PLATE,
      type: CabinetType.LOWER,
      inbuilt: true,
    });
    const drawerUnit = makeCabinet({
      width: 400,
      article: 'СЯШ 400',
      kind: CabinetKind.DRAWER_UNIT,
      subtype: CabinetSubtype.DRAWER_ONLY,
    });
    const fridge = makeCabinet({
      width: 600,
      article: 'Х 600',
      kind: CabinetKind.FRIDGE,
      type: CabinetType.TALL,
      height: 2100,
      depth: 600,
    });

    const input = makeInput({
      roomWidth: 3001,
      walls: [{
        id: 'Back Wall',
        length: 3001,
        anchors: [
          { type: 'sink', position: 0, width: 600 },
          { type: 'cooktop', position: 1000, width: 600 },
        ],
      }],
      modules: [...standardModules(), sinkModule, plateModule, drawerUnit, fridge],
      sinkModuleWidth: 600,
      drawerHousingWidth: 400,
      fridgeSide: 'right',
      useInbuiltStove: true,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    const wall = variants[0].plan.walls[0];
    const fridgeModule = wall.modules.find(
      (m) => m.type === 'tall' && m.kind === CabinetKind.FRIDGE,
    );
    expect(fridgeModule).toBeDefined();

    const filler801 = wall.modules.find(
      (m) => m.type === 'filler' && m.width === 801,
    );
    expect(filler801).toBeUndefined();

    const regular400Modules = wall.modules.filter(
      (m) => m.type === 'lower' && m.article === 'W400',
    );
    expect(regular400Modules).toHaveLength(2);
    expect(regular400Modules.map((m) => m.x).sort((a, b) => a - b)).toEqual([1600, 2000]);

    const lowerAndFillers = wall.modules.filter(
      (m) => m.type === 'lower' || m.type === 'filler',
    );
    const fullLowerEnd = Math.max(...lowerAndFillers.map((m) => m.x + m.width));
    expect(fridgeModule!.x).toBe(fullLowerEnd);
    expect(fridgeModule!.x).toBe(2400);
    expect(fridgeModule!.x + fridgeModule!.width).toBe(3000);
  });

  it('uses a 450 module instead of FILLER-452 on the edge opposite the fridge', () => {
    const fridge = makeCabinet({
      width: 600,
      article: 'Х 600',
      kind: CabinetKind.FRIDGE,
      type: CabinetType.TALL,
      height: 2100,
      depth: 600,
    });

    const input = makeInput({
      roomWidth: 1052,
      walls: [{
        id: 'Back Wall',
        length: 1052,
        anchors: [],
      }],
      modules: [...standardModules(), fridge],
      fridgeSide: 'left',
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    const wall = variants[0].plan.walls[0];
    const filler452 = wall.modules.find(
      (m) => m.type === 'filler' && m.width === 452,
    );
    expect(filler452).toBeUndefined();

    const module450 = wall.modules.find(
      (m) => m.type === 'lower' && m.article === 'W450',
    );
    expect(module450).toBeDefined();
    expect(module450!.x).toBe(600);

    const fridgeModule = wall.modules.find(
      (m) => m.type === 'tall' && m.kind === CabinetKind.FRIDGE,
    );
    expect(fridgeModule).toBeDefined();
    expect(fridgeModule!.x + fridgeModule!.width).toBe(module450!.x);
  });

  it('compacts the fridge against the first real module instead of leaving a filler beside it', () => {
    const sinkModule = makeCabinet({
      width: 800,
      article: 'СМ 800',
      kind: CabinetKind.SINK,
      subtype: CabinetSubtype.SINK_BASE,
    });
    const plateModule = makeCabinet({
      width: 600,
      article: 'СПУ 600',
      kind: CabinetKind.PLATE,
      type: CabinetType.LOWER,
      inbuilt: true,
    });
    const drawerUnit = makeCabinet({
      width: 400,
      article: 'СЯШ 400',
      kind: CabinetKind.DRAWER_UNIT,
      subtype: CabinetSubtype.DRAWER_ONLY,
    });
    const fridge = makeCabinet({
      width: 600,
      article: 'Х 600',
      kind: CabinetKind.FRIDGE,
      type: CabinetType.TALL,
      height: 2100,
      depth: 600,
    });

    const input = makeInput({
      roomWidth: 3125,
      walls: [{
        id: 'Back Wall',
        length: 3125,
        anchors: [
          { type: 'sink', position: 900, width: 800 },
          { type: 'cooktop', position: 2100, width: 600 },
        ],
      }],
      modules: [
        ...standardModules().filter((m) => m.width >= 400),
        sinkModule,
        plateModule,
        drawerUnit,
        fridge,
      ],
      sinkModuleWidth: 800,
      drawerHousingWidth: 400,
      fridgeSide: 'left',
      useInbuiltStove: true,
    });

    const variants = planKitchen(input);
    expect(variants.length).toBeGreaterThan(0);

    const wall = variants[0].plan.walls[0];
    const filler300 = wall.modules.find(
      (m) => m.type === 'filler' && m.width === 300,
    );
    expect(filler300).toBeUndefined();

    const fridgeModule = wall.modules.find(
      (m) => m.type === 'tall' && m.kind === CabinetKind.FRIDGE,
    );
    const sinkBase = wall.modules.find(
      (m) => m.type === 'lower' && m.kind === CabinetKind.SINK,
    );

    expect(fridgeModule).toBeDefined();
    expect(sinkBase).toBeDefined();
    expect(fridgeModule!.x + fridgeModule!.width).toBe(sinkBase!.x);
    expect(fridgeModule!.x).toBe(300);
  });
});
