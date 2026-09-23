# Research: SplitFrame — Custom-Grid Photo Collage Editor

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-23

The brief already fixes the core technology choices. This document records those choices and settles the open design questions the spec leaves to planning. Every item uses the format **Decision / Rationale / Alternatives considered**.

---

## R1. App stack

- **Decision**: React 19 + TypeScript 5.x (with `strict` turned on), built with Vite (latest major). The app is a single-page static site with no backend. Package name `splitframe`.
- **Rationale**: This stack is required by the brief. Vite builds a plain static bundle that can be hosted anywhere, which fits FR-001 (no server).
- **Alternatives considered**: Next.js was rejected because it assumes a server and adds routing the app doesn't need. Svelte and Vue were rejected because the brief requires React.

## R2. Styling approach

- **Decision**: **CSS Modules**, plus one global `tokens.css` that holds CSS custom properties for colors, spacing and focus rings.
- **Rationale**: The brief lets us pick either CSS Modules or Tailwind. CSS Modules need no extra dependency and fit well with the heavily custom canvas UI (absolute positioning, transforms, cursors). A light/dark theme and a visible focus style are easy to add through tokens.
- **Alternatives considered**: Tailwind would give faster toolbar and panel styling, but its long positioning and transform class names make the editor surface harder to read. We stay with one approach, as the brief asks.

## R3. State and undo/redo

- **Decision**: One `useReducer` for the editor document, wrapped in a custom `useHistory` hook that keeps `{ past, present, future }`. The hook has three operations:
  - `commit(action)`: a normal change that becomes one undo step.
  - `preview(action)`: a transient change that updates `present` without adding history.
  - `endGesture()`: turns the gesture's transient changes into one history entry, whose "before" snapshot is the state when the gesture started.
  History is capped at 100 entries. UI-only state (hover, selected divider, current mode, whether Preview is open, toasts) lives outside the history.
- **Rationale**: This satisfies FR-036 and FR-037: one drag, pinch or slider move counts as one undo step. The document is small (tree + style + canvas), so storing full snapshots is cheap and simple. Splitting data into immutable documents and a UI store keeps undo from changing selection or mode.
- **Alternatives considered**: Zustand with `zundo` works, but adds dependencies that aren't needed at this size. The brief allows Zustand only "if it gets complex". Command/patch-based history (like Immer patches) uses less memory, but it's more complex and the gain doesn't matter for documents this small.

## R4. Layout model semantics

> Extended by R19 (freehand path splits, clarification 2026-09-24). Everything below still holds for straight splits.

- **Decision**: We keep the split tree from the brief, with these exact rules:
  - `direction` is the **direction of the divider line**. A `'horizontal'` divider splits a region into `a` = top and `b` = bottom. A `'vertical'` divider gives `a` = left and `b` = right.
  - `ratio` ∈ (0, 1) is the divider's position along the split axis, relative to the parent region (not the whole canvas).
  - `computeRects(tree)` → `Map<cellId, Rect>` in normalized **content-area** coordinates (0–1). This is the only way geometry is derived. Gap, padding and pixel conversion are applied afterwards by `layoutPixels()`.
- **Rationale**: Defining the direction by the line matches how the user draws (FR-009: a horizontal drag makes a horizontal line) and avoids the common "horizontal split = side by side" confusion. Positions relative to the parent keep sub-grids intact when the dividers above them move.
- **Alternatives considered**: A flat list of lines with rectangles computed by overlaying them was rejected. It can produce non-rectangular edge cases and makes merging ambiguous.

## R5. Drawing a line across several cells (FR-011)

> Applies to straight strokes (R21). Freehand strokes use R20.

- **Decision**: On release, a stroke becomes an **axis** (H or V), a snapped **coordinate** `c` (normalized over the whole content area), and a **span** [s0, s1] along the other axis, taken from the stroke's start and end clamped to the canvas. The target cells are every leaf cell whose rectangle crosses the span and strictly contains `c` on the split axis. Each target leaf is replaced by a `split` node with a local ratio of `(c − rect.start) / rect.size`. The existing photo stays in child `a`. All targets are checked against the minimum size **before** anything changes: if any target fails, the whole stroke is rejected (FR-013).
- **Rationale**: This matches "split each crossed cell at the same coordinate", leaves cells the stroke didn't cross unchanged, and makes the operation all-or-nothing so users never get a partly applied line.
- **Alternatives considered**: Splitting only the cell under the stroke's start point misses the multi-cell rule. Rebuilding the tree so it has one shared split node is impossible in general, because the crossed cells may belong to different branches.

## R6. Snapping (FR-012)

> Applies to straight strokes only. Freehand stroke ends attach to nearby edges by extension instead (R20).

- **Decision**: The candidate coordinates on the split axis are 1/3, 1/2 and 2/3 of the content area, plus every existing edge parallel to the line (all rect starts and ends from `computeRects`). We pick the closest candidate within `8 / previewPixelsAlongAxis` (8 screen pixels converted to normalized units). If none is in range, the raw coordinate is used. `snap()` returns `{ value, guide?: { kind: 'center' | 'third' | 'edge', value } }` so the UI can draw the guide. Divider drags use the same function, excluding the divider's own edge.
- **Rationale**: It's a pure function that's easy to unit-test, and working in screen pixels makes it feel the same at any preview zoom.
- **Alternatives considered**: A fixed normalized threshold was rejected: it feels too strong on phones and too weak on large screens.

## R7. Minimum cell size

- **Decision**: `minSizePx(axis) = max(0.05 × canvasSizeAlongAxis, 40)` in **export pixels**, converted to normalized content units per axis. It's enforced in three places:
  - **Drawing**: the stroke is rejected and a red preview line plus a "Too small" label is shown.
  - **Divider drag**: the ratio is clamped to the minimum size of the smallest cell next to the divider, along the whole subtree edge.
  - **Aspect-ratio change and Custom size**: min-size is not re-checked. Existing layouts are kept, since the values are relative. Cells may end up below the minimum. They stay valid, and `resizeDivider` then only allows moves that make the smaller side bigger (no-op otherwise).
- **Rationale**: This makes the spec's assumption concrete. Using export pixels means the rule doesn't change with the preview size.
- **Alternatives considered**: A minimum in screen pixels was rejected, because the same layout would become valid or invalid depending on the device.

## R8. Deleting a divider (FR-018, FR-019; Q1 = option A)

- **Decision**: `removeDivider(tree, splitId)` replaces the split node with **one leaf** that keeps the split node's id slot, with a new cell id. For the photo, we walk subtree `a` in reading order (depth-first, `a` before `b`) and keep the first photo found. If `a` has none, we walk `b` the same way. The function also returns `{ removedDividers, droppedImages }` so the UI can show a toast such as "Merged — 2 dividers and 1 photo removed (Undo)". It's a single `commit`, so one undo restores everything.
- **Rationale**: This follows the answer to Q1 in the spec exactly.
- **Alternatives considered**: The other Q1 options (B and C) were rejected by the user.

## R9. Photo framing model

- **Decision**: We refine the brief's `CellImage` fields:
  - `assetId` (a reference to an entry in the image store) replaces the raw `src`. See R10.
  - `zoom ≥ 1` is a multiplier on top of the cover scale for the current cell size.
  - `focusX`, `focusY` ∈ [0, 1] give the point of the image shown at the cell's center, in normalized image coordinates.

  The rendered transform is derived each time: `coverScale = max(cellW/imgW, cellH/imgH)`, `s = coverScale × zoom`, then the focus is clamped so the image always covers the cell. Reset sets `zoom = 1` and `focus = (0.5, 0.5)`.
- **Rationale**: Storing a focus point and a relative zoom instead of pixel offsets means framing survives cell resizes, splits, aspect changes and export scaling without any extra work (FR-025, FR-032, FR-042). A photo can never show empty space, because clamping always happens on the derived values.
- **Alternatives considered**: The brief's `scale/offsetX/offsetY` in pixels would need re-fitting after every geometry change and would drift between preview and export resolution.

## R10. Image loading, downscaling and memory (FR-026, FR-027)

- **Decision**: An **image store** that lives outside React state and the history (`Map<assetId, { url, bitmap?, w, h, refCount }>`). When a file is loaded:
  1. Check that `file.type` starts with `image/` and that it decodes. If not, show a toast error (spec edge case).
  2. Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`.
  3. If the longest side is greater than `maxExportSide`, which is `max(canvasW, canvasH)`, recalculated when the canvas changes and at least 2048, draw it onto a canvas at that size.
  4. Encode it once with `toBlob` as JPEG at quality 0.92, or as PNG when the source has transparency (PNG/WebP/GIF).
  5. Keep that small blob as a `URL.createObjectURL` for the editor's `<img>` and keep the `ImageBitmap` for rendering to canvas.

  The original `File` is not kept. **When memory is released**: an asset is released (`URL.revokeObjectURL`, `bitmap.close()`) as soon as no state in `past`, `present` or `future` refers to it. This is checked after every history change, and when entries fall off the 100-step cap.
- **Rationale**: Releasing a replaced photo *immediately* would break undo (FR-036). Releasing it once it can't be reached is the earliest safe moment and still keeps memory bounded. A camera photo shrunk to a 1920 px long side takes about 12 MB of decoded memory instead of about 190 MB at 48 MP, which is what makes phones safe. Because photos are scaled down to the canvas size at the time they're added, making the canvas much larger later can make those photos look softer until they're added again. This is accepted instead of keeping the original files, which would risk running out of memory on phones.
- **Alternatives considered**: Keeping the original files leads to out-of-memory crashes on iOS Safari. Revoking immediately as the brief says doesn't work with undo, so FR-027 in the spec was updated on 2026-09-23 to match this.

## R11. Editor rendering compared with Preview and Export (FR-042, SC-003, SC-010)

> Shaped cells add a clip path and a gap layer; see R22.

- **Decision**: There are two renderers that share **one geometry pipeline**:
  - **Editor**: DOM elements. Cells are absolutely positioned `<div role="button">` elements with `overflow: hidden` and `border-radius`, the image is an `<img>` with a CSS `transform`, and dividers are separate hit-target elements. This gives native focus, labels, cursors and cheap per-frame updates.
  - **Preview and Export**: one function `renderCollage(ctx, doc, images, sizePx)` on the 2D canvas. It uses `layoutPixels()` and the same `frameImage()` maths, and clips with `roundRect` for each cell. Preview calls it on a canvas sized to the screen at device pixel ratio. Export calls it on an offscreen canvas at full resolution. So **Preview is the export path**, just at a different size.

  To test it, `renderCollage` is split into `planDraw()` (pure: returns a list of fill, clip and drawImage operations with exact rectangles) and a small executor.
- **Rationale**: Drawing Preview with the export code guarantees SC-010 by construction. The DOM editor stays accessible (FR-040) and fast. Because `planDraw()` is pure, the brief's "export renders expected cell rectangles" test can run without a real canvas.
- **Alternatives considered**: A canvas-only editor would have perfect match but makes accessibility, cursors and hit-testing much harder. A DOM-snapshot library (html2canvas) for export was rejected: it's heavy, inaccurate and against the "no heavy canvas libs" rule.

## R12. Pointer handling (FR-039)

- **Decision**: Use Pointer Events everywhere. Call `setPointerCapture` on pointerdown and set `touch-action: none` on the canvas surface (page scrolling still works outside it). Keep a small gesture recognizer that tracks active pointers by id:
  - **One pointer**: draw, pan, or drag a divider, depending on the target and the mode.
  - **Two pointers on a filled cell**: pinch-zoom around the midpoint.
  - **Double tap**: two pointerups within 300 ms and 10 px of each other.

  The wheel uses a non-passive `wheel` listener with `preventDefault` inside cells, zooming by `exp(-deltaY × 0.0015)`. Movement under 6 px counts as a tap, not a stroke (spec edge case). In Draw mode a tap does nothing.
- **Rationale**: The brief requires Pointer Events. Handling gestures ourselves avoids pulling in a gesture library.
- **Alternatives considered**: `@use-gesture/react` is good, but isn't needed for the four gestures we have.

## R13. Export and file naming (FR-031 to FR-035)

- **Decision**: Use `OffscreenCanvas` with `convertToBlob` where it's available, otherwise a detached `<canvas>` with `toBlob`. The type is `image/png`, or `image/jpeg` with the quality slider at 10–100 (default 92), mapped to 0.1–1.0. The download uses an `<a download>` element with an object URL that is revoked right after the click. The filename is `splitframe-${yyyy}${MM}${dd}-${HH}${mm}.${ext}` in local time.

  Failures are handled explicitly. A `null` blob, a thrown error, or a canvas bigger than the platform can safely handle (area above 16,777,216 px, the iOS Safari limit, only checked on WebKit) shows an error toast suggesting a smaller size, and nothing is downloaded (FR-035).
- **Rationale**: Uses only standard browser APIs with no dependencies. The canvas-size limit is the common real-world way this fails on iPhones.
- **Alternatives considered**: The Web Share API for saving to the photo library could be a later improvement. The spec requires a download.

## R14. Style units

- **Decision**: Gap, radius and padding are stored in **reference pixels**, defined against a 1080 px **short side**. `exportScale = min(canvasW, canvasH) / 1080`, and `previewScale = previewShortSidePx / 1080`. The ranges are gap 0–40, radius 0–100 and padding 0–100. The defaults are gap 8, radius 0, padding 0 and color `#FFFFFF`. Gap and padding sliders are limited to values that still leave every cell at least 1 export pixel wide and tall (spec edge case).
- **Rationale**: Every preset has a 1080 short side, so styling looks the same across 9:16, 1:1, 4:5 and 16:9. A width-based reference would make 16:9 gaps 1.78× thicker than on the other presets. The spec's style assumption was updated on 2026-09-23 to match this.
- **Alternatives considered**: Storing values as a percentage of width was rejected, because the numbers look odd in the UI.

## R15. Gap geometry

> Still used for rectangular cells. Gaps along freehand lines are drawn as strokes; see R22.

- **Decision**: `layoutPixels()` works in three steps:
  1. The content area is the canvas inset by `padding`.
  2. Each normalized rect is mapped into the content area.
  3. Each side that is **inside the content area** (not on its boundary) is inset by `gap / 2`.

  So the gap between cells is exactly `gap`, and there is no extra gap at the outer edge beyond `padding`. Corner radius is clamped to `min(radius, w/2, h/2)` for each cell.
- **Rationale**: This matches common collage-app behavior. With padding 0, photos run to the edge of the canvas, like an Instagram Layout.
- **Alternatives considered**: Insetting every side by `gap/2` would add an unexpected half-gap border.

## R16. Presets over existing photos, and aspect-ratio changes

- **Decision**: Applying a preset collects the current photos in reading order (DFS, `a` before `b`), builds the preset tree, and assigns photos to the new cells in reading order. Extra photos are dropped and counted in a toast. It's one `commit`. Changing the aspect ratio only changes `canvas`, and framing re-derives automatically (R9).
- **Rationale**: This follows the spec's assumptions.

## R17. Testing

- **Decision**: Use **Vitest** with the `jsdom` environment for the few hook tests, and `node` for everything else.
  - Unit tests cover `layout.ts` (split, multi-cell split, all-or-nothing rejection, merge on delete including nested sub-grids and photo choice, resize clamping, `computeRects`), `presets.ts`, `snap.ts`, `frame.ts` (cover, clamp, zoom limits), `layoutPixels` (gap and padding), `planDraw` (the known-layout export rectangles test), `useHistory` (commit, preview, gesture coalescing, cap, asset reachability) and the filename formatter.
  - Manual checks are in [quickstart.md](./quickstart.md).
- **Rationale**: This is the brief's required test list, plus the new logic added by this plan. Everything that affects correctness is a pure function, so it can be tested without a browser.
- **Alternatives considered**: Playwright end-to-end tests are useful for the mobile gestures, but they're deferred. They can be added in delivery phase 7 if wanted.

## R18. Browser targets

- **Decision**: The latest two versions of Chrome, Edge, Firefox and Safari, including iOS and iPadOS Safari 16.4 or newer. These cover `createImageBitmap` orientation, `OffscreenCanvas` (with the fallback in R13) and `roundRect` (with a small fallback path). HEIC files work wherever the browser can decode them. iOS already converts HEIC to JPEG when picking from the photo library with `accept="image/*"`.
- **Rationale**: Matches the spec's "current evergreen browsers" assumption.

---

## Freehand drawing (clarification 2026-09-24)

The user wants to draw lines freely: diagonal corner cuts, L shapes and curves, with overshoot ignored. A stroke keeps its drawn shape, smoothed to remove jitter. Nearly straight horizontal or vertical strokes still become exact straight lines. The reference sketch (7 strokes → 8 cells) is the acceptance test (SC-011).

## R19. Path splits in the layout tree

- **Decision**: Add a second split node type next to the straight split:
  - `PathSplitNode { type: 'path'; id; path: Pt[]; a; b }`.
  - `path` is the dividing line inside its parent region, stored in coordinates **normalized to the parent region's bounding box** (0–1 on both axes). Its first and last points lie on the parent region's boundary.
  - `a` is always the **larger** of the two pieces and `b` the smaller. This means "the photo stays in `a`" gives FR-046 (photo in the larger piece), and the reading order visits the larger piece first.
  - Cell shapes are computed by walking the tree from the unit square. A straight split cuts a rectangle into two rectangles, as before. A path split cuts its parent polygon along the path into two polygons (R20).
  - Straight splits (`type: 'split'`) are only created in **rectangular** regions, meaning regions whose ancestors are all straight splits. A straight stroke over a shaped cell becomes a 2-point path split.
- **Rationale**: Keeping one tree means undo, delete-to-merge (R8), presets, photo operations and reading order all keep working. Storing paths relative to the parent's bounding box keeps them attached to the parent's edges when an ancestor straight divider is dragged or the aspect ratio changes. Both of those are independent x/y stretches, which map bounding boxes to bounding boxes. Tree nodes are only ever removed together with their whole subtree, so a parent's shape never changes in any other way.
- **Alternatives considered**:
  - A planar map of all strokes, with cells found as faces. This handles any drawing, but it loses the tree's cheap merge and undo, and it needs robust face tracing.
  - Polygon boolean libraries (`polygon-clipping`, Clipper). These are robust but add dependencies. A cell here is split by one open path at a time, which a small purpose-built routine handles.

## R20. From stroke to split (FR-009 to FR-011, FR-013)

- **Decision**: The pipeline runs on every pointer move (for the live preview) and once more on release:
  1. **Collect** pointer points in preview pixels, dropping points closer than 2 px to the last kept one.
  2. **Classify** the stroke (R21). If it's straight, use the existing axis path: `strokeToLine`, then `snap`, then `splitAt`.
  3. **Smooth** a freehand stroke:
     - Resample it at 3 px spacing.
     - Apply a moving average over 5 points, keeping both endpoints fixed.
     - Simplify with Ramer–Douglas–Peucker at ε = 0.6 px. This removes jitter but keeps the curve and the L corners, which become slightly rounded.
  4. **Extend** each end by 16 px along its end direction, averaged over the last 12 px, so a stroke that stops just short of an edge or line still reaches it.
  5. **Reject self-crossing** strokes: if any two non-adjacent segments intersect, return `{ error: 'self-crossing' }`.
  6. **Convert** the points to content-area coordinates (0–1).
  7. **Cut** with `splitByPath(tree, path, minArea, makeId)`. For every cell (in reading order):
     1. Intersect the path with the cell's boundary and sort the intersections by position along the path.
     2. For each consecutive pair of intersections, take the sub-path between them. If its midpoint is inside the cell, it's a **chord** that crosses the cell from edge to edge.
     3. Split the cell along each chord in turn. A second chord splits whichever piece contains it, so a wavy stroke can make more than two pieces.
     - Parts before the first intersection, after the last one, or outside the cell are ignored. That's how overshoot is trimmed.
  8. **Validate** all-or-nothing, as in R5. If any new piece has an area below the minimum (R23), return `{ error: 'too-small' }`. If no cell got a chord, return `{ error: 'no-target' }`.

  To split a polygon along a chord `c0…ck`, where `c0` and `ck` lie on boundary edges `i` and `j`:
  - Piece 1 is the chord followed by the boundary walked forward from `ck` to `c0`.
  - Piece 2 is the chord reversed followed by the boundary walked forward from `c0` to `ck`.
  - When both ends are on the same edge, they're ordered by their position along that edge. Points closer than 1e-9 are merged.
- **Rationale**: Every step is a pure function on point lists, so it can be unit-tested, including with the reference sketch. Trimming at consecutive intersections is exactly the rule the user asked for (overshoot ignored). Extension handles strokes that stop just short.
- **Alternatives considered**:
  - Extending the stroke to infinity and cutting everything. That would also cut cells the user only overshot into, like the left side in the sketch.
  - Catmull-Rom or Bézier fitting. It looks smoother, but it needs curve flattening before any geometry step anyway. A dense polyline is simpler and exact enough at display resolution.

## R21. Straight or freehand?

- **Decision**: A stroke is **straight** when both of these hold:
  - The angle between its first and last points is within **5°** of horizontal or vertical.
  - Every point lies within **max(4 px, 3% of the stroke length)** of the line between the endpoints.

  A straight stroke over rectangular cells uses the existing straight split (R5), with snapping (R6) and a draggable divider. If it crosses any shaped cell, the whole stroke is handled as a 2-point path at the exact snapped coordinate.

  Everything else is **freehand** and keeps its smoothed shape. That's the user's choice: "keep the hand-drawn curve".
- **Rationale**: The user's long vertical line wobbles by about ±5 px over about 430 px, so it comes out perfectly straight and snaps. Diagonals, L shapes and curves are nowhere near 5° of an axis, or they stray far from their chord, so they stay freehand.
- **Alternatives considered**: A manual "Straighten" toggle. The user didn't pick that option, and automatic detection keeps grids crisp without extra UI.

## R22. Rendering shaped cells, gaps and radius (FR-022, FR-029, FR-042)

- **Decision**:
  - **Geometry**: `layoutPixels` returns each cell's bounding box (`x, y, w, h`). Shaped cells also get `polygon`: the region in pixels, with corners rounded by `roundPolygon(poly, r)`. Rounding only applies at vertices that turn more than 30°, with each arc clamped to half of the shorter neighbouring edge, so smooth curves are left untouched.
  - **Editor**: a shaped cell is a div at its bounding box with `clip-path: polygon(…)` in local pixels. Browsers also clip hit-testing to that shape, so clicks, drops and focus only land on the cell under the pointer. Photos use the same `frameImage` against the bounding box, so they cover the whole shape.
  - **Gaps**: an SVG layer above the cells draws **every** divider segment (straight and path) as a stroke `gap` px wide in the background color, with round caps and joins. That gives an exact gap along curves. For rectangles the stroke covers exactly the gap/2 insets from R15, so both methods agree.
  - **Outlines**: the same layer draws the dashed empty-cell outline and the focus ring for shaped cells.
  - **Export and Preview**: `planDraw` emits `{op:'clip', path}` for shaped cells (the image goes into the bounding box) and, after all cells, one `{op:'stroke', points, width, color}` per divider.
  - **Radius**: rounded corners are exact for rectangles. For shaped cells they're approximate, because the gap strokes cover part of the rounding next to lines (FR-029 allows this).
- **Rationale**: This needs no polygon-offsetting library, it's exact for gaps along any curve, and the editor, Preview and export all follow the same geometry, so SC-003 and SC-010 still hold.
- **Alternatives considered**: Insetting each polygon by gap/2. That's exact for radius too, but insetting non-convex polygons robustly needs Clipper-class code (an extra dependency and a lot of edge cases).

## R23. Minimum size for shaped cells

- **Decision**: A shaped cell is valid when its area in export pixels is at least `s²`, where `s = max(0.05 × canvas short side, 40)`. Rectangular cells keep the width and height rule from R7. The check runs on every piece a stroke would create, and again whenever a straight divider drag stretches shaped cells. For a drag, the ratio is clamped by bisecting between the current and requested positions until every affected cell is valid.
- **Rationale**: Width and height don't mean much for triangles or curved shapes. Area is simple, testable, and blocks slivers that are too small to show a photo.

## R24. Dragging and removing dividers (FR-016 to FR-019)

- **Decision**:
  - **Straight dividers** stay draggable (T056), including the ones that have shaped cells inside them, which stretch with them (R19).
  - **Path dividers** are drawn as SVG paths with a wide transparent hit stroke (12 px, or 24 px for coarse pointers). Clicking or tapping selects one and shows the × handle at the path's midpoint. Delete, Backspace or × then removes it with `removeDivider`, which works on both node types (R8). Path dividers can't be dragged.
- **Rationale**: Reshaping a curve after it's drawn is out of scope (spec). Delete plus undo gives a quick way to redraw.

## R25. Reading order and presets with path splits

- **Decision**: Reading order stays depth-first with `a` before `b`, where `a` is the larger piece for path splits. `applyPreset` still collects photos in reading order and builds rectangular presets.
- **Rationale**: No new rules needed. Keyboard focus order and moving photos between presets stay predictable.
