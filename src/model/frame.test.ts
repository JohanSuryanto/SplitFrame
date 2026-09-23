import { frameImage, panBy, resetFraming, zoomAt } from './frame';
import type { CellImage, PxCell } from './types';

const cell = (w: number, h: number): PxCell => ({ cellId: 'c', x: 0, y: 0, w, h, r: 0 });
const img = (extra: Partial<CellImage> = {}): CellImage => ({ assetId: 'a', ...resetFraming(), ...extra });

describe('frameImage (cover)', () => {
  const cells = [cell(100, 100), cell(300, 100), cell(100, 400), cell(1, 999)];
  const assets = [
    { width: 4000, height: 3000 },
    { width: 1000, height: 3000 },
    { width: 500, height: 500 },
    { width: 37, height: 5000 },
  ];
  const framings: Partial<CellImage>[] = [
    {},
    { zoom: 3 },
    { focusX: 0, focusY: 0 },
    { focusX: 1, focusY: 1 },
    { zoom: 8, focusX: 0.9, focusY: 0.2 },
    { focusX: -5, focusY: 7 }, // out of range focus is clamped, not rejected
  ];

  for (const c of cells) {
    for (const a of assets) {
      for (const f of framings) {
        it(`crops inside the image with the cell's aspect (${c.w}×${c.h}, ${a.width}×${a.height}, ${JSON.stringify(f)})`, () => {
          const s = frameImage(c, a, img(f));
          expect(s.sw / s.sh).toBeCloseTo(c.w / c.h, 6);
          expect(s.sx).toBeGreaterThanOrEqual(-1e-9);
          expect(s.sy).toBeGreaterThanOrEqual(-1e-9);
          expect(s.sx + s.sw).toBeLessThanOrEqual(a.width + 1e-6);
          expect(s.sy + s.sh).toBeLessThanOrEqual(a.height + 1e-6);
        });
      }
    }
  }

  it('centers the crop on the longer axis at the default framing', () => {
    const s = frameImage(cell(100, 100), { width: 4000, height: 3000 }, img());
    expect(s).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 });
  });

  it('zoom shrinks the crop around the focus', () => {
    const s = frameImage(cell(100, 100), { width: 4000, height: 3000 }, img({ zoom: 2 }));
    expect(s).toEqual({ sx: 1250, sy: 750, sw: 1500, sh: 1500 });
  });

  it('clamps an unreachable focus to the image edge', () => {
    const s = frameImage(cell(100, 100), { width: 4000, height: 3000 }, img({ focusX: 0 }));
    expect(s.sx).toBe(0);
  });
});

describe('panBy / zoomAt (T037)', () => {
  const c = cell(200, 400);
  const asset = { width: 4000, height: 3000 };

  it('keeps the crop inside the image after any pan', () => {
    let im = img();
    for (const [dx, dy] of [[500, 0], [-3000, 40], [0, -9999], [9999, 9999]]) {
      im = panBy(im, dx!, dy!, c, asset);
      const s = frameImage(c, asset, im);
      expect(s.sx).toBeGreaterThanOrEqual(-1e-9);
      expect(s.sy).toBeGreaterThanOrEqual(-1e-9);
      expect(s.sx + s.sw).toBeLessThanOrEqual(asset.width + 1e-6);
      expect(s.sy + s.sh).toBeLessThanOrEqual(asset.height + 1e-6);
    }
  });

  it('moves the photo with the pointer', () => {
    const before = frameImage(c, asset, img());
    const after = frameImage(c, asset, panBy(img(), 20, 0, c, asset));
    // Dragging right by 20 px shows more of the left of the photo.
    const scale = c.w / before.sw;
    expect(before.sx - after.sx).toBeCloseTo(20 / scale, 6);
  });

  it('stores a clamped focus, so reversing a pan at the edge responds at once', () => {
    const atEdge = panBy(img(), 100000, 0, c, asset);
    const back = panBy(atEdge, -10, 0, c, asset);
    expect(frameImage(c, asset, back).sx).toBeGreaterThan(frameImage(c, asset, atEdge).sx);
  });

  it('clamps zoom to [1, 8]', () => {
    expect(zoomAt(img(), 100, { x: 100, y: 200 }, c, asset).zoom).toBe(8);
    expect(zoomAt(img({ zoom: 2 }), 0.01, { x: 100, y: 200 }, c, asset).zoom).toBe(1);
  });

  it('keeps the image point under the pointer fixed when not clamped', () => {
    const start = img({ zoom: 2 });
    const p = { x: 80, y: 250 };
    const imagePointAt = (im: CellImage) => {
      const s = frameImage(c, asset, im);
      const k = c.w / s.sw;
      return { x: s.sx + p.x / k, y: s.sy + p.y / k };
    };
    const a = imagePointAt(start);
    const b = imagePointAt(zoomAt(start, 1.3, p, c, asset));
    const k = c.w / frameImage(c, asset, start).sw;
    expect(Math.abs(a.x - b.x) * k).toBeLessThan(0.5);
    expect(Math.abs(a.y - b.y) * k).toBeLessThan(0.5);
  });
});
