import { effectiveZoom, frameImage, panBy, placeImage, resetFraming, zoomAt, zoomMin, zoomTo } from './frame';
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

  // Feature 004 replaced "never below cover" (base FR-023) with "down to fit" (FR-314).
  it('clamps zoom to [fit, 8]', () => {
    expect(zoomAt(img(), 100, { x: 100, y: 200 }, c, asset).zoom).toBe(8);
    expect(zoomAt(img({ zoom: 2 }), 0.01, { x: 100, y: 200 }, c, asset).zoom).toBeCloseTo(zoomMin(c, asset), 12);
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

describe('below fill (feature 004, T002)', () => {
  const tall = cell(100, 300);
  const landscape = { width: 400, height: 200 };

  it('zoomMin is the zoom at which the whole photo fits', () => {
    expect(zoomMin(tall, landscape)).toBeCloseTo(100 / 400 / (300 / 200), 12);
    expect(zoomMin(cell(200, 100), { width: 400, height: 200 })).toBe(1);
  });

  it('at zoom ≥ 1 the photo covers the cell and src matches frameImage', () => {
    for (const f of [{}, { zoom: 2, focusX: 0.2 }, { zoom: 5, focusX: 0.9, focusY: 0.1 }]) {
      const im = img(f);
      const p = placeImage(tall, landscape, im);
      expect(p.dest).toEqual({ x: 0, y: 0, w: 100, h: 300 });
      expect(p.src).toEqual(frameImage(tall, landscape, im));
    }
  });

  it('at fit the whole photo shows, centered, with gaps on the short axis', () => {
    const p = placeImage(tall, landscape, img({ zoom: zoomMin(tall, landscape) }));
    expect(p.src.sx).toBeCloseTo(0, 9);
    expect(p.src.sy).toBeCloseTo(0, 9);
    expect(p.src.sw).toBeCloseTo(400, 9);
    expect(p.src.sh).toBeCloseTo(200, 9);
    expect(p.dest.w).toBeCloseTo(100, 9);
    expect(p.dest.h).toBeCloseTo(50, 9);
    expect(p.dest.y).toBeCloseTo(125, 9);
  });

  it('panning below fill stays inside on the short axis and covers on the long one', () => {
    let im = img({ zoom: 0.5 });
    for (const [dx, dy] of [[0, 1000], [0, -1000], [1000, 0], [-1000, 0], [37, -12]]) {
      im = panBy(im, dx!, dy!, tall, landscape);
      const p = placeImage(tall, landscape, im);
      const Dw = landscape.width * p.scale;
      const Dh = landscape.height * p.scale;
      expect(Dh).toBeLessThan(300);
      expect(p.y0).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y0 + Dh).toBeLessThanOrEqual(300 + 1e-9);
      if (Dw >= 100) {
        expect(p.x0).toBeLessThanOrEqual(1e-9);
        expect(p.x0 + Dw).toBeGreaterThanOrEqual(100 - 1e-9);
      }
    }
  });

  it('snaps to exactly fill when close', () => {
    const center = { x: 50, y: 150 };
    expect(zoomAt(img(), 0.97, center, tall, landscape).zoom).toBe(1);
    expect(zoomAt(img(), 1.04, center, tall, landscape).zoom).toBe(1);
    expect(zoomAt(img(), 0.9, center, tall, landscape).zoom).toBeCloseTo(0.9, 12);
  });

  it('never leaves [fit, ZOOM_MAX]', () => {
    const center = { x: 50, y: 150 };
    expect(zoomAt(img(), 0.0001, center, tall, landscape).zoom).toBeCloseTo(zoomMin(tall, landscape), 12);
    expect(zoomAt(img(), 1e6, center, tall, landscape).zoom).toBe(8);
  });

  it('zoomTo sets an absolute zoom around the center', () => {
    const im = zoomTo(img(), 0.5, tall, landscape);
    expect(im.zoom).toBeCloseTo(0.5, 12);
    expect(im.focusX).toBeCloseTo(0.5, 12);
    expect(im.focusY).toBeCloseTo(0.5, 12);
  });

  it('shows a stored zoom below the new fit at fit', () => {
    expect(effectiveZoom(tall, landscape, 0.01)).toBeCloseTo(zoomMin(tall, landscape), 12);
  });
});
