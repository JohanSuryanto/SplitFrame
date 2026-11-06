import { DEFAULT_WATERMARK, type Watermark } from '../model/types';
import { planTextMark } from './textMark';

const measure = (text: string, px: number) => text.length * px * 0.5;
const mark = (p: Partial<Watermark>): Watermark => ({ ...DEFAULT_WATERMARK, text: 'For verification only', ...p });
const canvas = { width: 1080, height: 1920 };
const full = { w: 1080, h: 1920 };

describe('planTextMark (T006)', () => {
  it('draws nothing for empty or blank text', () => {
    expect(planTextMark(mark({ text: '' }), canvas, full, measure)).toBeNull();
    expect(planTextMark(mark({ text: '   ' }), canvas, full, measure)).toBeNull();
  });

  it('places a single mark at its fractional position', () => {
    const op = planTextMark(mark({ x: 0.25, y: 0.75 }), canvas, full, measure)!;
    expect(op.points).toEqual([{ x: 270, y: 1440 }]);
    expect(op.fontPx).toBeCloseTo(0.06 * 1080, 9);
  });

  it('scales with the surface (Preview vs export)', () => {
    const a = planTextMark(mark({ x: 0.3, y: 0.6 }), canvas, full, measure)!;
    const b = planTextMark(mark({ x: 0.3, y: 0.6 }), canvas, { w: 540, h: 960 }, measure)!;
    expect(b.fontPx).toBeCloseTo(a.fontPx / 2, 9);
    const [pa] = a.points;
    const [pb] = b.points;
    expect(pb!.x).toBeCloseTo(pa!.x / 2, 9);
    expect(pb!.y).toBeCloseTo(pa!.y / 2, 9);
  });

  it('passes angle and opacity through', () => {
    const op = planTextMark(mark({ rotation: 45, opacity: 0.7, color: '#E53935' }), canvas, full, measure)!;
    expect(op.angle).toBeCloseTo(Math.PI / 4, 9);
    expect(op.alpha).toBe(0.7);
    expect(op.color).toBe('#E53935');
  });

  it('Repeat puts a whole copy in every quarter of the canvas', () => {
    const m = mark({ text: 'Bank X only', repeat: true, rotation: -30 });
    const op = planTextMark(m, canvas, full, measure)!;
    const tw = measure(m.text, op.fontPx);
    // Half the rotated bounding box of one copy.
    const c = Math.abs(Math.cos(op.angle));
    const s = Math.abs(Math.sin(op.angle));
    const hx = (tw * c + op.fontPx * s) / 2;
    const hy = (tw * s + op.fontPx * c) / 2;
    const W = 1080;
    const H = 1920;
    for (const [qx, qy] of [[0, 0], [W / 2, 0], [0, H / 2], [W / 2, H / 2]] as const) {
      const inside = op.points.some(
        (p) => p.x - hx >= qx && p.x + hx <= qx + W / 2 && p.y - hy >= qy && p.y + hy <= qy + H / 2,
      );
      expect(inside).toBe(true);
    }
  });

  it('Repeat pattern moves with x', () => {
    const a = planTextMark(mark({ repeat: true, rotation: -30, x: 0.5 }), canvas, full, measure)!;
    const b = planTextMark(mark({ repeat: true, rotation: -30, x: 0.6 }), canvas, full, measure)!;
    const key = (p: { x: number; y: number }) => `${Math.round(p.x)},${Math.round(p.y)}`;
    const shifted = new Set(b.points.map(key));
    // Every point of a that, shifted by 108 px, is still in range shows up in b.
    const moved = a.points.map((p) => ({ x: p.x + 108, y: p.y }));
    const hits = moved.filter((p) => shifted.has(key(p))).length;
    expect(hits).toBeGreaterThan(a.points.length * 0.8);
  });

  it('keeps the copy count reasonable at the smallest size on a huge canvas', () => {
    const op = planTextMark(mark({ repeat: true, size: 0.02 }), { width: 8000, height: 8000 }, { w: 8000, h: 8000 }, measure)!;
    expect(op.points.length).toBeLessThan(400);
  });
});
