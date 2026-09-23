// The collage as a list of drawing steps. Pure: the same plan drives the Preview and the export,
// and it can be tested without a canvas (research R11, R22).
import { frameImage, type SourceRect } from '../model/frame';
import { cellsInReadingOrder } from '../model/layout';
import { dividerLinesPx, layoutPixels, styleScale } from '../model/geometry';
import type { Doc, NRect, Pt, Size } from '../model/types';

export type DrawOp =
  | { op: 'fill'; color: string; rect: NRect }
  /** Clip to a cell: a rounded rectangle, or `path` (px) for shaped cells. Paired with a `restore`. */
  | { op: 'clip'; rect: NRect; r: number; path?: Pt[] }
  | { op: 'image'; assetId: string; src: SourceRect; dest: NRect }
  | { op: 'restore' }
  /** The gap along a divider, drawn in the background color with round caps and joins. */
  | { op: 'stroke'; points: Pt[]; width: number; color: string };

export function planDraw(
  doc: Doc,
  assets: (id: string) => { width: number; height: number } | undefined,
  sizePx: Size,
): DrawOp[] {
  const ops: DrawOp[] = [{ op: 'fill', color: doc.style.color, rect: { x: 0, y: 0, w: sizePx.w, h: sizePx.h } }];
  const images = new Map(cellsInReadingOrder(doc.layout).map((c) => [c.id, c.image]));

  for (const cell of layoutPixels(doc, sizePx)) {
    const rect = { x: cell.x, y: cell.y, w: cell.w, h: cell.h };
    ops.push(cell.polygon ? { op: 'clip', rect, r: cell.r, path: cell.polygon } : { op: 'clip', rect, r: cell.r });
    const image = images.get(cell.cellId);
    const asset = image && assets(image.assetId);
    // Empty cells (or photos no longer loaded) just show the background (FR-033).
    if (image && asset) ops.push({ op: 'image', assetId: image.assetId, src: frameImage(cell, asset, image), dest: rect });
    ops.push({ op: 'restore' });
  }

  const gap = doc.style.gap * styleScale(sizePx);
  if (gap > 0) {
    for (const line of dividerLinesPx(doc, sizePx)) {
      ops.push({ op: 'stroke', points: line.points, width: gap, color: doc.style.color });
    }
  }
  return ops;
}
