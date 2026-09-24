import { WATERMARK_TEXT, planWatermark, watermarkFits } from './watermark';

/** About 0.55 em per character, like a typical sans-serif. */
const measure = (text: string, fontPx: number) => text.length * 0.55 * fontPx;

const plan = (w: number, h: number, sizePx = { w, h }, m = measure) => {
  const op = planWatermark({ width: w, height: h }, sizePx, m);
  if (!op) throw new Error('expected a watermark');
  return op;
};

describe('planWatermark (T006)', () => {
  it('leaves room for the Story controls on 9:16', () => {
    const op = plan(1080, 1920);
    expect(op.text).toBe(WATERMARK_TEXT);
    expect(op.fontPx).toBeCloseTo(27, 6);
    expect(op.x).toBe(540);
    expect(op.y).toBeCloseTo(1920 - 96 - 6.75, 2);
  });

  it('uses a small margin on other shapes', () => {
    expect(plan(1080, 1080).y).toBeCloseTo(1080 - 32.4 - 6.75, 2);
  });

  it('scales with the canvas', () => {
    const a = plan(1080, 1920);
    const b = plan(2160, 3840);
    expect(b.fontPx).toBeCloseTo(a.fontPx * 2, 6);
    expect(b.x).toBeCloseTo(a.x * 2, 6);
    expect(b.y).toBeCloseTo(a.y * 2, 6);
    expect(b.shadow.blur).toBeCloseTo(a.shadow.blur * 2, 6);
  });

  it('draws Preview at exactly the export proportions', () => {
    const full = plan(1080, 1920);
    const half = plan(1080, 1920, { w: 540, h: 960 });
    expect(half.fontPx).toBeCloseTo(full.fontPx / 2, 6);
    expect(half.x).toBeCloseTo(full.x / 2, 6);
    expect(half.y).toBeCloseTo(full.y / 2, 6);
    expect(half.shadow.offsetY).toBeCloseTo(full.shadow.offsetY / 2, 6);
  });

  it('is still drawn at the 10 px minimum', () => {
    expect(plan(8000, 400).fontPx).toBeCloseTo(10, 6);
  });

  it('shrinks to fit when the font runs wide', () => {
    const wide = (t: string, f: number) => 2 * measure(t, f);
    const op = plan(1080, 1080, undefined, wide);
    expect(wide(op.text, op.fontPx)).toBeLessThanOrEqual(0.9 * 1080 + 1e-9);
    expect(op.fontPx).toBeLessThan(27);
  });

  it('is left out when it would be unreadably small', () => {
    expect(planWatermark({ width: 300, height: 300 }, { w: 300, h: 300 }, measure)).toBeNull();
  });

  it('uses the app font stack at the planned size', () => {
    const op = plan(1080, 1920);
    expect(op.font.startsWith(`600 ${op.fontPx}px`)).toBe(true);
    expect(op.font).toContain('system-ui');
  });
});

describe('watermarkFits (T006)', () => {
  it.each([
    [1080, 1920, true],
    [1080, 1080, true],
    [1920, 1080, true],
    [8000, 400, true],
    [300, 300, false],
    [399, 1000, false],
  ])('%i×%i → %s', (width, height, fits) => {
    expect(watermarkFits({ width, height })).toBe(fits);
    expect(planWatermark({ width, height }, { w: width, h: height }, measure) !== null).toBe(fits);
  });
});
