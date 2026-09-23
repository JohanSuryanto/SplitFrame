// Photo framing inside a cell: cover fit, zoom and focus point.
import { ZOOM_MAX, type CellImage, type PxCell } from './types';

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface AssetSize {
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function resetFraming(): Pick<CellImage, 'zoom' | 'focusX' | 'focusY'> {
  return { zoom: 1, focusX: 0.5, focusY: 0.5 };
}

/** Scale from image px to cell px, and the crop size, for a given zoom. */
function crop(cell: Pick<PxCell, 'w' | 'h'>, asset: AssetSize, zoom: number) {
  const s = Math.max(cell.w / asset.width, cell.h / asset.height) * zoom;
  return { s, sw: Math.min(cell.w / s, asset.width), sh: Math.min(cell.h / s, asset.height) };
}

/** Focus for a crop centered at (cx, cy) in image px, clamped so the crop stays inside the image. */
function focusFor(cx: number, cy: number, sw: number, sh: number, asset: AssetSize) {
  return {
    focusX: clamp(cx, sw / 2, asset.width - sw / 2) / asset.width,
    focusY: clamp(cy, sh / 2, asset.height - sh / 2) / asset.height,
  };
}

/** Moves the photo with the pointer by (dx, dy) cell px. The stored focus is clamped. */
export function panBy(img: CellImage, dx: number, dy: number, cell: Pick<PxCell, 'w' | 'h'>, asset: AssetSize): CellImage {
  if (cell.w <= 0 || cell.h <= 0) return img;
  const cur = frameImage(cell, asset, img);
  const { s, sw, sh } = crop(cell, asset, Math.max(img.zoom, 1));
  const cx = cur.sx + cur.sw / 2 - dx / s;
  const cy = cur.sy + cur.sh / 2 - dy / s;
  return { ...img, ...focusFor(cx, cy, sw, sh, asset) };
}

/** Zooms by `factor` around `point` (cell px), keeping the photo under the point fixed. Zoom stays in [1, ZOOM_MAX]. */
export function zoomAt(
  img: CellImage,
  factor: number,
  point: { x: number; y: number },
  cell: Pick<PxCell, 'w' | 'h'>,
  asset: AssetSize,
): CellImage {
  if (cell.w <= 0 || cell.h <= 0) return img;
  const zoom = clamp(Math.max(img.zoom, 1) * factor, 1, ZOOM_MAX);
  const cur = frameImage(cell, asset, img);
  const before = crop(cell, asset, Math.max(img.zoom, 1));
  // Image point under the pointer before the zoom.
  const ix = cur.sx + point.x / before.s;
  const iy = cur.sy + point.y / before.s;
  const after = crop(cell, asset, zoom);
  const cx = ix - point.x / after.s + after.sw / 2;
  const cy = iy - point.y / after.s + after.sh / 2;
  return { ...img, zoom, ...focusFor(cx, cy, after.sw, after.sh, asset) };
}

/**
 * The part of the image shown in the cell. Always matches the cell's aspect ratio and
 * always lies inside the image, so a photo can never leave empty space in its cell.
 */
export function frameImage(cell: Pick<PxCell, 'w' | 'h'>, asset: AssetSize, img: CellImage): SourceRect {
  const { width: aw, height: ah } = asset;
  if (cell.w <= 0 || cell.h <= 0 || aw <= 0 || ah <= 0) return { sx: 0, sy: 0, sw: aw, sh: ah };
  const cover = Math.max(cell.w / aw, cell.h / ah);
  const s = cover * Math.max(img.zoom, 1);
  const sw = Math.min(cell.w / s, aw);
  const sh = Math.min(cell.h / s, ah);
  const cx = clamp(img.focusX * aw, sw / 2, aw - sw / 2);
  const cy = clamp(img.focusY * ah, sh / 2, ah - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}
