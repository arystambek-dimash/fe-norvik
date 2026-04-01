import { describe, expect, it } from 'vitest';
import {
  getLShapedSideWallLayout,
  getSideWallPlacement,
} from '../src/components/viewer3d/scene-layout';

describe('getLShapedSideWallLayout', () => {
  it('uses sideWallWidth for the visible L-wall span', () => {
    const layout = getLShapedSideWallLayout({
      roomDepth: 2600,
      sideWallWidth: 1400,
      lShapedSide: 'left',
    });

    expect(layout).toEqual({
      side: 'left',
      length: 1400,
      centerZ: 700,
    });
  });

  it('falls back to roomDepth when sideWallWidth is missing', () => {
    const layout = getLShapedSideWallLayout({
      roomDepth: 2600,
      lShapedSide: 'right',
    });

    expect(layout).toEqual({
      side: 'right',
      length: 2600,
      centerZ: 1300,
    });
  });
});

describe('getSideWallPlacement', () => {
  it('keeps left-wall objects flush to the wall and aligned from the corner', () => {
    const placement = getSideWallPlacement({
      side: 'left',
      roomWidth: 3000,
      distanceFromWall: 235,
      centerAlongWall: 900,
    });

    expect(placement).toEqual({
      x: 235,
      z: 900,
      rotationY: Math.PI / 2,
    });
  });

  it('keeps right-wall objects flush to the wall and aligned from the corner', () => {
    const placement = getSideWallPlacement({
      side: 'right',
      roomWidth: 3000,
      distanceFromWall: 235,
      centerAlongWall: 900,
    });

    expect(placement).toEqual({
      x: 2765,
      z: 900,
      rotationY: -Math.PI / 2,
    });
  });
});
