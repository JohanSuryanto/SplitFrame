// Turning a rough stroke into a straight line, and snapping it to useful positions.
import { dividers } from './layout';
import type { Direction, LayoutNode } from './types';

export interface SnapCandidate {
  kind: 'center' | 'third' | 'edge';
  value: number;
}

const PRIORITY: Record<SnapCandidate['kind'], number> = { center: 0, third: 1, edge: 2 };

/** Center, thirds and every existing parallel divider, in normalized content-area units. */
export function snapCandidates(tree: LayoutNode, axis: Direction, excludeSplitId?: string): SnapCandidate[] {
  const out: SnapCandidate[] = [
    { kind: 'center', value: 0.5 },
    { kind: 'third', value: 1 / 3 },
    { kind: 'third', value: 2 / 3 },
  ];
  for (const d of dividers(tree)) {
    if (d.direction === axis && d.splitId !== excludeSplitId) out.push({ kind: 'edge', value: d.coord });
  }
  return out;
}

/** Nearest candidate within the threshold. On equal distance, center beats third beats edge. */
export function snap(raw: number, candidates: SnapCandidate[], thresholdNorm: number): { value: number; guide?: SnapCandidate } {
  let best: SnapCandidate | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c.value - raw);
    if (d > thresholdNorm) continue;
    const better = d < bestDist - 1e-12 || (Math.abs(d - bestDist) <= 1e-12 && best && PRIORITY[c.kind] < PRIORITY[best.kind]);
    if (!best || better) {
      best = c;
      bestDist = d;
    }
  }
  return best ? { value: best.value, guide: best } : { value: raw };
}

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StrokeLine {
  axis: Direction;
  /** Position on the split axis, normalized over the content area. */
  coord: number;
  /** Extent along the line, normalized and clamped to [0, 1]. */
  span: [number, number];
}

export const MIN_STROKE_PX = 6;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/**
 * Straightens a stroke: the main drag direction picks the axis, the average of the points
 * gives the position. `area` is the content area in the same pixel space as the points.
 */
export function strokeToLine(points: { x: number; y: number }[], area: Area): StrokeLine | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  if (Math.hypot(dx, dy) < MIN_STROKE_PX) return null;

  const mean = (pick: (p: { x: number; y: number }) => number) => points.reduce((s, p) => s + pick(p), 0) / points.length;
  if (Math.abs(dx) > Math.abs(dy)) {
    const a = clamp01((first.x - area.x) / area.w);
    const b = clamp01((last.x - area.x) / area.w);
    return { axis: 'horizontal', coord: (mean((p) => p.y) - area.y) / area.h, span: [Math.min(a, b), Math.max(a, b)] };
  }
  const a = clamp01((first.y - area.y) / area.h);
  const b = clamp01((last.y - area.y) / area.h);
  return { axis: 'vertical', coord: (mean((p) => p.x) - area.x) / area.w, span: [Math.min(a, b), Math.max(a, b)] };
}
