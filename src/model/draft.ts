// From raw pointer points to a proposed split (research R20, R21). Pure: shared by the Editor and tests.
import { computeRegions, splitAt, splitByPath, type MakeId, type SplitResult } from './layout';
import { pathChords } from './polygon';
import { snap, snapCandidates, strokeToLine, type Area, type SnapCandidate, type StrokeLine } from './snap';
import { EXTEND_PX, extendEnds, isStraightStroke, smoothStroke } from './stroke';
import type { LayoutNode, MinSize, Pt } from './types';

export type Draft =
  | { kind: 'straight'; line: StrokeLine; guide?: SnapCandidate; result: SplitResult }
  | {
      kind: 'path';
      /** The processed stroke in the same px space as the input points (for drawing the preview). */
      pathPx: Pt[];
      guide?: SnapCandidate;
      result: SplitResult;
    };

export interface DraftOptions {
  /** Minimum rectangular cell size (normalized), from minSizeNorm. */
  min: MinSize;
  /** Minimum shaped-cell area (fraction of the content area), from minAreaNorm. */
  minArea: number;
  /** Snap distance in the same px space as the points. */
  snapPx?: number;
  makeId?: MakeId;
}

const toNorm = (area: Area) => (p: Pt): Pt => ({ x: (p.x - area.x) / area.w, y: (p.y - area.y) / area.h });

export function planStroke(tree: LayoutNode, points: Pt[], area: Area, opts: DraftOptions): Draft | null {
  const axis = isStraightStroke(points);
  const line = axis ? strokeToLine(points, area) : null;

  if (axis && line && line.axis === axis) {
    const along = axis === 'horizontal' ? area.h : area.w;
    const across = axis === 'horizontal' ? area.w : area.h;
    const snapped = snap(line.coord, snapCandidates(tree, axis), (opts.snapPx ?? 8) / along);
    // Ends within EXTEND_PX of an edge reach it (FR-011).
    const ext = EXTEND_PX / across;
    const s0 = line.span[0] - ext;
    const s1 = line.span[1] + ext;
    const span: [number, number] = [Math.max(s0, 0), Math.min(s1, 1)];
    const c = snapped.value;
    const pathN: Pt[] = axis === 'horizontal' ? [{ x: s0, y: c }, { x: s1, y: c }] : [{ x: c, y: s0 }, { x: c, y: s1 }];

    const crossesShaped = [...computeRegions(tree).values()].some(
      (r) => !r.rect && pathChords(pathN, r.polygon).length > 0,
    );
    if (!crossesShaped) {
      const straight = { ...line, coord: c, span };
      return { kind: 'straight', line: straight, guide: snapped.guide, result: splitAt(tree, axis, c, span, opts.min, opts.makeId) };
    }
    const pathPx = pathN.map((p) => ({ x: area.x + p.x * area.w, y: area.y + p.y * area.h }));
    return { kind: 'path', pathPx, guide: snapped.guide, result: splitByPath(tree, pathN, opts.minArea, opts.makeId) };
  }

  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (Math.hypot(last.x - first.x, last.y - first.y) < 6 && points.length < 4) return null;

  const pathPx = extendEnds(smoothStroke(points));
  return { kind: 'path', pathPx, result: splitByPath(tree, pathPx.map(toNorm(area)), opts.minArea, opts.makeId) };
}
