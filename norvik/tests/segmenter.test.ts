import { describe, it, expect } from 'vitest';
import { segmentWall, segmentWallForUppers, snapToGrid } from '../src/algorithm/segmenter';
import type { WallConfig } from '../src/algorithm/types';

function makeWall(length: number, anchors: WallConfig['anchors'] = []): WallConfig {
  return { id: 'wall-0', length, anchors };
}

describe('segmentWall', () => {
  it('returns single segment for wall with no anchors', () => {
    const segments = segmentWall(makeWall(2800));
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      start: 0,
      end: 2800,
      width: 2800,
      isTrim: false,
    });
  });

  it('creates two segments for one anchor in the middle', () => {
    const wall = makeWall(2800, [
      { type: 'sink', position: 1000, width: 600 },
    ]);
    const segments = segmentWall(wall);
    expect(segments).toHaveLength(2);
    // Before anchor
    expect(segments[0]).toMatchObject({ start: 0, end: 1000, width: 1000 });
    // After anchor
    expect(segments[1]).toMatchObject({ start: 1600, end: 2800, width: 1200 });
  });

  it('creates segments around two adjacent anchors', () => {
    const wall = makeWall(2800, [
      { type: 'sink', position: 0, width: 600 },
      { type: 'cooktop', position: 600, width: 600 },
    ]);
    const segments = segmentWall(wall);
    // Only one segment after the two anchors
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 1200, end: 2800, width: 1600 });
  });

  it('creates three segments for two non-adjacent anchors', () => {
    const wall = makeWall(3000, [
      { type: 'sink', position: 500, width: 600 },
      { type: 'cooktop', position: 1500, width: 600 },
    ]);
    const segments = segmentWall(wall);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ start: 0, end: 500, width: 500 });
    expect(segments[1]).toMatchObject({ start: 1100, end: 1500, width: 400 });
    expect(segments[2]).toMatchObject({ start: 2100, end: 3000, width: 900 });
  });

  it('marks small gaps as isTrim', () => {
    const wall = makeWall(1000, [
      { type: 'sink', position: 30, width: 600 },
    ]);
    const segments = segmentWall(wall);
    // First gap is 30mm < MIN_SEGMENT (50), should be trim
    expect(segments[0]).toMatchObject({ width: 30, isTrim: true });
    // Second gap is 370mm, not trim
    expect(segments[1]).toMatchObject({ width: 370, isTrim: false });
  });

  it('applies corner offsets', () => {
    const wall = makeWall(2800);
    const segments = segmentWall(wall, { startOffset: 600, endOffset: 600 });
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 600, end: 2200, width: 1600 });
  });

  it('segment widths + anchor widths = wall length (invariant)', () => {
    const wall = makeWall(2800, [
      { type: 'sink', position: 200, width: 600 },
      { type: 'cooktop', position: 1400, width: 600 },
    ]);
    const segments = segmentWall(wall);
    const segmentTotal = segments.reduce((s, seg) => s + seg.width, 0);
    const anchorTotal = wall.anchors.reduce((s, a) => s + a.width, 0);
    expect(segmentTotal + anchorTotal).toBe(wall.length);
  });

  it('handles anchor at position 0', () => {
    const wall = makeWall(2000, [
      { type: 'sink', position: 0, width: 600 },
    ]);
    const segments = segmentWall(wall);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 600, end: 2000, width: 1400 });
  });

  it('handles anchor at wall end', () => {
    const wall = makeWall(2000, [
      { type: 'sink', position: 1400, width: 600 },
    ]);
    const segments = segmentWall(wall);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 0, end: 1400, width: 1400 });
  });

  it('sorts unsorted anchors correctly', () => {
    const wall = makeWall(3000, [
      { type: 'cooktop', position: 1500, width: 600 },
      { type: 'sink', position: 500, width: 600 },
    ]);
    const segments = segmentWall(wall);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ start: 0, end: 500 });
    expect(segments[1]).toMatchObject({ start: 1100, end: 1500 });
    expect(segments[2]).toMatchObject({ start: 2100, end: 3000 });
  });
});

describe('segmentWallForUppers', () => {
  it('ignores sink and oven anchors', () => {
    const wall = makeWall(2800, [
      { type: 'sink', position: 0, width: 600 },
      { type: 'oven', position: 1200, width: 600 },
    ]);
    const segments = segmentWallForUppers(wall);
    // Should produce a single segment spanning the full wall
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 0, end: 2800, width: 2800 });
  });

  it('blocks on cooktop anchors only', () => {
    const wall = makeWall(2800, [
      { type: 'sink', position: 0, width: 600 },
      { type: 'cooktop', position: 1000, width: 600 },
    ]);
    const segments = segmentWallForUppers(wall);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ start: 0, end: 1000, width: 1000 });
    expect(segments[1]).toMatchObject({ start: 1600, end: 2800, width: 1200 });
  });

  it('applies corner offsets', () => {
    const wall = makeWall(2800, [
      { type: 'cooktop', position: 1000, width: 600 },
    ]);
    const segments = segmentWallForUppers(wall, { startOffset: 600 });
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ start: 600, end: 1000, width: 400 });
    expect(segments[1]).toMatchObject({ start: 1600, end: 2800, width: 1200 });
  });
});

describe('snapToGrid', () => {
  it('snaps values to nearest 50', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(24)).toBe(0);
    expect(snapToGrid(25)).toBe(50);
    expect(snapToGrid(49)).toBe(50);
    expect(snapToGrid(50)).toBe(50);
    expect(snapToGrid(74)).toBe(50);
    expect(snapToGrid(75)).toBe(100);
    expect(snapToGrid(100)).toBe(100);
    expect(snapToGrid(625)).toBe(650);
    expect(snapToGrid(1234)).toBe(1250);
  });

  it('accepts custom grid size', () => {
    expect(snapToGrid(130, 100)).toBe(100);
    expect(snapToGrid(150, 100)).toBe(200);
    expect(snapToGrid(249, 100)).toBe(200);
  });

  it('handles exact grid values', () => {
    expect(snapToGrid(600)).toBe(600);
    expect(snapToGrid(2800)).toBe(2800);
  });
});
