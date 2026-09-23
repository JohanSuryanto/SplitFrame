import {
  cellsInReadingOrder,
  clear,
  computeRects,
  computeRegions,
  dividers,
  pathDividers,
  referencedAssets,
  removeDivider,
  resizeDivider,
  setCellImage,
  setFraming,
  singleCell,
  splitAt,
  splitByPath,
  swapCellImages,
} from './layout';
import { planStroke } from './draft';
import { SKETCH_AREA, SKETCH_STROKES } from './fixtures/referenceSketch';
import { polygonArea } from './polygon';
import type { CellImage, LayoutNode } from './types';
import { expectRegionTiling, expectTiling } from './testUtils';

const img = (assetId: string, extra: Partial<CellImage> = {}): CellImage => ({
  assetId,
  zoom: 1,
  focusX: 0.5,
  focusY: 0.5,
  ...extra,
});

/** Left half | right half split into top/bottom, bottom-right split again into left/right. */
function nested(): LayoutNode {
  return {
    type: 'split',
    id: 's1',
    direction: 'vertical',
    ratio: 0.5,
    a: { type: 'cell', id: 'L', image: img('p1') },
    b: {
      type: 'split',
      id: 's2',
      direction: 'horizontal',
      ratio: 0.25,
      a: { type: 'cell', id: 'RT' },
      b: {
        type: 'split',
        id: 's3',
        direction: 'vertical',
        ratio: 0.5,
        a: { type: 'cell', id: 'RBL', image: img('p2') },
        b: { type: 'cell', id: 'RBR' },
      },
    },
  };
}

describe('computeRects', () => {
  it('returns the full area for a single cell', () => {
    const tree = singleCell();
    const rects = computeRects(tree);
    expect([...rects.values()]).toEqual([{ x: 0, y: 0, w: 1, h: 1 }]);
  });

  it('tiles [0,1]² exactly for a nested tree', () => {
    const rects = computeRects(nested());
    expect(rects.size).toBe(4);
    expectTiling(rects);
    expect(rects.get('L')).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
    expect(rects.get('RT')).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.25 });
    expect(rects.get('RBL')).toEqual({ x: 0.5, y: 0.25, w: 0.25, h: 0.75 });
    expect(rects.get('RBR')).toEqual({ x: 0.75, y: 0.25, w: 0.25, h: 0.75 });
  });
});

describe('dividers', () => {
  it('returns one entry per split in global coordinates', () => {
    const ds = dividers(nested());
    expect(ds).toHaveLength(3);
    expect(ds).toContainEqual({ splitId: 's1', direction: 'vertical', coord: 0.5, span: [0, 1] });
    expect(ds).toContainEqual({ splitId: 's2', direction: 'horizontal', coord: 0.25, span: [0.5, 1] });
    expect(ds).toContainEqual({ splitId: 's3', direction: 'vertical', coord: 0.75, span: [0.25, 1] });
  });
});

describe('cellsInReadingOrder', () => {
  it('visits depth-first, a before b', () => {
    expect(cellsInReadingOrder(nested()).map((c) => c.id)).toEqual(['L', 'RT', 'RBL', 'RBR']);
  });
});

describe('image operations', () => {
  it('setCellImage sets and clears without mutating input', () => {
    const tree = nested();
    const snapshot = JSON.stringify(tree);
    const withImg = setCellImage(tree, 'RT', img('p9'));
    expect(cellsInReadingOrder(withImg).find((c) => c.id === 'RT')?.image?.assetId).toBe('p9');
    const cleared = setCellImage(withImg, 'L', undefined);
    expect(cellsInReadingOrder(cleared).find((c) => c.id === 'L')?.image).toBeUndefined();
    expect(JSON.stringify(tree)).toBe(snapshot);
  });

  it('swapCellImages swaps and resets both framings', () => {
    const tree = setFraming(nested(), 'L', { zoom: 3, focusX: 0.1 });
    const snapshot = JSON.stringify(tree);
    const swapped = swapCellImages(tree, 'L', 'RBL');
    const cells = cellsInReadingOrder(swapped);
    expect(cells.find((c) => c.id === 'L')?.image).toEqual(img('p2'));
    expect(cells.find((c) => c.id === 'RBL')?.image).toEqual(img('p1'));
    expect(JSON.stringify(tree)).toBe(snapshot);
  });

  it('swapCellImages moves a photo into an empty cell', () => {
    const swapped = swapCellImages(nested(), 'L', 'RT');
    const cells = cellsInReadingOrder(swapped);
    expect(cells.find((c) => c.id === 'L')?.image).toBeUndefined();
    expect(cells.find((c) => c.id === 'RT')?.image?.assetId).toBe('p1');
  });

  it('setFraming patches only the target photo without mutating input', () => {
    const tree = nested();
    const snapshot = JSON.stringify(tree);
    const framed = setFraming(tree, 'L', { zoom: 2 });
    expect(cellsInReadingOrder(framed).find((c) => c.id === 'L')?.image).toEqual(img('p1', { zoom: 2 }));
    expect(JSON.stringify(tree)).toBe(snapshot);
    // Empty cells are left alone.
    expect(setFraming(tree, 'RT', { zoom: 2 })).toEqual(tree);
  });

  it('referencedAssets collects every assetId', () => {
    expect(referencedAssets(nested())).toEqual(new Set(['p1', 'p2']));
  });
});

function allIds(t: LayoutNode): string[] {
  return t.type === 'cell' ? [t.id] : [t.id, ...allIds(t.a), ...allIds(t.b)];
}

describe('splitAt (contract cases 2 and 3)', () => {
  const min = { x: 0.05, y: 0.05 };
  const cols3: LayoutNode = {
    type: 'split',
    id: 's1',
    direction: 'vertical',
    ratio: 1 / 3,
    a: { type: 'cell', id: 'A' },
    b: {
      type: 'split',
      id: 's2',
      direction: 'vertical',
      ratio: 0.5,
      a: { type: 'cell', id: 'B', image: img('p1') },
      b: { type: 'cell', id: 'C' },
    },
  };

  it('splits a single cell with the right local ratio', () => {
    const res = splitAt(singleCell(), 'vertical', 0.3, [0.2, 0.8], min);
    if (!('tree' in res)) throw new Error('expected a tree');
    const rects = [...computeRects(res.tree).values()];
    expect(rects).toHaveLength(2);
    expect(rects[0]!.w).toBeCloseTo(0.3, 12);
    expect(rects[1]!.x).toBeCloseTo(0.3, 12);
  });

  it('splits every crossed cell at the same coordinate and leaves the rest alone', () => {
    // Horizontal stroke across columns B and C only.
    const res = splitAt(cols3, 'horizontal', 0.4, [0.5, 0.95], min);
    if (!('tree' in res)) throw new Error('expected a tree');
    const rects = computeRects(res.tree);
    expect(rects.size).toBe(5);
    expectTiling(rects);
    expect(rects.get('A')).toEqual({ x: 0, y: 0, w: 1 / 3, h: 1 });
    expect(rects.get('B')!.h).toBeCloseTo(0.4, 12);
    expect(rects.get('C')!.h).toBeCloseTo(0.4, 12);
    const lower = [...rects.values()].filter((r) => Math.abs(r.y - 0.4) < 1e-12);
    expect(lower).toHaveLength(2);
  });

  it('a stroke across all three columns splits all three', () => {
    const res = splitAt(cols3, 'horizontal', 0.5, [0, 1], min);
    if (!('tree' in res)) throw new Error('expected a tree');
    expect(computeRects(res.tree).size).toBe(6);
  });

  it('is all-or-nothing when any target would be too small', () => {
    const mixed: LayoutNode = {
      type: 'split',
      id: 's',
      direction: 'vertical',
      ratio: 0.5,
      a: { type: 'cell', id: 'L' },
      b: {
        type: 'split',
        id: 't',
        direction: 'horizontal',
        ratio: 0.45,
        a: { type: 'cell', id: 'RT' },
        b: { type: 'cell', id: 'RB' },
      },
    };
    const snapshot = JSON.stringify(mixed);
    // y = 0.48 is fine for L (0.48 / 0.52) but leaves RB with only 0.03 above the new line.
    expect(splitAt(mixed, 'horizontal', 0.48, [0, 1], min)).toEqual({ error: 'too-small' });
    expect(JSON.stringify(mixed)).toBe(snapshot);
  });

  it('returns no-target when the stroke crosses no cell interior', () => {
    const rows: LayoutNode = {
      type: 'split',
      id: 's',
      direction: 'horizontal',
      ratio: 0.5,
      a: { type: 'cell', id: 'T' },
      b: { type: 'cell', id: 'U' },
    };
    // A horizontal line exactly on the existing edge splits nothing.
    expect(splitAt(rows, 'horizontal', 0.5, [0, 1], min)).toEqual({ error: 'no-target' });
  });

  it('keeps the photo in child a, which keeps the target id', () => {
    const res = splitAt(cols3, 'horizontal', 0.5, [0.4, 0.6], min);
    if (!('tree' in res)) throw new Error('expected a tree');
    const cells = cellsInReadingOrder(res.tree);
    expect(cells.find((c) => c.id === 'B')?.image?.assetId).toBe('p1');
    expect(cells.filter((c) => c.image)).toHaveLength(1);
  });

  it('gives the same ids for repeated calls with the same makeId, and all ids stay unique', () => {
    const map = new Map<string, string>();
    const makeId = (id: string, role: string) => {
      const key = `${id}:${role}`;
      if (!map.has(key)) map.set(key, `new-${map.size}`);
      return map.get(key)!;
    };
    const r1 = splitAt(cols3, 'horizontal', 0.5, [0, 1], min, makeId);
    const r2 = splitAt(cols3, 'horizontal', 0.6, [0, 1], min, makeId);
    if (!('tree' in r1) || !('tree' in r2)) throw new Error('expected trees');
    expect(allIds(r1.tree)).toEqual(allIds(r2.tree));
    expect(new Set(allIds(r1.tree)).size).toBe(allIds(r1.tree).length);
  });
});

describe('computeRegions with path splits', () => {
  // Left half | right half cut by a diagonal from its top-left to its bottom-right corner.
  const mixed: LayoutNode = {
    type: 'split',
    id: 's',
    direction: 'vertical',
    ratio: 0.5,
    a: { type: 'cell', id: 'L' },
    b: {
      type: 'path',
      id: 'p',
      path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      aFirst: true,
      a: { type: 'cell', id: 'R1' },
      b: { type: 'cell', id: 'R2' },
    },
  };

  it('tiles the canvas and marks shaped cells', () => {
    const regions = computeRegions(mixed);
    expect(regions.size).toBe(3);
    expectRegionTiling(regions);
    expect(regions.get('L')!.rect).toBe(true);
    expect(regions.get('R1')!.rect).toBe(false);
    expect(polygonArea(regions.get('R1')!.polygon)).toBeCloseTo(0.25, 12);
  });

  it('keeps path splits attached after an ancestor divider moves', () => {
    const moved = { ...mixed, ratio: 0.3 } as LayoutNode;
    const regions = computeRegions(moved);
    expectRegionTiling(regions);
    expect(polygonArea(regions.get('R1')!.polygon)).toBeCloseTo(0.35, 12);
  });

  it('lists path dividers in content coordinates', () => {
    expect(pathDividers(mixed)).toEqual([{ splitId: 'p', points: [{ x: 0.5, y: 0 }, { x: 1, y: 1 }] }]);
    expect(dividers(mixed).map((d) => d.splitId)).toEqual(['s']);
  });
});

describe('splitByPath (contract cases 9, 11)', () => {
  const minArea = 0.001;

  it('cuts a corner and keeps the photo in the larger piece', () => {
    const tree: LayoutNode = { type: 'cell', id: 'c', image: img('p1') };
    const res = splitByPath(tree, [{ x: 0.3, y: -0.1 }, { x: -0.1, y: 0.3 }], minArea);
    if (!('tree' in res)) throw new Error(res.error);
    const regions = computeRegions(res.tree);
    expect(regions.size).toBe(2);
    expectRegionTiling(regions);
    const photoCell = cellsInReadingOrder(res.tree).find((c) => c.image)!;
    expect(photoCell.id).toBe('c');
    expect(polygonArea(regions.get('c')!.polygon)).toBeGreaterThan(0.9);
  });

  it('rejects a self-crossing path', () => {
    const tree = singleCell();
    const eight = [
      { x: -0.1, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.8, y: 0.2 },
      { x: 0.2, y: 0.8 },
      { x: 1.1, y: 0.5 },
    ];
    expect(splitByPath(tree, eight, minArea)).toEqual({ error: 'self-crossing' });
  });

  it('rejects a path that never crosses a cell from edge to edge', () => {
    expect(splitByPath(singleCell(), [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.6 }], minArea)).toEqual({ error: 'no-target' });
  });

  it('rejects pieces below the minimum area and leaves the tree unchanged', () => {
    const tree = singleCell();
    const snapshot = JSON.stringify(tree);
    // Cuts off a 0.1 × 0.1 corner triangle (area 0.005), below the 0.01 minimum.
    expect(splitByPath(tree, [{ x: 0.15, y: -0.05 }, { x: -0.05, y: 0.15 }], 0.01)).toEqual({ error: 'too-small' });
    expect(JSON.stringify(tree)).toBe(snapshot);
  });

  it('splits a cell once per pass of a wavy path', () => {
    const wavy = [
      { x: -0.1, y: 0.4 },
      { x: 0.3, y: -0.2 },
      { x: 0.7, y: -0.2 },
      { x: 1.1, y: 0.4 },
    ];
    const res = splitByPath(singleCell(), wavy, minArea);
    if (!('tree' in res)) throw new Error(res.error);
    const regions = computeRegions(res.tree);
    expect(regions.size).toBe(3);
    expectRegionTiling(regions);
  });

  it('gives stable ids with a shared makeId', () => {
    const map = new Map<string, string>();
    const makeId = (id: string, role: string) => {
      const key = `${id}:${role}`;
      if (!map.has(key)) map.set(key, `n${map.size}`);
      return map.get(key)!;
    };
    const tree = singleCell();
    const r1 = splitByPath(tree, [{ x: 0.3, y: -0.1 }, { x: -0.1, y: 0.3 }], minArea, makeId);
    const r2 = splitByPath(tree, [{ x: 0.32, y: -0.1 }, { x: -0.1, y: 0.33 }], minArea, makeId);
    if (!('tree' in r1) || !('tree' in r2)) throw new Error('expected trees');
    expect(allIds(r1.tree)).toEqual(allIds(r2.tree));
  });
});

describe('reference sketch (SC-011, contract case 9)', () => {
  const opts = { min: { x: 0.02, y: 0.02 }, minArea: 0.0005 };

  function drawAll(count = SKETCH_STROKES.length): LayoutNode {
    let tree: LayoutNode = singleCell();
    for (const stroke of SKETCH_STROKES.slice(0, count)) {
      const draft = planStroke(tree, stroke.points, SKETCH_AREA, opts);
      if (!draft || !('tree' in draft.result)) {
        throw new Error(`${stroke.name}: ${draft ? (draft.result as { error: string }).error : 'no draft'}`);
      }
      tree = draft.result.tree;
    }
    return tree;
  }

  it('the long vertical becomes a straight split', () => {
    const tree = drawAll(1);
    expect(tree.type).toBe('split');
  });

  it('the overshoot of the horizontal line leaves the left side unsplit', () => {
    const tree = drawAll(2);
    const regions = computeRegions(tree);
    expect(regions.size).toBe(3);
    const left = [...regions.values()].filter((r) => r.bbox.x < 0.01);
    expect(left).toHaveLength(1);
    expect(left[0]!.rect).toBe(true);
  });

  it('all seven strokes give exactly 8 cells that tile the canvas', () => {
    const regions = computeRegions(drawAll());
    expect(regions.size).toBe(8);
    expectRegionTiling(regions);
  });
});

describe('resizeDivider (contract case 4)', () => {
  const min = { x: 0.1, y: 0.1 };
  const nestedCols: LayoutNode = {
    type: 'split',
    id: 's1',
    direction: 'vertical',
    ratio: 0.5,
    a: { type: 'cell', id: 'L' },
    b: {
      type: 'split',
      id: 's2',
      direction: 'vertical',
      ratio: 0.5,
      a: { type: 'cell', id: 'M' },
      b: { type: 'cell', id: 'R' },
    },
  };

  it('moves a divider to a global coordinate', () => {
    const rects = computeRects(resizeDivider(nestedCols, 's1', 0.4, min));
    expect(rects.get('L')!.w).toBeCloseTo(0.4, 9);
  });

  it('clamps so the smallest leaf in a nested subtree stays at the minimum', () => {
    // Right side holds two columns; each must stay ≥ 0.1, so the right side must stay ≥ 0.2.
    const moved = resizeDivider(nestedCols, 's1', 0.95, min);
    const rects = computeRects(moved);
    expect(rects.get('L')!.w).toBeCloseTo(0.8, 5);
    expect(rects.get('M')!.w).toBeCloseTo(0.1, 5);
    // Child ratios keep their relative values.
    expect((moved as { b: { ratio: number } }).b.ratio).toBe(0.5);
  });

  it('when cells are already too small, allows only moves that make them bigger', () => {
    const tight: LayoutNode = { ...(nestedCols as object), ratio: 0.85 } as LayoutNode; // right columns 0.075 each
    expect(resizeDivider(tight, 's1', 0.9, min)).toBe(tight);
    const grown = computeRects(resizeDivider(tight, 's1', 0.8, min));
    expect(grown.get('M')!.w).toBeCloseTo(0.1, 9);
  });

  it('refuses path splits and unknown ids', () => {
    const tree: LayoutNode = {
      type: 'path',
      id: 'p',
      path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      aFirst: true,
      a: { type: 'cell', id: 'A' },
      b: { type: 'cell', id: 'B' },
    };
    expect(resizeDivider(tree, 'p', 0.3, min)).toBe(tree);
    expect(resizeDivider(nestedCols, 'nope', 0.3, min)).toBe(nestedCols);
  });

  it('clamps by area when it stretches shaped cells inside (research R23)', () => {
    // Right half cut by its diagonal: each triangle has area w / 2 and must stay ≥ 0.1, so w ≥ 0.2.
    const tree: LayoutNode = {
      type: 'split',
      id: 's',
      direction: 'vertical',
      ratio: 0.5,
      a: { type: 'cell', id: 'L' },
      b: {
        type: 'path',
        id: 'p',
        path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        aFirst: true,
        a: { type: 'cell', id: 'T1' },
        b: { type: 'cell', id: 'T2' },
      },
    };
    const regions = computeRegions(resizeDivider(tree, 's', 0.95, { x: 0.01, y: 0.01 }, 0.1));
    expect(regions.get('L')!.bbox.w).toBeCloseTo(0.8, 5);
    expect(polygonArea(regions.get('T1')!.polygon)).toBeCloseTo(0.1, 5);
  });
});

describe('removeDivider (contract case 5)', () => {
  const twoPhotos: LayoutNode = {
    type: 'split',
    id: 's',
    direction: 'vertical',
    ratio: 0.5,
    a: { type: 'cell', id: 'A', image: img('pa') },
    b: { type: 'cell', id: 'B', image: img('pb') },
  };

  it('merges two photo cells and keeps the photo from a', () => {
    const res = removeDivider(twoPhotos, 's');
    expect(res.tree.type).toBe('cell');
    expect(cellsInReadingOrder(res.tree)[0]!.image?.assetId).toBe('pa');
    expect(res.droppedImages).toBe(1);
    expect(res.removedDividers).toBe(1);
    expect(res.keptAssetId).toBe('pa');
    // The merged cell gets a new id.
    expect(['A', 'B', 's']).not.toContain(res.tree.id);
  });

  it('merges nested sub-grids into one cell with correct counts', () => {
    const tree: LayoutNode = {
      type: 'split',
      id: 'root',
      direction: 'vertical',
      ratio: 0.5,
      a: { type: 'cell', id: 'L' },
      b: {
        type: 'split',
        id: 'r1',
        direction: 'horizontal',
        ratio: 1 / 3,
        a: { type: 'cell', id: 'R1', image: img('p1') },
        b: {
          type: 'split',
          id: 'r2',
          direction: 'horizontal',
          ratio: 0.5,
          a: { type: 'cell', id: 'R2', image: img('p2') },
          b: { type: 'cell', id: 'R3' },
        },
      },
    };
    const res = removeDivider(tree, 'root');
    expect(res.tree.type).toBe('cell');
    expect(res.removedDividers).toBe(3);
    // a (L) has no photo, so the first photo of b is kept and the other is dropped.
    expect(res.keptAssetId).toBe('p1');
    expect(res.droppedImages).toBe(1);
  });

  it('merges only the subtree of the removed divider', () => {
    const tree: LayoutNode = {
      type: 'split',
      id: 'root',
      direction: 'vertical',
      ratio: 0.5,
      a: { type: 'cell', id: 'L' },
      b: twoPhotos,
    };
    const res = removeDivider(tree, 's');
    expect(computeRects(res.tree).size).toBe(2);
    expect(computeRects(res.tree).get('L')).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
  });

  it('merges a path split like a straight one', () => {
    const tree: LayoutNode = {
      type: 'path',
      id: 'p',
      path: [{ x: 0.3, y: 0 }, { x: 0, y: 0.3 }],
      aFirst: false,
      a: { type: 'cell', id: 'Big', image: img('big') },
      b: { type: 'cell', id: 'Corner', image: img('corner') },
    };
    const res = removeDivider(tree, 'p');
    expect(res.tree.type).toBe('cell');
    expect(res.keptAssetId).toBe('big');
    expect(res.droppedImages).toBe(1);
  });

  it('is a no-op for a cell id', () => {
    const res = removeDivider(twoPhotos, 'A');
    expect(res.tree).toBe(twoPhotos);
    expect(res.removedDividers).toBe(0);
  });
});

describe('clear', () => {
  it('returns one cell holding the first photo in reading order', () => {
    const cleared = clear(nested());
    expect(cleared.type).toBe('cell');
    expect(cellsInReadingOrder(cleared)[0]!.image?.assetId).toBe('p1');
  });

  it('returns an empty cell when there are no photos', () => {
    const cleared = clear({
      type: 'split',
      id: 's',
      direction: 'vertical',
      ratio: 0.5,
      a: { type: 'cell', id: 'a' },
      b: { type: 'cell', id: 'b' },
    });
    expect(cleared).toEqual({ type: 'cell', id: expect.any(String) });
  });
});
