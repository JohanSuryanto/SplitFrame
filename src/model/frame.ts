// Photo framing inside a cell: zoom and focus point. At zoom ≥ 1 the photo covers its cell; below 1
// it zooms out toward "fit" and stays inside the cell on the axes where it's smaller (feature 004,
// research P1). placeImage is the one source of truth for the canvas, Preview, export and Adjust.
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

type Box = Pick<PxCell, 'w' | 'h'>;

/** Zoom snaps to exactly "fill" within this distance (FR-316). */
export const ZOOM_SNAP = 0.05;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const valid = (cell: Box, asset: AssetSize) => cell.w > 0 && cell.h > 0 && asset.width > 0 && asset.height > 0;

/** Scale from image px to cell px at zoom 1: the photo just covers the cell. */
const coverScale = (cell: Box, asset: AssetSize) => Math.max(cell.w / asset.width, cell.h / asset.height);

export function resetFraming(): Pick<CellImage, 'zoom' | 'focusX' | 'focusY'> {
  return { zoom: 1, focusX: 0.5, focusY: 0.5 };
}

/** "Fit": the zoom at which the whole photo is visible in the cell (≤ 1). */
export function zoomMin(cell: Box, asset: AssetSize): number {
  if (!valid(cell, asset)) return 1;
  return Math.min(cell.w / asset.width, cell.h / asset.height) / coverScale(cell, asset);
}

/** The zoom actually shown: clamped to [fit, ZOOM_MAX]. The cell's shape can change after framing. */
export function effectiveZoom(cell: Box, asset: AssetSize, zoom: number): number {
  return clamp(zoom, zoomMin(cell, asset), ZOOM_MAX);
}

/** Snaps to exactly 1 (fill) when close. */
export function snapZoom(zoom: number): number {
  return Math.abs(zoom - 1) <= ZOOM_SNAP ? 1 : zoom;
}

export interface ImagePlacement {
  /** Image px → cell px. */
  scale: number;
  /** Top-left of the whole displayed image, relative to the cell (negative when it overflows). */
  x0: number;
  y0: number;
  /** The visible part of the image, in image px. */
  src: SourceRect;
  /** Where that part is drawn, relative to the cell; the whole cell when the photo covers it. */
  dest: { x: number; y: number; w: number; h: number };
}

/**
 * One axis. When the photo is at least as long as the cell it covers it (the visible span is
 * clamped inside the image); when shorter, it is drawn whole and kept inside the cell.
 */
function placeAxis(L: number, a: number, s: number, focus: number) {
  const span = L / s;
  if (span <= a) {
    const c = clamp(focus * a, span / 2, a - span / 2);
    const src = c - span / 2;
    return { src, size: span, dest: 0, destSize: L, x0: -src * s };
  }
  const D = a * s;
  const x0 = clamp(L / 2 - focus * D, 0, L - D);
  return { src: 0, size: a, dest: x0, destSize: D, x0 };
}

/** The focus (0–1) that puts the image's leading edge at x0, clamped by the same per-axis rule. */
function focusForOffset(L: number, a: number, s: number, x0: number): number {
  const span = L / s;
  if (span <= a) return clamp((L / 2 - x0) / s, span / 2, a - span / 2) / a;
  const D = a * s;
  return (L / 2 - clamp(x0, 0, L - D)) / D;
}

export function placeImage(cell: Box, asset: AssetSize, img: CellImage): ImagePlacement {
  const { width: aw, height: ah } = asset;
  if (!valid(cell, asset)) {
    return { scale: 1, x0: 0, y0: 0, src: { sx: 0, sy: 0, sw: aw, sh: ah }, dest: { x: 0, y: 0, w: cell.w, h: cell.h } };
  }
  const s = coverScale(cell, asset) * effectiveZoom(cell, asset, img.zoom);
  const x = placeAxis(cell.w, aw, s, img.focusX);
  const y = placeAxis(cell.h, ah, s, img.focusY);
  return {
    scale: s,
    x0: x.x0,
    y0: y.x0,
    src: { sx: x.src, sy: y.src, sw: x.size, sh: y.size },
    dest: { x: x.dest, y: y.dest, w: x.destSize, h: y.destSize },
  };
}

/** The part of the image shown in the cell (see placeImage for where it is drawn). */
export function frameImage(cell: Box, asset: AssetSize, img: CellImage): SourceRect {
  return placeImage(cell, asset, img).src;
}

/** Moves the photo with the pointer by (dx, dy) cell px. The stored focus is clamped. */
export function panBy(img: CellImage, dx: number, dy: number, cell: Box, asset: AssetSize): CellImage {
  if (!valid(cell, asset)) return img;
  const p = placeImage(cell, asset, img);
  return {
    ...img,
    focusX: focusForOffset(cell.w, asset.width, p.scale, p.x0 + dx),
    focusY: focusForOffset(cell.h, asset.height, p.scale, p.y0 + dy),
  };
}

/**
 * Zooms by `factor` around `point` (cell px), keeping the photo under the point fixed. Zoom stays in
 * [fit, ZOOM_MAX] and snaps to fill when close (FR-314, FR-316).
 */
export function zoomAt(img: CellImage, factor: number, point: { x: number; y: number }, cell: Box, asset: AssetSize): CellImage {
  if (!valid(cell, asset)) return img;
  const before = placeImage(cell, asset, img);
  const current = effectiveZoom(cell, asset, img.zoom);
  const zoom = clamp(snapZoom(current * factor), zoomMin(cell, asset), ZOOM_MAX);
  const s = coverScale(cell, asset) * zoom;
  // Image point under the pointer before the zoom.
  const ix = (point.x - before.x0) / before.scale;
  const iy = (point.y - before.y0) / before.scale;
  return {
    ...img,
    zoom,
    focusX: focusForOffset(cell.w, asset.width, s, point.x - ix * s),
    focusY: focusForOffset(cell.h, asset.height, s, point.y - iy * s),
  };
}

/** Sets an absolute zoom around the cell center (the Adjust slider and ± buttons). */
export function zoomTo(img: CellImage, zoom: number, cell: Box, asset: AssetSize): CellImage {
  if (!valid(cell, asset)) return img;
  const current = effectiveZoom(cell, asset, img.zoom);
  return zoomAt(img, zoom / current, { x: cell.w / 2, y: cell.h / 2 }, cell, asset);
}
