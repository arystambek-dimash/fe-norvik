import type { Anchor, Segment, SegmentContext, WallConfig } from './types';
import { MIN_SEGMENT, MODULE_GRID } from './constants';

/** Snap a value to the nearest multiple of the grid (default 50mm). */
export function snapToGrid(value: number, grid: number = MODULE_GRID): number {
  return Math.round(value / grid) * grid;
}

/**
 * Determine the context for a segment based on adjacent anchors.
 * If any adjacent anchor is a sink, the segment context is 'sink'.
 */
function resolveContext(
  leftAnchor: Anchor | null,
  rightAnchor: Anchor | null,
): SegmentContext {
  if (leftAnchor?.type === 'sink' || rightAnchor?.type === 'sink') {
    return 'sink';
  }
  return 'standard';
}

/**
 * Splits a wall into segments around its anchors.
 *
 * Each anchor occupies a fixed zone [position, position + width].
 * The gaps between anchors (and between wall edges and anchors) become segments.
 * Segments with width <= MIN_SEGMENT are marked as trim.
 *
 * @param cornerOffset Optional offset to reduce effective wall length.
 *   `startOffset` shifts the starting cursor (corner at the start of wall).
 *   `endOffset` reduces the wall end (corner at the end of wall).
 */
export function segmentWall(
  wall: WallConfig,
  cornerOffset?: { startOffset?: number; endOffset?: number },
): Segment[] {
  const sortedAnchors = [...wall.anchors].sort((a, b) => a.position - b.position);
  const segments: Segment[] = [];
  let cursor = cornerOffset?.startOffset ?? 0;
  const effectiveEnd = wall.length - (cornerOffset?.endOffset ?? 0);

  for (let i = 0; i < sortedAnchors.length; i++) {
    const anchor = sortedAnchors[i];
    const anchorStart = anchor.position;
    const anchorEnd = anchor.position + anchor.width;

    // Gap before this anchor
    if (anchorStart > cursor) {
      const width = anchorStart - cursor;
      const leftAnchor = i > 0 ? sortedAnchors[i - 1] : null;
      const rightAnchor = anchor;

      segments.push({
        wallId: wall.id,
        start: cursor,
        end: anchorStart,
        width,
        context: resolveContext(leftAnchor, rightAnchor),
        isTrim: width <= MIN_SEGMENT,
      });
    }

    // Move cursor past this anchor
    cursor = anchorEnd;
  }

  // Gap after the last anchor to the end of the wall
  if (cursor < effectiveEnd) {
    const width = effectiveEnd - cursor;
    const lastAnchor = sortedAnchors.length > 0
      ? sortedAnchors[sortedAnchors.length - 1]
      : null;

    segments.push({
      wallId: wall.id,
      start: cursor,
      end: effectiveEnd,
      width,
      context: resolveContext(lastAnchor, null),
      isTrim: width <= MIN_SEGMENT,
    });
  }

  return segments;
}

/**
 * Splits a wall into segments for upper cabinet placement.
 *
 * Unlike `segmentWall`, this only blocks on cooktop anchors (hood zone).
 * Sink and oven anchors are ignored — upper cabinets CAN go above them.
 */
export function segmentWallForUppers(
  wall: WallConfig,
  cornerOffset?: { startOffset?: number; endOffset?: number },
): Segment[] {
  const cooktopAnchors = [...wall.anchors]
    .filter((a) => a.type === 'cooktop')
    .sort((a, b) => a.position - b.position);

  const segments: Segment[] = [];
  let cursor = cornerOffset?.startOffset ?? 0;
  const effectiveEnd = wall.length - (cornerOffset?.endOffset ?? 0);

  for (const anchor of cooktopAnchors) {
    const anchorStart = anchor.position;
    const anchorEnd = anchor.position + anchor.width;

    if (anchorStart > cursor) {
      const width = anchorStart - cursor;
      segments.push({
        wallId: wall.id,
        start: cursor,
        end: anchorStart,
        width,
        context: 'standard',
        isTrim: width <= MIN_SEGMENT,
      });
    }
    cursor = anchorEnd;
  }

  if (cursor < effectiveEnd) {
    const width = effectiveEnd - cursor;
    segments.push({
      wallId: wall.id,
      start: cursor,
      end: effectiveEnd,
      width,
      context: 'standard',
      isTrim: width <= MIN_SEGMENT,
    });
  }

  return segments;
}
