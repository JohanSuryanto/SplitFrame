// The 7-stroke sketch from the 2026-09-24 clarification (spec SC-011), traced from the user's image.
// Pixel coordinates in the sketch; the black canvas is the rectangle below. Strokes overshoot on purpose.
import type { Pt } from '../types';

export const SKETCH_AREA = { x: 34, y: 16, w: 540, h: 392 };

/** Densifies a traced polyline so it looks like pointer input (a point every ~4 px). */
function trace(...pts: [number, number][]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let k = 0; k < n; k++) out.push({ x: x0 + ((x1 - x0) * k) / n, y: y0 + ((y1 - y0) * k) / n });
  }
  const [lx, ly] = pts[pts.length - 1]!;
  out.push({ x: lx, y: ly });
  return out;
}

/** In drawing order: the vertical first, so it becomes a straight split of the whole canvas. */
export const SKETCH_STROKES: { name: string; points: Pt[] }[] = [
  { name: 'long vertical', points: trace([245, 5], [247, 100], [249, 250], [252, 430]) },
  { name: 'horizontal (starts left of the vertical)', points: trace([210, 125], [300, 135], [430, 158], [590, 165], [600, 161]) },
  { name: 'top-left corner cut', points: trace([130, 3], [105, 40], [70, 90], [40, 125], [3, 160]) },
  { name: 'top-right corner cut', points: trace([390, 8], [460, 55], [530, 105], [575, 125], [595, 137]) },
  { name: 'left L', points: trace([34, 203], [80, 197], [178, 197], [182, 215], [183, 300], [184, 435]) },
  { name: 'right L', points: trace([598, 228], [565, 247], [450, 246], [338, 234], [336, 260], [347, 360], [342, 455]) },
  { name: 'bottom-right corner cut', points: trace([583, 252], [510, 325], [460, 375], [440, 405], [400, 450]) },
];
