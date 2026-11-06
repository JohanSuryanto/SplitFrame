// Signature geometry (feature 006). Pure: pad strokes → a normalized picture, and placement scaled to
// the surface being drawn, so the editor, Preview and export match (research S3, S4).
import type { Pt, Signature, SignaturePicture, Size } from './types';

type StrokesPicture = Extract<SignaturePicture, { kind: 'strokes' }>;

/**
 * Crops pad strokes (any px units) to their bounding box, padded by half the pen plus 4% of the larger
 * side so round caps aren't clipped, and maps every point to 0–1 inside it.
 */
export function normalizeStrokes(strokes: Pt[][], penPx: number): StrokesPicture {
  const pts = strokes.flat();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = penPx / 2 + 0.04 * Math.max(maxX - minX, maxY - minY);
  const x0 = minX - pad;
  const y0 = minY - pad;
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;
  return {
    kind: 'strokes',
    strokes: strokes.map((s) => s.map((p) => ({ x: (p.x - x0) / w, y: (p.y - y0) / h }))),
    aspect: w / h,
    lineWidth: penPx / w,
  };
}

/** Center, box size and angle of the signature on a surface of sizePx showing this export canvas. */
export function planSignature(
  sig: Signature,
  canvas: { width: number; height: number },
  sizePx: Size,
): { cx: number; cy: number; w: number; h: number; angle: number } {
  const w = sig.size * Math.min(canvas.width, canvas.height) * (sizePx.w / canvas.width);
  return {
    cx: sig.x * sizePx.w,
    cy: sig.y * sizePx.h,
    w,
    h: w / sig.picture.aspect,
    angle: (sig.rotation * Math.PI) / 180,
  };
}
