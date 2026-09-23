import { applyPreset, buildPreset, CANVAS_PRESETS, LAYOUT_PRESETS, type LayoutPresetKind } from './presets';
import { cellsInReadingOrder, computeRects } from './layout';
import { expectTiling } from './testUtils';
import type { CellImage, LayoutNode } from './types';

const img = (assetId: string): CellImage => ({ assetId, zoom: 1, focusX: 0.5, focusY: 0.5 });

describe('buildPreset (contract case 1)', () => {
  const expected: Record<LayoutPresetKind, number> = {
    cols2: 2,
    cols3: 3,
    cols4: 4,
    rows2: 2,
    rows3: 3,
    grid2x2: 4,
  };

  for (const kind of Object.keys(expected) as LayoutPresetKind[]) {
    it(`${kind} gives ${expected[kind]} equal cells that tile the canvas`, () => {
      const rects = computeRects(buildPreset(kind));
      expect(rects.size).toBe(expected[kind]);
      expectTiling(rects);
      const areas = [...rects.values()].map((r) => r.w * r.h);
      for (const a of areas) expect(a).toBeCloseTo(1 / expected[kind], 9);
    });
  }

  it('columns are side by side and rows are stacked', () => {
    const cols = [...computeRects(buildPreset('cols3')).values()];
    expect(cols.every((r) => r.h === 1)).toBe(true);
    const rows = [...computeRects(buildPreset('rows3')).values()];
    expect(rows.every((r) => r.w === 1)).toBe(true);
  });

  it('every layout preset kind is listed for the toolbar', () => {
    expect(LAYOUT_PRESETS.map((p) => p.kind).sort()).toEqual(Object.keys(expected).sort());
  });
});

describe('applyPreset', () => {
  const threePhotos: LayoutNode = {
    type: 'split',
    id: 's1',
    direction: 'vertical',
    ratio: 0.3,
    a: { type: 'cell', id: 'a', image: img('p1') },
    b: {
      type: 'split',
      id: 's2',
      direction: 'horizontal',
      ratio: 0.5,
      a: { type: 'cell', id: 'b', image: img('p2') },
      b: { type: 'cell', id: 'c', image: img('p3') },
    },
  };

  it('moves photos over in reading order and counts the dropped ones', () => {
    const { tree, droppedImages } = applyPreset(threePhotos, 'cols2');
    expect(cellsInReadingOrder(tree).map((c) => c.image?.assetId)).toEqual(['p1', 'p2']);
    expect(droppedImages).toBe(1);
  });

  it('leaves extra cells empty when there are fewer photos', () => {
    const { tree, droppedImages } = applyPreset(threePhotos, 'cols4');
    expect(cellsInReadingOrder(tree).map((c) => c.image?.assetId)).toEqual(['p1', 'p2', 'p3', undefined]);
    expect(droppedImages).toBe(0);
  });

  it('resets framing on moved photos', () => {
    const framed: LayoutNode = { type: 'cell', id: 'x', image: { assetId: 'p', zoom: 4, focusX: 0, focusY: 1 } };
    const { tree } = applyPreset(framed, 'cols2');
    expect(cellsInReadingOrder(tree)[0]!.image).toEqual(img('p'));
  });
});

describe('CANVAS_PRESETS', () => {
  it('has the spec sizes', () => {
    expect(CANVAS_PRESETS).toEqual({
      '9:16': [1080, 1920],
      '1:1': [1080, 1080],
      '4:5': [1080, 1350],
      '16:9': [1920, 1080],
    });
  });
});
