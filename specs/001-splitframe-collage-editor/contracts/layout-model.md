# Contract: Layout Model and Geometry (`src/model/*`)

These are pure, synchronous functions with no DOM access, so every one of them can be unit-tested. Every function returns a new tree and never changes its input. The types are defined in [data-model.md](../data-model.md).

```ts
type Axis = 'horizontal' | 'vertical';           // direction of the divider line
type NRect = { x: number; y: number; w: number; h: number }; // 0–1 content-area units
type MinSize = { x: number; y: number };         // normalized, from minSizeNorm()
```

## layout.ts

| Signature | Behavior |
|-----------|----------|
| `singleCell(): LayoutNode` | Returns a fresh tree with one cell. |
| `computeRects(tree): Map<string, NRect>` | Rectangles of all leaf cells. Together they cover [0,1]² exactly with no overlaps. |
| `dividers(tree): Divider[]` | One entry per split node, with `{ splitId, direction, coord, span }` in normalized content-area coordinates. |
| `splitAt(tree, axis, coord, span, min, makeId?: (targetCellId: string, role: 'split' \| 'b') => string): { tree } \| { error: 'too-small' \| 'no-target' }` | Splits every leaf whose rectangle crosses `span` and strictly contains `coord` on the split axis. If any target would break `min`, it returns an error and the tree is unchanged. The photo stays in child `a`. Child `a` keeps the target cell's id. `makeId` (default `newId()`) supplies the two new ids for each target: the split node (`role: 'split'`) and the new empty cell (`role: 'b'`). Repeated calls during one stroke therefore give the same ids. |
| `resizeDivider(tree, splitId, coord, min): LayoutNode` | Sets the ratio so the divider sits at the global `coord`, clamped so that every leaf on both sides still meets `min`. If no position satisfies `min` on both sides (possible after a canvas change), the divider stays where it is (no-op), but it may still move in any direction that makes the smaller side bigger. |
| `removeDivider(tree, splitId): { tree, removedDividers: number, droppedImages: number, keptAssetId?: string }` | Replaces the split subtree with one cell. The kept photo is the first in reading order from `a`, else from `b`. The counts cover the whole subtree, including the divider itself. |
| `clear(tree): LayoutNode` | Returns one cell holding the first photo in reading order. |
| `cellsInReadingOrder(tree): CellNode[]` | Depth-first, `a` before `b`. |
| `setCellImage(tree, cellId, image \| undefined)`, `swapCellImages(tree, idA, idB)`, `setFraming(tree, cellId, patch)` | Photo operations on single cells. `swapCellImages` resets both photos' framing. |
| `referencedAssets(tree): Set<string>` | Used to decide when an image can be released. |
| `computeRegions(tree): Map<string, Region>` | `Region = { polygon: Pt[]; bbox: NRect; rect: boolean }` for every leaf, in content-area coordinates. Polygons of all leaves tile [0,1]² exactly. |
| `pathDividers(tree): { splitId, points: Pt[] }[]` | Each path split's line in content-area coordinates. |
| `splitByPath(tree, path: Pt[], minArea: number, makeId?): { tree } \| { error: 'too-small' \| 'no-target' \| 'self-crossing' }` | `path` is the smoothed, extended stroke in content-area coordinates. Every cell gets one split per chord (sub-path between consecutive boundary crossings whose midpoint is inside the cell). Overshoot is ignored. All-or-nothing on `minArea`. The new node's `a` is the larger piece and keeps the target cell's id and photo; `makeId(targetCellId, role)` supplies the other ids (roles `'split'`, `'b'`, and `'split:n'`/`'b:n'` for the n-th extra chord in the same cell). |

## presets.ts

| Signature | Behavior |
|-----------|----------|
| `buildPreset(kind: 'cols2' \| 'cols3' \| 'cols4' \| 'rows2' \| 'rows3' \| 'grid2x2'): LayoutNode` | Equal cells. For N columns, the ratios are chained as 1/N, then 1/(N−1) of the rest, and so on. |
| `applyPreset(tree, kind): { tree, droppedImages: number }` | Moves photos over in reading order. |

## snap.ts

| Signature | Behavior |
|-----------|----------|
| `snap(raw, candidates: SnapCandidate[], thresholdNorm): { value, guide?: SnapCandidate }` | Picks the nearest candidate within the threshold. If two are equally close, center wins over third, and third wins over edge. |
| `snapCandidates(tree, axis, excludeSplitId?): SnapCandidate[]` | Returns center, thirds, and every parallel edge from `computeRects`. |
| `strokeToLine(points: {x,y}[], area): { axis, coord, span } \| null` | The main drag direction picks the axis. Returns `null` for strokes shorter than 6 screen px. |

## stroke.ts (freehand, research R20–R21)

| Signature | Behavior |
|-----------|----------|
| `isStraightStroke(points): Direction \| null` | Returns the axis when the endpoints are within 5° of it and every point is within `max(4, 0.03·length)` px of the endpoint line; otherwise `null`. |
| `smoothStroke(points): Pt[]` | Resample at 3 px, moving average over 5 points (endpoints fixed), then Ramer–Douglas–Peucker at ε = 0.6 px. |
| `extendEnds(points, px = 16): Pt[]` | Extends both ends along their end direction (averaged over the last 12 px). |
| `selfIntersects(points): boolean` | True when any two non-adjacent segments cross. |

## polygon.ts (pure geometry)

| Signature | Behavior |
|-----------|----------|
| `polygonArea(poly)`, `polygonBBox(poly)`, `pointInPolygon(p, poly)` | Signed/absolute area, bounding box, even-odd containment. |
| `segmentIntersection(a, b, c, d)` | Intersection point and parameters of two segments, or `null`. |
| `pathChords(path, poly): Pt[][]` | Sub-paths of `path` between consecutive boundary crossings whose midpoint is inside `poly`. |
| `splitPolygonByChord(poly, chord): [Pt[], Pt[]]` | The two pieces; together they have the area of `poly`. Works for non-convex polygons. |
| `roundPolygon(poly, r): Pt[]` | Rounds vertices that turn more than 30°, arc radius clamped to half the shorter neighbouring edge. |

## geometry.ts, frame.ts, render/planDraw.ts

| Signature | Behavior |
|-----------|----------|
| `minSizeNorm(canvas, style): MinSize` | `max(0.05·dim, 40)` in export px, divided by the content-area size. |
| `layoutPixels(doc, sizePx): PxCell[]` | Applies padding, then a `gap/2` inset on inner edges only, then clamps the radius to `min(r, w/2, h/2)`. Style is scaled by `min(sizePx.w, sizePx.h) / 1080`. |
| `frameImage(cell: PxCell, asset: {width,height}, img: CellImage): { sx, sy, sw, sh }` | Source crop that exactly matches the cell's aspect ratio. The focus is clamped so the crop stays inside the image. |
| `panBy(img, dxPx, dyPx, cell, asset): CellImage` / `zoomAt(img, factor, pointPx, cell, asset): CellImage` | Framing updates for gestures. The zoom is clamped to [1, 8]. |
| `planDraw(doc, assets, sizePx): DrawOp[]` | `[{op:'fill', color}, …per cell: {op:'clip', rect, r, path?} + ({op:'image', assetId, src, dest} \| nothing), …per divider: {op:'stroke', points, width, color}]`. Shaped cells clip to `path` and the image fills their bounding box. Empty cells show the background fill. |

## Required test cases (from the brief and the spec)

1. `computeRects` of every preset covers the whole area with no overlaps.
2. A single split, and a stroke across 3 cells, split each cell at the same coordinate while cells outside the stroke are unchanged.
3. A split that would go below the minimum returns `too-small` and the tree is unchanged, even when only one of several targets fails.
4. Resize is clamped by the smallest leaf in a nested subtree.
5. Removing a divider between two photo cells keeps the photo from `a`, with `droppedImages = 1`. Removing a divider whose sides are nested sub-grids gives one cell and correct counts. When `a` has no photos, the first photo from `b` is kept.
6. Snapping picks center, thirds or edge within the threshold, and returns nothing outside it.
7. `planDraw` for a 2-column 1080×1920 layout with gap 20 and padding 0 gives the rectangles `{0,0,530,1920}` and `{550,0,530,1920}`.
8. `frameImage` always gives a crop inside the image bounds, with the same aspect ratio as the cell.
9. **Reference sketch (SC-011)**: applying the 7 strokes of the clarification sketch in order gives exactly 8 cells whose polygons tile [0,1]² (areas sum to 1, no overlaps by point sampling). The horizontal stroke's overshoot leaves the left side unchanged.
10. `splitPolygonByChord` on a rectangle with a diagonal gives two triangles; with an L-shaped chord gives a rectangle and an L-shaped piece; on a non-convex polygon the areas still sum to the original.
11. `splitByPath` rejects self-crossing paths, paths that reach no boundary, and pieces below `minArea`, leaving the tree unchanged; the photo ends up in the larger piece.
12. Path splits keep touching their parent's edges after an ancestor straight divider is resized (regions still tile).
13. `isStraightStroke`: a ±5 px wobbly vertical over 430 px is `'vertical'`; a diagonal, an L and a curve are `null`.
