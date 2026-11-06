import { removeBackground } from './removeBackground';

type Rgba = [number, number, number, number];

function img(w: number, h: number, fill: (x: number, y: number) => Rgba) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}

const grey = (v: number, a = 255): Rgba => [v, v, v, a];
const alphaAt = (out: { data: Uint8ClampedArray }, w: number, x: number, y: number) => out.data[(y * w + x) * 4 + 3]!;
const inBar = (x: number, y: number) => x >= 50 && x < 150 && y >= 40 && y < 60;

describe('removeBackground (T016)', () => {
  it('keeps dark ink and drops white paper, with a tight box', () => {
    const src = img(200, 100, (x, y) => grey(inBar(x, y) ? 30 : 245));
    const out = removeBackground(src, 50);
    expect(alphaAt(out, 200, 100, 50)).toBe(255);
    expect(alphaAt(out, 200, 10, 10)).toBe(0);
    const b = out.box!;
    expect(b.x).toBeLessThanOrEqual(50);
    expect(b.y).toBeLessThanOrEqual(40);
    expect(b.x + b.w).toBeGreaterThanOrEqual(150);
    expect(b.y + b.h).toBeGreaterThanOrEqual(60);
    expect(b.x).toBeGreaterThanOrEqual(47);
    expect(b.x + b.w).toBeLessThanOrEqual(153);
  });

  it('handles warm indoor light without moving the slider', () => {
    const src = img(200, 100, (x, y) => grey(inBar(x, y) ? 60 : 185));
    const out = removeBackground(src, 50);
    expect(alphaAt(out, 200, 100, 50)).toBe(255);
    expect(alphaAt(out, 200, 10, 10)).toBe(0);
  });

  it('keeps more as sensitivity rises', () => {
    // Paper 240, a mid-grey block 140 at x 0–39, ink 30 at x 160–199.
    const src = img(200, 50, (x) => grey(x < 40 ? 140 : x >= 160 ? 30 : 240));
    expect(alphaAt(removeBackground(src, 100), 200, 20, 25)).toBeGreaterThanOrEqual(128);
    expect(alphaAt(removeBackground(src, 0), 200, 20, 25)).toBeLessThan(128);
  });

  it('finds nothing on a blank page', () => {
    expect(removeBackground(img(100, 100, () => grey(250)), 50).box).toBeNull();
  });

  it('keeps transparent pixels transparent and colors unchanged', () => {
    const src = img(100, 50, (x, y) => (x < 20 ? [10, 20, 200, 0] : inBar(x + 50, y) ? [20, 40, 160, 255] : grey(240)));
    const out = removeBackground(src, 50);
    expect(alphaAt(out, 100, 5, 5)).toBe(0);
    for (let i = 0; i < src.data.length; i += 4) {
      expect(out.data[i]).toBe(src.data[i]);
      expect(out.data[i + 1]).toBe(src.data[i + 1]);
      expect(out.data[i + 2]).toBe(src.data[i + 2]);
    }
  });
});
