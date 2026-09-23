// Pixel geometry derived from the layout: padding, gap, radius, minimum cell size.
import { cellsInReadingOrder, computeRegions, dividers, pathDividers } from './layout';
import { polygonBBox, roundPolygon } from './polygon';
import { REF_SHORT_SIDE, STYLE_RANGES, type CanvasSpec, type Doc, type MinSize, type Pt, type PxCell, type Size, type Style } from './types';

const EPS = 1e-9;

/** Style values are reference px against a 1080 px short side. */
export function styleScale(size: Size): number {
  return Math.min(size.w, size.h) / REF_SHORT_SIDE;
}

/** Content-area size in export px (canvas minus padding on both sides). */
export function contentSize(canvas: CanvasSpec, style: Style): Size {
  const pad = style.padding * styleScale({ w: canvas.width, h: canvas.height });
  return { w: Math.max(canvas.width - 2 * pad, 1), h: Math.max(canvas.height - 2 * pad, 1) };
}

/** max(5% of the canvas side, 40 export px), as a fraction of the content area on each axis. */
export function minSizeNorm(canvas: CanvasSpec, style: Style): MinSize {
  const content = contentSize(canvas, style);
  return {
    x: Math.max(0.05 * canvas.width, 40) / content.w,
    y: Math.max(0.05 * canvas.height, 40) / content.h,
  };
}

/** Minimum shaped-cell area as a fraction of the content area (research R23). */
export function minAreaNorm(canvas: CanvasSpec, style: Style): number {
  const s = Math.max(0.05 * Math.min(canvas.width, canvas.height), 40);
  const content = contentSize(canvas, style);
  return (s * s) / (content.w * content.h);
}

/**
 * The largest gap and padding (whole reference px, within their ranges) that still leave every
 * rectangular cell at least 1 × 1 export px, each given the other's current value.
 */
export function styleLimits(doc: Doc): { maxGap: number; maxPadding: number } {
  const size = { w: doc.canvas.width, h: doc.canvas.height };
  const fits = (style: Style) =>
    layoutPixels({ ...doc, style }, size).every((c) => c.polygon || (c.w >= 1 && c.h >= 1));
  // Fitting only gets harder as the value grows, so check the maximum first (the usual case),
  // then binary-search the largest whole value that still fits.
  const largest = (hi: number, make: (v: number) => Style) => {
    if (fits(make(hi))) return hi;
    let lo = 0;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(make(mid))) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  return {
    maxGap: largest(STYLE_RANGES.gap[1], (gap) => ({ ...doc.style, gap })),
    maxPadding: largest(STYLE_RANGES.padding[1], (padding) => ({ ...doc.style, padding })),
  };
}

/** Every divider (straight and freehand) as a pixel polyline at the given render size (research R22). */
export function dividerLinesPx(doc: Doc, sizePx: Size): { splitId: string; kind: 'straight' | 'path'; points: Pt[] }[] {
  const pad = doc.style.padding * styleScale(sizePx);
  const cw = sizePx.w - 2 * pad;
  const ch = sizePx.h - 2 * pad;
  const toPx = (p: Pt): Pt => ({ x: pad + p.x * cw, y: pad + p.y * ch });
  const straight = dividers(doc.layout).map((d) => ({
    splitId: d.splitId,
    kind: 'straight' as const,
    points:
      d.direction === 'horizontal'
        ? [toPx({ x: d.span[0], y: d.coord }), toPx({ x: d.span[1], y: d.coord })]
        : [toPx({ x: d.coord, y: d.span[0] }), toPx({ x: d.coord, y: d.span[1] })],
  }));
  const freehand = pathDividers(doc.layout).map((d) => ({ splitId: d.splitId, kind: 'path' as const, points: d.points.map(toPx) }));
  return [...straight, ...freehand];
}

/**
 * Cells in pixel space at the given render size, in reading order.
 * Padding insets the content area; only inner edges are inset by gap/2; radius is clamped per cell.
 */
export function layoutPixels(doc: Doc, sizePx: Size): PxCell[] {
  const scale = styleScale(sizePx);
  const pad = doc.style.padding * scale;
  const half = (doc.style.gap * scale) / 2;
  const radius = doc.style.radius * scale;
  const cw = sizePx.w - 2 * pad;
  const ch = sizePx.h - 2 * pad;
  const regions = computeRegions(doc.layout);

  return cellsInReadingOrder(doc.layout).map((cell) => {
    const region = regions.get(cell.id)!;
    if (!region.rect) {
      // Shaped cell: the gap is drawn as strokes along its lines (research R22), so no inset here.
      const px = region.polygon.map((p) => ({ x: pad + p.x * cw, y: pad + p.y * ch }));
      const bb = polygonBBox(px);
      return { cellId: cell.id, x: bb.x, y: bb.y, w: bb.w, h: bb.h, r: radius, polygon: roundPolygon(px, radius) };
    }
    const r = region.bbox;
    let x0 = pad + r.x * cw;
    let x1 = pad + (r.x + r.w) * cw;
    let y0 = pad + r.y * ch;
    let y1 = pad + (r.y + r.h) * ch;
    if (r.x > EPS) x0 += half;
    if (r.x + r.w < 1 - EPS) x1 -= half;
    if (r.y > EPS) y0 += half;
    if (r.y + r.h < 1 - EPS) y1 -= half;
    const w = Math.max(x1 - x0, 0);
    const h = Math.max(y1 - y0, 0);
    return { cellId: cell.id, x: x0, y: y0, w, h, r: Math.max(0, Math.min(radius, w / 2, h / 2)) };
  });
}
