import { extendEnds, isStraightStroke, selfIntersects, smoothStroke } from './stroke';
import type { Pt } from './types';

/** Deterministic pseudo-random wobble so tests are repeatable. */
function wobble(i: number, amp: number): number {
  return amp * Math.sin(i * 1.7) * Math.cos(i * 0.37);
}

function line(from: Pt, to: Pt, n: number, amp = 0): Pt[] {
  const out: Pt[] = [];
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const nx = -(to.y - from.y) / len;
  const ny = (to.x - from.x) / len;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = i === 0 || i === n ? 0 : wobble(i, amp);
    out.push({ x: from.x + (to.x - from.x) * t + nx * w, y: from.y + (to.y - from.y) * t + ny * w });
  }
  return out;
}

const lStroke: Pt[] = [...line({ x: 0, y: 200 }, { x: 150, y: 200 }, 50, 1.5), ...line({ x: 150, y: 200 }, { x: 150, y: 450 }, 80, 1.5).slice(1)];

const quarterCircle: Pt[] = Array.from({ length: 60 }, (_, i) => {
  const a = (Math.PI / 2) * (i / 59);
  return { x: 300 * Math.cos(a), y: 300 * Math.sin(a) };
});

describe('isStraightStroke (contract case 13)', () => {
  it('accepts a wobbly vertical line', () => {
    expect(isStraightStroke(line({ x: 245, y: 5 }, { x: 250, y: 435 }, 140, 5))).toBe('vertical');
  });

  it('accepts a slightly tilted horizontal line', () => {
    expect(isStraightStroke(line({ x: 0, y: 100 }, { x: 300, y: 118 }, 60, 1))).toBe('horizontal');
  });

  it('rejects a diagonal, an L and a curve', () => {
    expect(isStraightStroke(line({ x: 0, y: 0 }, { x: 300, y: 173 }, 60))).toBeNull(); // 30°
    expect(isStraightStroke(lStroke)).toBeNull();
    expect(isStraightStroke(quarterCircle)).toBeNull();
  });

  it('rejects a flat but bowed stroke', () => {
    const bowed = Array.from({ length: 50 }, (_, i) => ({ x: i * 8, y: 40 * Math.sin((Math.PI * i) / 49) }));
    expect(isStraightStroke(bowed)).toBeNull();
  });
});

describe('smoothStroke', () => {
  const maxDeviation = (pts: Pt[], y: number) => Math.max(...pts.map((p) => Math.abs(p.y - y)));

  it('reduces jitter on a noisy straight line', () => {
    const noisy = line({ x: 0, y: 100 }, { x: 400, y: 100 }, 200, 4);
    expect(maxDeviation(smoothStroke(noisy), 100)).toBeLessThan(maxDeviation(noisy, 100));
  });

  it('keeps an L corner close to where it was drawn', () => {
    const smooth = smoothStroke(lStroke);
    const nearest = Math.min(...smooth.map((p) => Math.hypot(p.x - 150, p.y - 200)));
    expect(nearest).toBeLessThan(6);
  });

  it('never moves the endpoints and returns fewer points', () => {
    const noisy = line({ x: 10, y: 20 }, { x: 410, y: 60 }, 300, 3);
    const smooth = smoothStroke(noisy);
    expect(smooth[0]).toEqual(noisy[0]);
    expect(smooth[smooth.length - 1]).toEqual(noisy[noisy.length - 1]);
    expect(smooth.length).toBeLessThan(noisy.length);
  });
});

describe('extendEnds', () => {
  it('lengthens both ends along their direction', () => {
    const ext = extendEnds([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], 16);
    expect(ext[0]!.x).toBeCloseTo(-16, 9);
    expect(ext[ext.length - 1]!.x).toBeCloseTo(116, 9);
    expect(ext[0]!.y).toBeCloseTo(0, 9);
  });

  it('follows the end direction of a bent stroke', () => {
    const ext = extendEnds(lStroke, 16);
    const end = ext[ext.length - 1]!;
    // The test stroke wobbles by 1.5 px, so the end direction is only approximately vertical.
    expect(Math.abs(end.x - 150)).toBeLessThan(2);
    expect(Math.abs(end.y - 466)).toBeLessThan(1);
  });
});

describe('selfIntersects', () => {
  it('detects a figure-8', () => {
    const eight: Pt[] = Array.from({ length: 80 }, (_, i) => {
      const t = (2 * Math.PI * i) / 79;
      return { x: 100 * Math.sin(t), y: 100 * Math.sin(t) * Math.cos(t) };
    });
    expect(selfIntersects(eight)).toBe(true);
  });

  it('accepts an L and a gentle curve', () => {
    expect(selfIntersects(lStroke)).toBe(false);
    expect(selfIntersects(quarterCircle)).toBe(false);
  });
});
