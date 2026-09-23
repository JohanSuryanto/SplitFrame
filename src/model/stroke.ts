// Turning raw pointer strokes into lines (research R20, R21). Works in screen pixels.
import { segmentIntersection } from './polygon';
import type { Direction, Pt } from './types';

const STRAIGHT_DEG = 5;
const RESAMPLE_PX = 3;
const SMOOTH_RADIUS = 2; // moving average over 2·2 + 1 = 5 points
const RDP_EPS = 0.6;
const END_DIR_PX = 12;
export const EXTEND_PX = 16;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function distToLine(p: Pt, a: Pt, b: Pt): number {
  const len = dist(a, b);
  if (len === 0) return dist(p, a);
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
}

/**
 * The axis, when the stroke is within 5° of horizontal or vertical and every point stays within
 * max(4 px, 3% of its length) of the line between its ends. Otherwise null (freehand).
 */
export function isStraightStroke(points: Pt[]): Direction | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const len = dist(first, last);
  if (len < 6) return null;
  const angle = (Math.atan2(Math.abs(last.y - first.y), Math.abs(last.x - first.x)) * 180) / Math.PI;
  const axis: Direction | null = angle <= STRAIGHT_DEG ? 'horizontal' : angle >= 90 - STRAIGHT_DEG ? 'vertical' : null;
  if (!axis) return null;
  const tolerance = Math.max(4, 0.03 * len);
  return points.every((p) => distToLine(p, first, last) <= tolerance) ? axis : null;
}

function resample(points: Pt[], spacing: number): Pt[] {
  const first = points[0];
  if (!first) return [];
  const out: Pt[] = [first];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = dist(a, b);
    let t = spacing - carry;
    while (t <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * t) / seg, y: a.y + ((b.y - a.y) * t) / seg });
      t += spacing;
    }
    carry = seg - (t - spacing);
  }
  const last = points[points.length - 1]!;
  if (dist(out[out.length - 1]!, last) > 1e-9) out.push(last);
  return out;
}

function movingAverage(points: Pt[]): Pt[] {
  return points.map((p, i) => {
    const r = Math.min(SMOOTH_RADIUS, i, points.length - 1 - i);
    if (r === 0) return p;
    let x = 0;
    let y = 0;
    for (let k = i - r; k <= i + r; k++) {
      x += points[k]!.x;
      y += points[k]!.y;
    }
    return { x: x / (2 * r + 1), y: y / (2 * r + 1) };
  });
}

function rdp(points: Pt[], eps: number): Pt[] {
  if (points.length < 3) return points;
  const a = points[0]!;
  const b = points[points.length - 1]!;
  let maxD = -1;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToLine(points[i]!, a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  const left = rdp(points.slice(0, idx + 1), eps);
  const right = rdp(points.slice(idx), eps);
  return [...left.slice(0, -1), ...right];
}

/** Removes hand jitter but keeps the drawn shape: resample, moving average, simplify. Endpoints stay put. */
export function smoothStroke(points: Pt[]): Pt[] {
  if (points.length < 3) return points;
  return rdp(movingAverage(resample(points, RESAMPLE_PX)), RDP_EPS);
}

/** Direction at one end, averaged over roughly the last 12 px. */
function endDirection(points: Pt[], fromEnd: boolean): Pt {
  const seq = fromEnd ? [...points].reverse() : points;
  const tip = seq[0]!;
  let ref = seq[1] ?? tip;
  for (let i = 1; i < seq.length; i++) {
    ref = seq[i]!;
    if (dist(tip, ref) >= END_DIR_PX) break;
  }
  const d = dist(tip, ref);
  return d === 0 ? { x: 0, y: 0 } : { x: (tip.x - ref.x) / d, y: (tip.y - ref.y) / d };
}

/** Lengthens both ends along their direction, so strokes that stop just short still reach an edge. */
export function extendEnds(points: Pt[], px: number = EXTEND_PX): Pt[] {
  if (points.length < 2) return points;
  const s = endDirection(points, false);
  const e = endDirection(points, true);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return [{ x: first.x + s.x * px, y: first.y + s.y * px }, ...points, { x: last.x + e.x * px, y: last.y + e.y * px }];
}

/** True when any two non-adjacent segments touch or cross. */
export function selfIntersects(points: Pt[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      if (segmentIntersection(points[i]!, points[i + 1]!, points[j]!, points[j + 1]!)) return true;
    }
  }
  return false;
}
