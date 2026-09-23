// Split-tree layout model. Pure functions only: no DOM, never mutates inputs.
// See specs/001-splitframe-collage-editor/contracts/layout-model.md.
import { pathChords, pathMidpoint, pointInPolygon, polygonArea, polygonBBox, splitPolygonByChord } from './polygon';
import { selfIntersects } from './stroke';
import {
  newId,
  type CellImage,
  type CellNode,
  type Direction,
  type Divider,
  type LayoutNode,
  type MinSize,
  type NRect,
  type PathSplitNode,
  type Pt,
  type Region,
} from './types';

const UNIT: NRect = { x: 0, y: 0, w: 1, h: 1 };

export function rectPolygon(r: NRect): Pt[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

const ROOT: Region = { polygon: rectPolygon(UNIT), bbox: UNIT, rect: true };

export function singleCell(image?: CellImage): CellNode {
  return image ? { type: 'cell', id: newId(), image } : { type: 'cell', id: newId() };
}

/** Rectangles of the two children of a split, in the parent's coordinate space. */
export function childRects(node: { direction: 'horizontal' | 'vertical'; ratio: number }, r: NRect): [NRect, NRect] {
  if (node.direction === 'horizontal') {
    const ha = r.h * node.ratio;
    return [
      { x: r.x, y: r.y, w: r.w, h: ha },
      { x: r.x, y: r.y + ha, w: r.w, h: r.h - ha },
    ];
  }
  const wa = r.w * node.ratio;
  return [
    { x: r.x, y: r.y, w: wa, h: r.h },
    { x: r.x + wa, y: r.y, w: r.w - wa, h: r.h },
  ];
}

const fromBox = (bb: NRect) => (p: Pt): Pt => ({ x: bb.x + p.x * bb.w, y: bb.y + p.y * bb.h });
const toBox = (bb: NRect) => (p: Pt): Pt => ({
  x: bb.w > 0 ? (p.x - bb.x) / bb.w : 0,
  y: bb.h > 0 ? (p.y - bb.y) / bb.h : 0,
});

/** A path split's line in content-area coordinates, given its parent region. */
export function pathInContent(node: PathSplitNode, parent: Region): Pt[] {
  return node.path.map(fromBox(parent.bbox));
}

function regionOf(polygon: Pt[]): Region {
  return { polygon, bbox: polygonBBox(polygon), rect: false };
}

/** Regions of the two children of a split node. */
export function childRegions(node: Exclude<LayoutNode, CellNode>, parent: Region): [Region, Region] {
  if (node.type === 'split') {
    const [ra, rb] = childRects(node, parent.bbox);
    return [
      { polygon: rectPolygon(ra), bbox: ra, rect: parent.rect },
      { polygon: rectPolygon(rb), bbox: rb, rect: parent.rect },
    ];
  }
  const [p1, p2] = splitPolygonByChord(parent.polygon, pathInContent(node, parent));
  return node.aFirst ? [regionOf(p1), regionOf(p2)] : [regionOf(p2), regionOf(p1)];
}

/** Calls visit(node, region) for every node, depth-first, a before b. */
export function walk(tree: LayoutNode, visit: (node: LayoutNode, region: Region) => void, region: Region = ROOT): void {
  visit(tree, region);
  if (tree.type !== 'cell') {
    const [ra, rb] = childRegions(tree, region);
    walk(tree.a, visit, ra);
    walk(tree.b, visit, rb);
  }
}

/** Shapes of all leaf cells, keyed by cell id, in reading order. */
export function computeRegions(tree: LayoutNode): Map<string, Region> {
  const out = new Map<string, Region>();
  walk(tree, (node, region) => {
    if (node.type === 'cell') out.set(node.id, region);
  });
  return out;
}

/** Bounding boxes of all leaf cells (exactly the cell for rectangular cells), in reading order. */
export function computeRects(tree: LayoutNode): Map<string, NRect> {
  const rects = new Map<string, NRect>();
  for (const [id, r] of computeRegions(tree)) rects.set(id, r.bbox);
  return rects;
}

/** One entry per straight split, in global normalized coordinates. */
export function dividers(tree: LayoutNode): Divider[] {
  const out: Divider[] = [];
  walk(tree, (node, region) => {
    if (node.type !== 'split') return;
    const r = region.bbox;
    if (node.direction === 'horizontal') {
      out.push({ splitId: node.id, direction: node.direction, coord: r.y + r.h * node.ratio, span: [r.x, r.x + r.w] });
    } else {
      out.push({ splitId: node.id, direction: node.direction, coord: r.x + r.w * node.ratio, span: [r.y, r.y + r.h] });
    }
  });
  return out;
}

/** One entry per path split: its line in content-area coordinates. */
export function pathDividers(tree: LayoutNode): { splitId: string; points: Pt[] }[] {
  const out: { splitId: string; points: Pt[] }[] = [];
  walk(tree, (node, region) => {
    if (node.type === 'path') out.push({ splitId: node.id, points: pathInContent(node, region) });
  });
  return out;
}

export function cellsInReadingOrder(tree: LayoutNode): CellNode[] {
  const out: CellNode[] = [];
  walk(tree, (node) => {
    if (node.type === 'cell') out.push(node);
  });
  return out;
}

export function findNode(tree: LayoutNode, id: string): LayoutNode | undefined {
  if (tree.id === id) return tree;
  if (tree.type !== 'cell') return findNode(tree.a, id) ?? findNode(tree.b, id);
  return undefined;
}

/** Returns a new tree with the node `id` replaced. Unchanged branches keep their identity. */
export function replaceNode(tree: LayoutNode, id: string, replacement: LayoutNode): LayoutNode {
  if (tree.id === id) return replacement;
  if (tree.type === 'cell') return tree;
  const a = replaceNode(tree.a, id, replacement);
  const b = replaceNode(tree.b, id, replacement);
  return a === tree.a && b === tree.b ? tree : { ...tree, a, b };
}

/** Maps every cell through fn. Unchanged branches keep their identity. */
export function mapCells(tree: LayoutNode, fn: (cell: CellNode) => CellNode): LayoutNode {
  if (tree.type === 'cell') return fn(tree);
  const a = mapCells(tree.a, fn);
  const b = mapCells(tree.b, fn);
  return a === tree.a && b === tree.b ? tree : { ...tree, a, b };
}

function withImage(cell: CellNode, image: CellImage | undefined): CellNode {
  if (image) return { ...cell, image };
  return { type: 'cell', id: cell.id };
}

export function defaultFraming(assetId: string): CellImage {
  return { assetId, zoom: 1, focusX: 0.5, focusY: 0.5 };
}

export function setCellImage(tree: LayoutNode, cellId: string, image: CellImage | undefined): LayoutNode {
  return mapCells(tree, (c) => (c.id === cellId ? withImage(c, image) : c));
}

/** Swaps the photos of two cells. Both photos get the default framing. */
export function swapCellImages(tree: LayoutNode, idA: string, idB: string): LayoutNode {
  const cells = cellsInReadingOrder(tree);
  const a = cells.find((c) => c.id === idA);
  const b = cells.find((c) => c.id === idB);
  if (!a || !b || idA === idB) return tree;
  const imgA = a.image && defaultFraming(a.image.assetId);
  const imgB = b.image && defaultFraming(b.image.assetId);
  return mapCells(tree, (c) => {
    if (c.id === idA) return withImage(c, imgB);
    if (c.id === idB) return withImage(c, imgA);
    return c;
  });
}

export function setFraming(
  tree: LayoutNode,
  cellId: string,
  patch: Partial<Pick<CellImage, 'zoom' | 'focusX' | 'focusY'>>,
): LayoutNode {
  return mapCells(tree, (c) => (c.id === cellId && c.image ? { ...c, image: { ...c.image, ...patch } } : c));
}

export function referencedAssets(tree: LayoutNode): Set<string> {
  const out = new Set<string>();
  for (const c of cellsInReadingOrder(tree)) if (c.image) out.add(c.image.assetId);
  return out;
}

/** 'split' / 'b' for the first split of a cell; 'split:n' / 'b:n' for extra chords of a freehand line. */
export type SplitIdRole = string;
export type MakeId = (targetCellId: string, role: SplitIdRole) => string;
export type SplitError = 'too-small' | 'no-target' | 'self-crossing';
export type SplitResult = { tree: LayoutNode } | { error: SplitError };

const EPS = 1e-9;

/**
 * Splits every leaf whose rectangle crosses `span` and strictly contains `coord` on the split axis.
 * All targets are checked against `min` first: if any would be too small, nothing changes.
 * Child `a` keeps the target cell (id and photo); `makeId` supplies the new split and `b` ids.
 */
export function splitAt(
  tree: LayoutNode,
  axis: Direction,
  coord: number,
  span: [number, number],
  min: MinSize,
  makeId: MakeId = () => newId(),
): SplitResult {
  const [s0, s1] = span[0] <= span[1] ? span : [span[1], span[0]];
  const minAlong = axis === 'horizontal' ? min.y : min.x;
  const targets = new Map<string, number>(); // cell id → local ratio

  for (const [id, region] of computeRegions(tree)) {
    if (!region.rect) continue;
    const r = region.bbox;
    const [start, size, o0, o1] = axis === 'horizontal' ? [r.y, r.h, r.x, r.x + r.w] : [r.x, r.w, r.y, r.y + r.h];
    const crossesSpan = o0 < s1 - EPS && o1 > s0 + EPS;
    const contains = coord > start + EPS && coord < start + size - EPS;
    if (!crossesSpan || !contains) continue;
    if (coord - start < minAlong - EPS || start + size - coord < minAlong - EPS) return { error: 'too-small' };
    targets.set(id, (coord - start) / size);
  }
  if (targets.size === 0) return { error: 'no-target' };

  const split = (node: LayoutNode): LayoutNode => {
    if (node.type !== 'cell') {
      const a = split(node.a);
      const b = split(node.b);
      return a === node.a && b === node.b ? node : { ...node, a, b };
    }
    const ratio = targets.get(node.id);
    if (ratio === undefined) return node;
    return {
      type: 'split',
      id: makeId(node.id, 'split'),
      direction: axis,
      ratio,
      a: node,
      b: { type: 'cell', id: makeId(node.id, 'b') },
    };
  };
  return { tree: split(tree) };
}

class TooSmall extends Error {}

/**
 * Splits every cell that `path` (content-area coordinates) crosses from edge to edge, once per
 * chord. Overshoot is ignored. All-or-nothing on `minArea` (fraction of the content area).
 * The larger piece becomes `a` and keeps the target cell's id and photo (FR-046).
 */
export function splitByPath(
  tree: LayoutNode,
  path: Pt[],
  minArea: number,
  makeId: MakeId = () => newId(),
): SplitResult {
  if (path.length < 2) return { error: 'no-target' };
  if (selfIntersects(path)) return { error: 'self-crossing' };

  const cut = (node: LayoutNode, region: Region, chord: Pt[], leafId: string, k: number): LayoutNode => {
    if (node.type === 'cell') {
      const [p1, p2] = splitPolygonByChord(region.polygon, chord);
      const a1 = polygonArea(p1);
      const a2 = polygonArea(p2);
      if (a1 < minArea - 1e-12 || a2 < minArea - 1e-12) throw new TooSmall();
      const suffix = k === 0 ? '' : `:${k}`;
      return {
        type: 'path',
        id: makeId(leafId, `split${suffix}`),
        path: chord.map(toBox(region.bbox)),
        aFirst: a1 >= a2,
        a: node,
        b: { type: 'cell', id: makeId(leafId, `b${suffix}`) },
      };
    }
    // An earlier chord of this stroke already split the cell: recurse into the piece holding this chord.
    const [ra, rb] = childRegions(node, region);
    return pointInPolygon(pathMidpoint(chord), ra.polygon)
      ? { ...node, a: cut(node.a, ra, chord, leafId, k) }
      : { ...node, b: cut(node.b, rb, chord, leafId, k) };
  };

  const replacements = new Map<string, LayoutNode>();
  try {
    for (const [id, region] of computeRegions(tree)) {
      const chords = pathChords(path, region.polygon);
      if (chords.length === 0) continue;
      let node: LayoutNode = findNode(tree, id)!;
      chords.forEach((chord, k) => {
        node = cut(node, region, chord, id, k);
      });
      replacements.set(id, node);
    }
  } catch (e) {
    if (e instanceof TooSmall) return { error: 'too-small' };
    throw e;
  }
  if (replacements.size === 0) return { error: 'no-target' };

  const rebuild = (node: LayoutNode): LayoutNode => {
    if (node.type === 'cell') return replacements.get(node.id) ?? node;
    const a = rebuild(node.a);
    const b = rebuild(node.b);
    return a === node.a && b === node.b ? node : { ...node, a, b };
  };
  return { tree: rebuild(tree) };
}

/** Finds a node and the region it covers. */
function locate(tree: LayoutNode, id: string): { node: LayoutNode; region: Region } | undefined {
  let found: { node: LayoutNode; region: Region } | undefined;
  walk(tree, (node, region) => {
    if (!found && node.id === id) found = { node, region };
  });
  return found;
}

/**
 * How comfortably every leaf under `node` meets the minimum size: ≥ 1 means all are valid.
 * Rectangles use width/height against `min`; shaped cells use area against `minArea` (research R23).
 */
function sizeScore(node: LayoutNode, region: Region, min: MinSize, minArea: number): number {
  let score = Infinity;
  walk(
    node,
    (n, r) => {
      if (n.type !== 'cell') return;
      const s = r.rect
        ? Math.min(r.bbox.w / min.x, r.bbox.h / min.y)
        : minArea > 0
          ? polygonArea(r.polygon) / minArea
          : Infinity;
      score = Math.min(score, s);
    },
    region,
  );
  return score;
}

/**
 * Moves a straight divider so it sits at the global `coord`, clamped so every leaf under it still
 * meets the minimum size. If cells are already too small (after a canvas change), only moves that
 * don't make them smaller are allowed. Path splits and unknown ids are left alone.
 */
export function resizeDivider(tree: LayoutNode, splitId: string, coord: number, min: MinSize, minArea = 0): LayoutNode {
  const hit = locate(tree, splitId);
  if (!hit || hit.node.type !== 'split') return tree;
  const node = hit.node;
  const bb = hit.region.bbox;
  const [start, size] = node.direction === 'horizontal' ? [bb.y, bb.h] : [bb.x, bb.w];
  if (size <= 0) return tree;

  const target = Math.min(Math.max((coord - start) / size, 1e-6), 1 - 1e-6);
  const scoreAt = (ratio: number) => sizeScore({ ...node, ratio }, hit.region, min, minArea);
  const apply = (ratio: number) => (ratio === node.ratio ? tree : replaceNode(tree, splitId, { ...node, ratio }));

  const current = scoreAt(node.ratio);
  if (current < 1 - 1e-9) {
    // Already undersized: accept the move only if it doesn't make things worse.
    return scoreAt(target) >= current - 1e-12 ? apply(target) : tree;
  }
  if (scoreAt(target) >= 1 - 1e-9) return apply(target);

  // Bisect for the furthest valid position between the current ratio and the target.
  let ok = node.ratio;
  let bad = target;
  for (let i = 0; i < 50; i++) {
    const mid = (ok + bad) / 2;
    if (scoreAt(mid) >= 1 - 1e-9) ok = mid;
    else bad = mid;
  }
  return apply(ok);
}

export interface RemoveResult {
  tree: LayoutNode;
  removedDividers: number;
  droppedImages: number;
  keptAssetId?: string;
}

/**
 * Removes a divider (straight or freehand): its whole subtree becomes one new cell that keeps the
 * first photo in reading order from `a`, or from `b` if `a` has none (research R8, Q1 option A).
 */
export function removeDivider(tree: LayoutNode, splitId: string): RemoveResult {
  const node = findNode(tree, splitId);
  if (!node || node.type === 'cell') return { tree, removedDividers: 0, droppedImages: 0 };
  const photos = (n: LayoutNode) => cellsInReadingOrder(n).flatMap((c) => (c.image ? [c.image] : []));
  const kept = photos(node.a)[0] ?? photos(node.b)[0];
  const total = photos(node).length;
  const merged = singleCell(kept);
  return {
    tree: replaceNode(tree, splitId, merged),
    removedDividers: countCells(node) - 1,
    droppedImages: total - (kept ? 1 : 0),
    keptAssetId: kept?.assetId,
  };
}

/** One cell holding the first photo in reading order. */
export function clear(tree: LayoutNode): CellNode {
  const first = cellsInReadingOrder(tree).find((c) => c.image);
  return singleCell(first?.image);
}

export function countCells(tree: LayoutNode): number {
  return tree.type === 'cell' ? 1 : countCells(tree.a) + countCells(tree.b);
}
