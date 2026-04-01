export interface RoomConfig {
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  lShapedSide?: 'left' | 'right';
  sideWallWidth?: number;
}

export interface LShapedSideWallLayout {
  side: 'left' | 'right';
  length: number;
  centerZ: number;
}

interface SideWallPlacementInput {
  side: 'left' | 'right';
  roomWidth: number;
  distanceFromWall: number;
  centerAlongWall: number;
}

export function getLShapedSideWallLayout(
  roomConfig: Pick<RoomConfig, 'roomDepth' | 'sideWallWidth' | 'lShapedSide'>,
): LShapedSideWallLayout {
  const length = roomConfig.sideWallWidth ?? roomConfig.roomDepth;
  return {
    side: roomConfig.lShapedSide ?? 'left',
    length,
    centerZ: length / 2,
  };
}

export function getSideWallPlacement({
  side,
  roomWidth,
  distanceFromWall,
  centerAlongWall,
}: SideWallPlacementInput): { x: number; z: number; rotationY: number } {
  return {
    x: side === 'right' ? roomWidth - distanceFromWall : distanceFromWall,
    z: centerAlongWall,
    rotationY: side === 'right' ? -Math.PI / 2 : Math.PI / 2,
  };
}
