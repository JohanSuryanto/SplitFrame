// Makes the paper of a signature photo transparent and finds the ink (feature 006, research S5). Pure:
// works on raw RGBA, so it runs in tests without a canvas. Colors are untouched; only alpha changes.

export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Width of the soft edge, in luminance steps, so the ink keeps smooth edges. */
const SOFT = 24;
/** How far one step of sensitivity moves the cutoff. */
const PER_STEP = 1.2;

/** Otsu's threshold: the luminance that best splits the histogram into two classes (ink and paper). */
function otsu(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let first = 128;
  let last = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      first = last = t;
    } else if (between === best) {
      last = t;
    }
  }
  // Empty bins between ink and paper tie; the middle of the tie sits between them, not on the ink.
  return (first + last) / 2;
}

/**
 * sensitivity 0–100 (50 = automatic): higher keeps more as ink. Returns a copy with the new alpha and
 * the ink's bounding box plus a 3% margin, or null when (almost) nothing is ink.
 */
export function removeBackground(img: Rgba, sensitivity: number): { data: Uint8ClampedArray; box: Box | null } {
  const { data, width, height } = img;
  const n = width * height;
  const lum = new Float32Array(n);
  const hist = new Uint32Array(256);
  let counted = 0;
  for (let i = 0; i < n; i++) {
    const L = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    lum[i] = L;
    if (data[i * 4 + 3]! > 0) {
      hist[Math.round(L)]! += 1;
      counted++;
    }
  }
  const cutoff = Math.min(Math.max(otsu(hist, counted), 60), 220) + (sensitivity - 50) * PER_STEP;

  const out = new Uint8ClampedArray(data);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let inked = 0;
  for (let i = 0; i < n; i++) {
    const keep = Math.min(Math.max((cutoff - lum[i]!) / SOFT + 0.5, 0), 1);
    const a = Math.round(data[i * 4 + 3]! * keep);
    out[i * 4 + 3] = a;
    if (a >= 128) {
      inked++;
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (inked < Math.max(1, 0.0005 * n)) return { data: out, box: null };

  const m = Math.ceil(0.03 * Math.max(maxX - minX + 1, maxY - minY + 1));
  const x0 = Math.max(0, minX - m);
  const y0 = Math.max(0, minY - m);
  const x1 = Math.min(width, maxX + 1 + m);
  const y1 = Math.min(height, maxY + 1 + m);
  return { data: out, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
