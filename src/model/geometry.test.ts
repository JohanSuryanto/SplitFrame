import { layoutPixels, minSizeNorm, styleLimits, styleScale } from './geometry';
import { DEFAULT_STYLE, type Doc, type LayoutNode, type Style } from './types';

const twoCols: LayoutNode = {
  type: 'split',
  id: 's',
  direction: 'vertical',
  ratio: 0.5,
  a: { type: 'cell', id: 'A' },
  b: { type: 'cell', id: 'B' },
};

function doc(width: number, height: number, style: Partial<Style> = {}, layout: LayoutNode = twoCols): Doc {
  return {
    canvas: { preset: 'custom', width, height },
    layout,
    style: { ...DEFAULT_STYLE, ...style },
  };
}

describe('styleScale', () => {
  it('scales against the canvas short side (1080)', () => {
    expect(styleScale({ w: 1080, h: 1920 })).toBe(1);
    expect(styleScale({ w: 1920, h: 1080 })).toBe(1);
    expect(styleScale({ w: 2160, h: 3840 })).toBe(2);
    expect(styleScale({ w: 540, h: 960 })).toBe(0.5);
  });
});

describe('layoutPixels', () => {
  it('insets only inner edges by gap/2 (contract case 7)', () => {
    const cells = layoutPixels(doc(1080, 1920, { gap: 20, padding: 0 }), { w: 1080, h: 1920 });
    expect(cells).toEqual([
      { cellId: 'A', x: 0, y: 0, w: 530, h: 1920, r: 0 },
      { cellId: 'B', x: 550, y: 0, w: 530, h: 1920, r: 0 },
    ]);
  });

  it('applies padding on every outer side and no extra gap at the outer edge', () => {
    const cells = layoutPixels(doc(1080, 1920, { gap: 20, padding: 30 }), { w: 1080, h: 1920 });
    // Content area is 30..1050 × 30..1890 (1020 wide); split at 540.
    expect(cells[0]).toEqual({ cellId: 'A', x: 30, y: 30, w: 500, h: 1860, r: 0 });
    expect(cells[1]).toEqual({ cellId: 'B', x: 550, y: 30, w: 500, h: 1860, r: 0 });
  });

  it('scales the radius and clamps it to half the smaller side', () => {
    // 540×1080 cells: radius 100 fits unchanged.
    const full = layoutPixels(doc(1080, 1080, { gap: 0, radius: 100 }), { w: 1080, h: 1080 });
    expect(full[0]!.r).toBe(100);
    // Preview at 200×200: radius scales by 200/1080.
    const small = layoutPixels(doc(1080, 1080, { gap: 0, radius: 100 }), { w: 200, h: 200 });
    expect(small[0]!.r).toBeCloseTo(100 * (200 / 1080), 9);
    // A 1080×108 cell: radius is clamped to 54.
    const thin = layoutPixels(
      doc(1080, 1080, { gap: 0, radius: 100 }, {
        type: 'split',
        id: 's',
        direction: 'horizontal',
        ratio: 0.1,
        a: { type: 'cell', id: 'T' },
        b: { type: 'cell', id: 'U' },
      }),
      { w: 1080, h: 1080 },
    );
    expect(thin[0]!.r).toBe(54);
  });

  it('keeps style values proportional to the short side', () => {
    const wide = layoutPixels(doc(1920, 1080, { gap: 20 }), { w: 1920, h: 1080 });
    expect(wide[1]!.x - (wide[0]!.x + wide[0]!.w)).toBeCloseTo(20, 9);
    const big = layoutPixels(doc(2160, 3840, { gap: 20 }), { w: 2160, h: 3840 });
    expect(big[1]!.x - (big[0]!.x + big[0]!.w)).toBeCloseTo(40, 9);
  });
});

describe('styleLimits (T062)', () => {
  /** n equal columns. */
  const columns = (n: number): LayoutNode =>
    n === 1
      ? { type: 'cell', id: `c${n}` }
      : { type: 'split', id: `s${n}`, direction: 'vertical', ratio: 1 / n, a: { type: 'cell', id: `c${n}` }, b: columns(n - 1) };

  it('allows the full ranges on a normal layout', () => {
    expect(styleLimits(doc(1080, 1920))).toEqual({ maxGap: 40, maxPadding: 100 });
  });

  it('keeps every cell at least 1 export px on a crowded grid', () => {
    for (const n of [12, 40]) {
      const d = doc(100, 100, { gap: 0, padding: 0 }, columns(n));
      const { maxGap, maxPadding } = styleLimits(d);
      expect(maxGap).toBeLessThanOrEqual(40);
      expect(maxPadding).toBeLessThanOrEqual(100);
      for (const style of [{ gap: maxGap }, { padding: maxPadding }]) {
        const cells = layoutPixels({ ...d, style: { ...d.style, ...style } }, { w: 100, h: 100 });
        for (const c of cells) {
          expect(c.w).toBeGreaterThanOrEqual(1);
          expect(c.h).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('lowers the limits when cells are thin', () => {
    const { maxGap } = styleLimits(doc(100, 100, { gap: 0 }, columns(40)));
    expect(maxGap).toBeLessThan(40);
  });
});

describe('minSizeNorm', () => {
  it('uses max(5% of the side, 40 px) over the content size', () => {
    const m = minSizeNorm({ preset: '9:16', width: 1080, height: 1920 }, DEFAULT_STYLE);
    expect(m.x).toBeCloseTo(54 / 1080, 12);
    expect(m.y).toBeCloseTo(96 / 1920, 12);
  });

  it('falls back to 40 px on small custom canvases', () => {
    const m = minSizeNorm({ preset: 'custom', width: 400, height: 400 }, DEFAULT_STYLE);
    expect(m.x).toBeCloseTo(40 / 400, 12);
    expect(m.y).toBeCloseTo(40 / 400, 12);
  });
});
