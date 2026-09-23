import { frameImage } from '../model/frame';
import { layoutPixels } from '../model/geometry';
import { DEFAULT_STYLE, type Doc, type LayoutNode } from '../model/types';
import { planDraw, type DrawOp } from './planDraw';

const photo = (assetId: string) => ({ assetId, zoom: 1, focusX: 0.5, focusY: 0.5 });

const twoCols = (image?: string): LayoutNode => ({
  type: 'split',
  id: 's',
  direction: 'vertical',
  ratio: 0.5,
  a: image ? { type: 'cell', id: 'A', image: photo(image) } : { type: 'cell', id: 'A' },
  b: { type: 'cell', id: 'B' },
});

const doc = (layout: LayoutNode, style: Partial<Doc['style']> = {}): Doc => ({
  canvas: { preset: '9:16', width: 1080, height: 1920 },
  layout,
  style: { ...DEFAULT_STYLE, gap: 20, padding: 0, ...style },
});

const assets = (id: string) => (id === 'photo' ? { width: 4000, height: 3000 } : undefined);
const clips = (ops: DrawOp[]) => ops.filter((o): o is Extract<DrawOp, { op: 'clip' }> => o.op === 'clip');

describe('planDraw (contract case 7, T026)', () => {
  it('fills the background first, then clips each cell to its rectangle', () => {
    const ops = planDraw(doc(twoCols()), assets, { w: 1080, h: 1920 });
    expect(ops[0]).toEqual({ op: 'fill', color: DEFAULT_STYLE.color, rect: { x: 0, y: 0, w: 1080, h: 1920 } });
    expect(clips(ops).map((c) => c.rect)).toEqual([
      { x: 0, y: 0, w: 530, h: 1920 },
      { x: 550, y: 0, w: 530, h: 1920 },
    ]);
  });

  it('draws nothing inside an empty cell', () => {
    const ops = planDraw(doc(twoCols()), assets, { w: 1080, h: 1920 });
    expect(ops.filter((o) => o.op === 'image')).toHaveLength(0);
  });

  it('crops each photo exactly like the editor', () => {
    const d = doc(twoCols('photo'));
    const ops = planDraw(d, assets, { w: 1080, h: 1920 });
    const image = ops.find((o) => o.op === 'image');
    const cell = layoutPixels(d, { w: 1080, h: 1920 })[0]!;
    expect(image).toEqual({
      op: 'image',
      assetId: 'photo',
      src: frameImage(cell, { width: 4000, height: 3000 }, photo('photo')),
      dest: { x: 0, y: 0, w: 530, h: 1920 },
    });
  });

  it('skips photos whose asset is missing', () => {
    const ops = planDraw(doc(twoCols('gone')), assets, { w: 1080, h: 1920 });
    expect(ops.filter((o) => o.op === 'image')).toHaveLength(0);
  });

  it('scales with the render size (preview matches export, SC-003, SC-010)', () => {
    const d = doc(twoCols('photo'), { padding: 30, radius: 24 });
    const big = clips(planDraw(d, assets, { w: 1080, h: 1920 }));
    const small = clips(planDraw(d, assets, { w: 540, h: 960 }));
    const tolerance = 0.01 * 1080;
    big.forEach((b, i) => {
      const s = small[i]!;
      expect(Math.abs(s.rect.x * 2 - b.rect.x)).toBeLessThan(tolerance);
      expect(Math.abs(s.rect.w * 2 - b.rect.w)).toBeLessThan(tolerance);
      expect(Math.abs(s.r * 2 - b.r)).toBeLessThan(tolerance);
    });
  });

  it('draws the gap along every divider, after all cells', () => {
    const ops = planDraw(doc(twoCols()), assets, { w: 1080, h: 1920 });
    const strokes = ops.filter((o) => o.op === 'stroke');
    expect(strokes).toEqual([
      { op: 'stroke', points: [{ x: 540, y: 0 }, { x: 540, y: 1920 }], width: 20, color: DEFAULT_STYLE.color },
    ]);
    const lastClip = ops.map((o) => o.op).lastIndexOf('restore');
    expect(ops.indexOf(strokes[0]!)).toBeGreaterThan(lastClip);
  });

  it('draws no gap strokes when the gap is 0', () => {
    const ops = planDraw(doc(twoCols(), { gap: 0 }), assets, { w: 1080, h: 1920 });
    expect(ops.filter((o) => o.op === 'stroke')).toHaveLength(0);
  });

  it('clips shaped cells to their outline and fills their bounding box (research R22)', () => {
    const diagonal: LayoutNode = {
      type: 'path',
      id: 'p',
      path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      aFirst: true,
      a: { type: 'cell', id: 'T1', image: photo('photo') },
      b: { type: 'cell', id: 'T2' },
    };
    const ops = planDraw(doc(diagonal), assets, { w: 1080, h: 1920 });
    const [c1, c2] = clips(ops);
    expect(c1!.path).toHaveLength(3);
    expect(c2!.path).toHaveLength(3);
    const image = ops.find((o) => o.op === 'image') as Extract<DrawOp, { op: 'image' }>;
    expect(image.dest).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
    const strokes = ops.filter((o) => o.op === 'stroke');
    expect(strokes).toEqual([{ op: 'stroke', points: [{ x: 0, y: 0 }, { x: 1080, y: 1920 }], width: 20, color: DEFAULT_STYLE.color }]);
  });
});
