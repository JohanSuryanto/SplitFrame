// The user's own watermark (feature 005). Pure: geometry comes from the export canvas and is scaled to
// the surface being drawn, so the editor, Preview and export all draw the same thing (research C3, C4).
import type { Pt, Size, Watermark } from '../model/types';
import { watermarkFont } from './watermark';

export interface TextMarkOp {
  text: string;
  font: string;
  fontPx: number;
  color: string;
  alpha: number;
  /** Radians. */
  angle: number;
  /** Text centers in surface px: one for a single mark, a lattice for Repeat. */
  points: Pt[];
}

export function planTextMark(
  mark: Watermark,
  canvas: { width: number; height: number },
  sizePx: Size,
  measure: (text: string, fontPx: number) => number,
): TextMarkOp | null {
  if (mark.text.trim() === '') return null;
  const { w, h } = sizePx;
  const fontPx = mark.size * Math.min(canvas.width, canvas.height) * (w / canvas.width);
  const angle = (mark.rotation * Math.PI) / 180;
  const op = { text: mark.text, font: watermarkFont(fontPx), fontPx, color: mark.color, alpha: mark.opacity, angle };
  if (!mark.repeat) return { ...op, points: [{ x: mark.x * w, y: mark.y * h }] };

  // Lattice in the text's own (rotated) frame: rows one text height apart, copies two heights apart,
  // every other row staggered by half a step so the pattern doesn't line up into columns.
  const tw = measure(mark.text, fontPx);
  const dx = tw + 2 * fontPx;
  const dy = 2 * fontPx;
  const ox = w / 2 + (mark.x - 0.5) * w;
  const oy = h / 2 + (mark.y - 0.5) * h;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Far enough to reach every corner from the (possibly shifted) pattern origin.
  const reach = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) + dx;
  // A copy is kept when its center is within its own half-extent of the surface.
  const pad = tw / 2 + fontPx;
  const nu = Math.ceil(reach / dx);
  const nv = Math.ceil(reach / dy);
  const points: Pt[] = [];
  for (let j = -nv; j <= nv; j++) {
    const stagger = (j & 1) * dx * 0.5;
    for (let i = -nu; i <= nu; i++) {
      const u = i * dx + stagger;
      const v = j * dy;
      const x = ox + u * cos - v * sin;
      const y = oy + u * sin + v * cos;
      if (x >= -pad && x <= w + pad && y >= -pad && y <= h + pad) points.push({ x, y });
    }
  }
  return { ...op, points };
}
