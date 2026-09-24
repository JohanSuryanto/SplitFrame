// The SplitFrame credit drawn on Preview and exported images. Pure: geometry comes from the export
// canvas and is scaled to the surface being drawn (FR-201 to FR-208; research W2).
import type { Size } from '../model/types';
import { isStoryShape } from './share';

export const WATERMARK_TEXT = 'SplitFrame · splitframe.johansuryanto.dev';

/** Text height as a share of the export short side (FR-206). */
const SIZE = 0.025;
/** Below this many export px the credit is unreadable, so it is left out (FR-208). */
const MIN_PX = 10;
/** Never wider than this share of the canvas width (FR-207). */
const MAX_WIDTH = 0.9;
/** On 9:16, a little more room than other shapes for the Instagram/WhatsApp reply controls (FR-203). */
const STORY_MARGIN = 0.05;
/** Other shapes: margin as a share of the short side (FR-204). */
const MARGIN = 0.03;
/** Room below the baseline for descenders, as a share of the font size. */
const DESCENT = 0.25;
/** Tolerance so the 400 px boundary doesn't depend on floating-point rounding. */
const EPS = 1e-9;

export interface WatermarkOp {
  text: string;
  x: number;
  /** Alphabetic baseline. */
  y: number;
  fontPx: number;
  font: string;
  color: string;
  shadow: { color: string; blur: number; offsetY: number };
}

/** The app's own system font stack (research W4), so nothing is downloaded. */
export function watermarkFont(px: number): string {
  return `600 ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
}

/** Whether the credit is drawn at this canvas size (for the Export panel note). */
export function watermarkFits(canvas: { width: number; height: number }): boolean {
  return SIZE * Math.min(canvas.width, canvas.height) >= MIN_PX - EPS;
}

export function planWatermark(
  canvas: { width: number; height: number },
  sizePx: Size,
  measure: (text: string, fontPx: number) => number,
): WatermarkOp | null {
  const { width: W, height: H } = canvas;
  const S = Math.min(W, H);
  const k = sizePx.w / W;

  const f0 = SIZE * S;
  const w0 = measure(WATERMARK_TEXT, f0);
  const f = w0 > MAX_WIDTH * W ? (f0 * MAX_WIDTH * W) / w0 : f0;
  if (f < MIN_PX - EPS) return null;

  const margin = isStoryShape(canvas) ? STORY_MARGIN * H : MARGIN * S;
  const baseline = H - margin - DESCENT * f;
  const fontPx = f * k;
  return {
    text: WATERMARK_TEXT,
    x: sizePx.w / 2,
    y: baseline * k,
    fontPx,
    font: watermarkFont(fontPx),
    color: 'rgb(255 255 255 / 0.92)',
    shadow: { color: 'rgb(0 0 0 / 0.55)', blur: 0.35 * fontPx, offsetY: 0.06 * fontPx },
  };
}
