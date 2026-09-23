// Pure polygon geometry for shaped cells (research R20, R22). No DOM, never mutates inputs.
import type { NRect, Pt } from './types';

const EPS = 1e-9;

export function signedArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function polygonArea(poly: Pt[]): number {
  return Math.abs(signedArea(poly));
}

/** Area centroid; falls back to the vertex average for degenerate polygons. */
export function polygonCentroid(poly: Pt[]): Pt {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-12) {
    const n = Math.max(poly.length, 1);
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function polygonBBox(poly: Pt[]): NRect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Even-odd rule. Points exactly on the boundary may go either way. */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface SegmentHit {
  p: Pt;
  /** Position along a→b, 0–1. */
  t: number;
  /** Position along c→d, 0–1. */
  u: number;
}

/** Intersection of segments a→b and c→d, including touching endpoints. Parallel segments give null. */
export function segmentIntersection(a: Pt, b: Pt, c: Pt, d: Pt): SegmentHit | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-15) return null;
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { p: { x: a.x + rx * t, y: a.y + ry * t }, t, u };
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Point on a polyline at a parameter k + f (segment k, fraction f). */
function pointAt(path: Pt[], param: number): Pt {
  const k = Math.min(Math.floor(param), path.length - 2);
  const f = param - k;
  const a = path[k]!;
  const b = path[k + 1]!;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** The sub-path between two parameters, with interpolated end points. */
function subPath(path: Pt[], from: number, to: number): Pt[] {
  const out: Pt[] = [pointAt(path, from)];
  for (let k = Math.floor(from) + 1; k <= Math.floor(to) && k < path.length; k++) {
    if (k > from + EPS && k < to - EPS) out.push(path[k]!);
  }
  out.push(pointAt(path, to));
  return out;
}

/**
 * Pieces of `path` that cross `poly` from boundary to boundary: the sub-paths between consecutive
 * boundary crossings whose midpoint is inside. Overshoot and dangling ends are dropped.
 */
export function pathChords(path: Pt[], poly: Pt[]): Pt[][] {
  const hits: { param: number; p: Pt }[] = [];
  for (let k = 0; k < path.length - 1; k++) {
    for (let i = 0; i < poly.length; i++) {
      const h = segmentIntersection(path[k]!, path[k + 1]!, poly[i]!, poly[(i + 1) % poly.length]!);
      if (h) hits.push({ param: k + Math.min(Math.max(h.t, 0), 1), p: h.p });
    }
  }
  hits.sort((a, b) => a.param - b.param);
  // Passing through a vertex hits two edges at the same point: keep one.
  const unique = hits.filter((h, i) => i === 0 || dist(h.p, hits[i - 1]!.p) > 1e-9);

  const chords: Pt[][] = [];
  for (let i = 0; i < unique.length - 1; i++) {
    const from = unique[i]!.param;
    const to = unique[i + 1]!.param;
    if (to - from < EPS) continue;
    if (!pointInPolygon(pointAt(path, (from + to) / 2), poly)) continue;
    chords.push(subPath(path, from, to));
  }
  return chords;
}

/** Where a boundary point lies: edge index + fraction along it. */
function boundaryPos(poly: Pt[], p: Pt): number {
  let best = Infinity;
  let pos = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len2 = ex * ex + ey * ey;
    const f = len2 > 0 ? Math.min(Math.max(((p.x - a.x) * ex + (p.y - a.y) * ey) / len2, 0), 1) : 0;
    const d = Math.hypot(a.x + ex * f - p.x, a.y + ey * f - p.y);
    if (d < best - 1e-12) {
      best = d;
      pos = i + f;
    }
  }
  return pos;
}

/** Polygon vertices strictly between two boundary positions, walking forward. */
function verticesBetween(poly: Pt[], from: number, to: number): Pt[] {
  const n = poly.length;
  const span = (((to - from) % n) + n) % n;
  const out: Pt[] = [];
  for (let k = 1; k <= n; k++) {
    const j = Math.floor(from) + k;
    const ahead = (((j - from) % n) + n) % n;
    if (ahead > EPS && ahead < span - EPS) out.push(poly[j % n]!);
  }
  return out;
}

function dedupe(poly: Pt[]): Pt[] {
  const out = poly.filter((p, i) => i === 0 || dist(p, poly[i - 1]!) > 1e-9);
  while (out.length > 1 && dist(out[0]!, out[out.length - 1]!) <= 1e-9) out.pop();
  return out;
}

/**
 * Splits a simple polygon along a chord whose ends lie on its boundary.
 * Piece 1 = chord + boundary walked forward from the chord's end to its start;
 * piece 2 = reversed chord + boundary walked forward from its start to its end.
 */
export function splitPolygonByChord(poly: Pt[], chord: Pt[]): [Pt[], Pt[]] {
  const c0 = chord[0]!;
  const ck = chord[chord.length - 1]!;
  const pos0 = boundaryPos(poly, c0);
  const posK = boundaryPos(poly, ck);
  const piece1 = dedupe([...chord, ...verticesBetween(poly, posK, pos0)]);
  const piece2 = dedupe([...[...chord].reverse(), ...verticesBetween(poly, pos0, posK)]);
  return [piece1, piece2];
}

const TURN_MIN = (30 * Math.PI) / 180;
const ARC_STEPS = 6;

/** Rounds vertices that turn more than 30°, each arc clamped to half the shorter neighbouring edge. */
export function roundPolygon(poly: Pt[], r: number): Pt[] {
  if (r <= 0 || poly.length < 3) return poly;
  const out: Pt[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const v = poly[i]!;
    const prev = poly[(i - 1 + n) % n]!;
    const next = poly[(i + 1) % n]!;
    const l1 = dist(prev, v);
    const l2 = dist(next, v);
    if (l1 < EPS || l2 < EPS) {
      out.push(v);
      continue;
    }
    const u1 = { x: (prev.x - v.x) / l1, y: (prev.y - v.y) / l1 };
    const u2 = { x: (next.x - v.x) / l2, y: (next.y - v.y) / l2 };
    const inner = Math.acos(Math.min(Math.max(u1.x * u2.x + u1.y * u2.y, -1), 1));
    if (Math.PI - inner < TURN_MIN || inner < EPS) {
      out.push(v);
      continue;
    }
    const d = Math.min(r / Math.tan(inner / 2), l1 / 2, l2 / 2);
    const start = { x: v.x + u1.x * d, y: v.y + u1.y * d };
    const end = { x: v.x + u2.x * d, y: v.y + u2.y * d };
    // Quadratic curve with the corner as control point: close to a circular arc, always inside the corner.
    for (let s = 0; s <= ARC_STEPS; s++) {
      const t = s / ARC_STEPS;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      out.push({ x: a * start.x + b * v.x + c * end.x, y: a * start.y + b * v.y + c * end.y });
    }
  }
  return out;
}

/** Point halfway along a polyline by length. */
export function pathMidpoint(path: Pt[]): Pt {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += dist(path[i]!, path[i + 1]!);
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = dist(path[i]!, path[i + 1]!);
    if (acc + seg >= total / 2 && seg > 0) {
      const f = (total / 2 - acc) / seg;
      return { x: path[i]!.x + (path[i + 1]!.x - path[i]!.x) * f, y: path[i]!.y + (path[i + 1]!.y - path[i]!.y) * f };
    }
    acc += seg;
  }
  return path[0]!;
}
