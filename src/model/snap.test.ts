import { snap, snapCandidates, strokeToLine } from './snap';
import type { LayoutNode } from './types';

const tree: LayoutNode = {
  type: 'split',
  id: 's1',
  direction: 'vertical',
  ratio: 0.25,
  a: { type: 'cell', id: 'A' },
  b: {
    type: 'split',
    id: 's2',
    direction: 'horizontal',
    ratio: 0.4,
    a: { type: 'cell', id: 'B' },
    b: { type: 'cell', id: 'C' },
  },
};

describe('snapCandidates', () => {
  it('includes center, thirds and parallel edges', () => {
    const v = snapCandidates(tree, 'vertical').map((c) => [c.kind, c.value]);
    expect(v).toContainEqual(['center', 0.5]);
    expect(v).toContainEqual(['third', 1 / 3]);
    expect(v).toContainEqual(['third', 2 / 3]);
    expect(v).toContainEqual(['edge', 0.25]);
    // The horizontal divider is not parallel to a vertical line.
    expect(v).not.toContainEqual(['edge', 0.4]);
    expect(snapCandidates(tree, 'horizontal').map((c) => [c.kind, c.value])).toContainEqual(['edge', 0.4]);
  });

  it('leaves out the excluded split edge', () => {
    const v = snapCandidates(tree, 'vertical', 's1').map((c) => c.value);
    expect(v).not.toContain(0.25);
  });
});

describe('snap (contract case 6)', () => {
  const c = snapCandidates(tree, 'vertical');

  it('snaps to the nearest candidate within the threshold', () => {
    expect(snap(0.51, c, 0.02)).toEqual({ value: 0.5, guide: { kind: 'center', value: 0.5 } });
    expect(snap(0.26, c, 0.02)).toEqual({ value: 0.25, guide: { kind: 'edge', value: 0.25 } });
    expect(snap(0.34, c, 0.02).guide?.kind).toBe('third');
  });

  it('does not snap outside the threshold', () => {
    expect(snap(0.42, c, 0.02)).toEqual({ value: 0.42 });
  });

  it('prefers center over third over edge at equal distance', () => {
    const tie = [
      { kind: 'edge' as const, value: 0.5 },
      { kind: 'third' as const, value: 0.5 },
      { kind: 'center' as const, value: 0.5 },
    ];
    expect(snap(0.5, tie, 0.02).guide?.kind).toBe('center');
    expect(snap(0.5, tie.slice(0, 2), 0.02).guide?.kind).toBe('third');
  });
});

describe('strokeToLine', () => {
  const area = { x: 0, y: 0, w: 200, h: 400 };

  it('picks horizontal when the drag moved mostly sideways', () => {
    const line = strokeToLine([{ x: 20, y: 100 }, { x: 90, y: 110 }, { x: 180, y: 96 }], area);
    expect(line?.axis).toBe('horizontal');
    expect(line?.coord).toBeCloseTo(102 / 400, 9);
    expect(line?.span[0]).toBeCloseTo(0.1, 9);
    expect(line?.span[1]).toBeCloseTo(0.9, 9);
  });

  it('picks vertical when the drag moved mostly up or down', () => {
    const line = strokeToLine([{ x: 100, y: 10 }, { x: 104, y: 390 }], area);
    expect(line?.axis).toBe('vertical');
    expect(line?.coord).toBeCloseTo(102 / 200, 9);
  });

  it('returns null for strokes shorter than 6 px', () => {
    expect(strokeToLine([{ x: 10, y: 10 }, { x: 13, y: 13 }], area)).toBeNull();
  });

  it('clamps the span to the canvas and respects the content-area offset', () => {
    const padded = { x: 20, y: 20, w: 160, h: 360 };
    const line = strokeToLine([{ x: -50, y: 200 }, { x: 400, y: 200 }], padded);
    expect(line?.span).toEqual([0, 1]);
    expect(line?.coord).toBeCloseTo(180 / 360, 9);
  });
});
