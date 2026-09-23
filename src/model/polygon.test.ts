import {
  pathChords,
  pointInPolygon,
  polygonArea,
  polygonBBox,
  roundPolygon,
  segmentIntersection,
  splitPolygonByChord,
} from './polygon';
import type { Pt } from './types';

const square: Pt[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
// An L: the unit square minus its top-right quarter.
const lShape: Pt[] = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0.5, y: 0.5 },
  { x: 1, y: 0.5 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe('polygonArea / polygonBBox / pointInPolygon', () => {
  it('measures convex and concave polygons', () => {
    expect(polygonArea(square)).toBeCloseTo(1, 12);
    expect(polygonArea(lShape)).toBeCloseTo(0.75, 12);
    expect(polygonBBox(lShape)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('tests containment with the even-odd rule', () => {
    expect(pointInPolygon({ x: 0.25, y: 0.25 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 0.75, y: 0.25 }, lShape)).toBe(false); // the missing quarter
    expect(pointInPolygon({ x: 0.75, y: 0.75 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 1.5, y: 0.5 }, square)).toBe(false);
  });
});

describe('segmentIntersection', () => {
  it('finds crossing segments', () => {
    const hit = segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 });
    expect(hit?.p.x).toBeCloseTo(0.5, 12);
    expect(hit?.t).toBeCloseTo(0.5, 12);
  });

  it('returns null for parallel or separate segments', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull();
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 })).toBeNull();
  });

  it('counts touching at an endpoint', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 })).not.toBeNull();
  });
});

describe('pathChords', () => {
  it('drops overshoot beyond the boundary', () => {
    const chords = pathChords([{ x: -0.5, y: 0.5 }, { x: 1.5, y: 0.5 }], square);
    expect(chords).toHaveLength(1);
    expect(chords[0]![0]!.x).toBeCloseTo(0, 12);
    expect(chords[0]![chords[0]!.length - 1]!.x).toBeCloseTo(1, 12);
  });

  it('drops a dangling end that never reaches the boundary', () => {
    // Starts inside the square, leaves through the right edge: no chord.
    expect(pathChords([{ x: 0.3, y: 0.5 }, { x: 1.5, y: 0.5 }], square)).toHaveLength(0);
  });

  it('keeps interior points of a bent path', () => {
    const chords = pathChords([{ x: -0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1.1 }], square);
    expect(chords).toHaveLength(1);
    expect(chords[0]).toHaveLength(3);
    expect(chords[0]![1]).toEqual({ x: 0.5, y: 0.5 });
  });

  it('gives one chord per pass for a wavy path', () => {
    // Enters from the left, exits through the top, comes back in through the top, exits right.
    const wavy = [
      { x: -0.1, y: 0.2 },
      { x: 0.3, y: -0.1 },
      { x: 0.7, y: -0.1 },
      { x: 1.1, y: 0.2 },
    ];
    expect(pathChords(wavy, square)).toHaveLength(2);
  });

  it('ignores the part outside a concave polygon', () => {
    // Crosses the L's arm, the missing quarter, then nothing else.
    const chords = pathChords([{ x: 0.25, y: -0.1 }, { x: 0.25, y: 1.1 }], lShape);
    expect(chords).toHaveLength(1);
    const horiz = pathChords([{ x: -0.1, y: 0.25 }, { x: 1.1, y: 0.25 }], lShape);
    expect(horiz).toHaveLength(1);
    expect(horiz[0]![horiz[0]!.length - 1]!.x).toBeCloseTo(0.5, 12);
  });
});

describe('splitPolygonByChord (contract case 10)', () => {
  const area = (p: Pt[]) => polygonArea(p);

  it('splits a square along a diagonal into two triangles', () => {
    const [p1, p2] = splitPolygonByChord(square, [{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(area(p1)).toBeCloseTo(0.5, 12);
    expect(area(p2)).toBeCloseTo(0.5, 12);
    expect(p1).toHaveLength(3);
    expect(p2).toHaveLength(3);
  });

  it('splits a square along an L-shaped chord into a rectangle and an L', () => {
    const chord = [
      { x: 0, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 1 },
    ];
    const [p1, p2] = splitPolygonByChord(square, chord);
    const areas = [area(p1), area(p2)].sort();
    expect(areas[0]).toBeCloseTo(0.25, 12);
    expect(areas[1]).toBeCloseTo(0.75, 12);
  });

  it('keeps the total area on a non-convex polygon', () => {
    const chord = [
      { x: 0.2, y: 0 },
      { x: 0.3, y: 0.7 },
      { x: 1, y: 0.8 },
    ];
    const [p1, p2] = splitPolygonByChord(lShape, chord);
    expect(area(p1) + area(p2)).toBeCloseTo(0.75, 12);
    expect(area(p1)).toBeGreaterThan(0);
    expect(area(p2)).toBeGreaterThan(0);
  });

  it('handles both chord ends on the same edge', () => {
    const chord = [
      { x: 0.2, y: 0 },
      { x: 0.5, y: 0.4 },
      { x: 0.8, y: 0 },
    ];
    const [p1, p2] = splitPolygonByChord(square, chord);
    const small = Math.min(area(p1), area(p2));
    expect(small).toBeCloseTo(0.12, 12); // triangle 0.6 × 0.4 / 2
    expect(area(p1) + area(p2)).toBeCloseTo(1, 12);
  });

  it('handles a chord ending exactly on a vertex', () => {
    const [p1, p2] = splitPolygonByChord(square, [{ x: 0.5, y: 0 }, { x: 1, y: 1 }]);
    expect(area(p1) + area(p2)).toBeCloseTo(1, 12);
    expect(Math.min(area(p1), area(p2))).toBeCloseTo(0.25, 12);
  });
});

describe('roundPolygon', () => {
  it('rounds sharp corners and keeps the shape inside the original', () => {
    const rounded = roundPolygon(square, 0.2);
    expect(rounded.length).toBeGreaterThan(square.length);
    expect(rounded).not.toContainEqual({ x: 0, y: 0 });
    expect(polygonArea(rounded)).toBeLessThan(1);
    expect(polygonArea(rounded)).toBeGreaterThan(0.95);
    for (const p of rounded) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('leaves gentle turns alone', () => {
    const arc: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = (Math.PI / 2) * (i / 20);
      arc.push({ x: Math.cos(a), y: Math.sin(a) });
    }
    arc.push({ x: 0, y: 0 });
    const rounded = roundPolygon(arc, 0.1);
    // The 4.5° steps along the arc are untouched; only the two sharp corners and the center change.
    for (let i = 1; i < 20; i++) expect(rounded).toContainEqual(arc[i]);
  });

  it('clamps the arc to half the shorter neighbouring edge', () => {
    const thin: Pt[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.1 },
      { x: 0, y: 0.1 },
    ];
    const rounded = roundPolygon(thin, 5);
    for (const p of rounded) {
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(0.1 + 1e-9);
    }
    // Corner cut distance ≤ 0.05 (half of the 0.1 edge), so the long edges keep most of their length.
    expect(rounded.some((p) => Math.abs(p.y) < 1e-9 && p.x > 0.9)).toBe(true);
  });

  it('returns the polygon unchanged for radius 0', () => {
    expect(roundPolygon(square, 0)).toEqual(square);
  });
});
