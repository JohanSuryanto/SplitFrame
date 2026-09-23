// Shared assertions for model tests.
import { expect } from 'vitest';
import { pointInPolygon, polygonArea } from './polygon';
import type { NRect, Region } from './types';

/**
 * Region polygons cover [0,1]² exactly: areas sum to 1, and every point of a 50×50 grid
 * (offset so it never lands on a straight edge) is inside exactly one region.
 */
export function expectRegionTiling(regions: Map<string, Region>): void {
  const list = [...regions.values()];
  const area = list.reduce((s, r) => s + polygonArea(r.polygon), 0);
  expect(area).toBeCloseTo(1, 9);
  for (let i = 0; i < 50; i++) {
    for (let j = 0; j < 50; j++) {
      const p = { x: (i + 0.4913) / 50, y: (j + 0.5137) / 50 };
      const owners = list.filter((r) => pointInPolygon(p, r.polygon)).length;
      expect(owners, `point ${p.x.toFixed(3)},${p.y.toFixed(3)}`).toBe(1);
    }
  }
}

function intersects(a: NRect, b: NRect): boolean {
  const eps = 1e-9;
  return a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
}

export function expectTiling(rects: Map<string, NRect>): void {
  const list = [...rects.values()];
  const area = list.reduce((s, r) => s + r.w * r.h, 0);
  expect(area).toBeCloseTo(1, 9);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      expect(intersects(list[i]!, list[j]!)).toBe(false);
    }
  }
  for (const r of list) {
    expect(r.x).toBeGreaterThanOrEqual(-1e-9);
    expect(r.y).toBeGreaterThanOrEqual(-1e-9);
    expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9);
  }
}
