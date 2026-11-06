import { DEFAULT_SIGNATURE_PLACEMENT, type Signature } from './types';
import { normalizeStrokes, planSignature } from './signature';

describe('normalizeStrokes (T005)', () => {
  it('maps points into a padded 0–1 box', () => {
    const p = normalizeStrokes([[{ x: 10, y: 20 }, { x: 110, y: 70 }]], 4);
    // pad = 4/2 + 0.04·100 = 6 → box x 4–116 (112), y 14–76 (62)
    expect(p.aspect).toBeCloseTo(112 / 62, 9);
    expect(p.lineWidth).toBeCloseTo(4 / 112, 9);
    const [a, b] = p.strokes[0]!;
    expect(a!.x).toBeCloseTo(6 / 112, 9);
    expect(a!.y).toBeCloseTo(6 / 62, 9);
    expect(b!.x).toBeCloseTo(106 / 112, 9);
    expect(b!.y).toBeCloseTo(56 / 62, 9);
  });

  it('uses one box for all strokes', () => {
    const p = normalizeStrokes(
      [
        [{ x: 0, y: 0 }, { x: 50, y: 0 }],
        [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      ],
      2,
    );
    // pad = 1 + 4 = 5 → 110 × 60
    expect(p.aspect).toBeCloseTo(110 / 60, 9);
    expect(p.strokes[1]![1]!.x).toBeCloseTo(105 / 110, 9);
  });

  it('turns a single tap into a square dot', () => {
    const p = normalizeStrokes([[{ x: 50, y: 50 }]], 4);
    expect(p.aspect).toBeCloseTo(1, 9);
    expect(p.strokes[0]![0]).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('planSignature (T005)', () => {
  const sig: Signature = {
    ...DEFAULT_SIGNATURE_PLACEMENT,
    picture: { kind: 'image', assetId: 'a', aspect: 3 },
  };
  const canvas = { width: 1080, height: 1920 };

  it('places and sizes it from the canvas short side', () => {
    const p = planSignature(sig, canvas, { w: 1080, h: 1920 });
    expect(p.w).toBeCloseTo(378, 9);
    expect(p.h).toBeCloseTo(126, 9);
    expect(p.cx).toBeCloseTo(810, 9);
    expect(p.cy).toBeCloseTo(1632, 9);
    expect(p.angle).toBe(0);
  });

  it('scales with the surface', () => {
    const a = planSignature(sig, canvas, { w: 1080, h: 1920 });
    const b = planSignature(sig, canvas, { w: 540, h: 960 });
    for (const k of ['w', 'h', 'cx', 'cy'] as const) expect(b[k]).toBeCloseTo(a[k] / 2, 9);
  });

  it('converts rotation to radians', () => {
    expect(planSignature({ ...sig, rotation: 30 }, canvas, { w: 1080, h: 1920 }).angle).toBeCloseTo(Math.PI / 6, 9);
  });
});
