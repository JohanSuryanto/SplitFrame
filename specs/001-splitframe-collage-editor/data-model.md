# Data Model: SplitFrame

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

All state lives in memory. Nothing is saved between sessions (FR-002). State is split into three groups:

- **Document**: undoable. It's stored in history snapshots.
- **Image store**: outside history, with reference counting.
- **UI state**: not undoable.

## 1. Document (undoable)

```ts
type Doc = {
  canvas: CanvasSpec;
  layout: LayoutNode;
  style: Style;
};
```

### CanvasSpec

| Field | Type | Rules |
|-------|------|-------|
| `preset` | `'9:16' \| '1:1' \| '4:5' \| '16:9' \| 'custom'` | The default is `'9:16'`. |
| `width` | integer px | Presets: 1080/1080/1080/1920. Custom: 100–8000. |
| `height` | integer px | Presets: 1920/1080/1350/1080. Custom: 100–8000. |

- Invalid custom input is rejected and the previous values are kept.
- Changing the canvas doesn't touch `layout`. Framing is re-derived ([research R9](./research.md)).

### LayoutNode (split tree)

```ts
type LayoutNode = CellNode | SplitNode | PathSplitNode;

type CellNode = { type: 'cell'; id: string; image?: CellImage };

type SplitNode = {
  type: 'split'; id: string;
  direction: 'horizontal' | 'vertical'; // direction of the DIVIDER line
  ratio: number;                        // 0 < ratio < 1, relative to parent region
  a: LayoutNode;                        // top (horizontal) or left (vertical)
  b: LayoutNode;                        // bottom (horizontal) or right (vertical)
};

type Pt = { x: number; y: number };

// Freehand split (research R19). Only the path is stored; shapes are derived.
type PathSplitNode = {
  type: 'path'; id: string;
  path: Pt[];     // ≥ 2 points, normalized to the PARENT region's bounding box (0–1);
                  // first and last points lie on the parent region's boundary
  aFirst: boolean; // whether `a` is the first piece of splitPolygonByChord(parent, path); keeps a/b stable
  a: LayoutNode;  // the LARGER piece (keeps the photo, FR-046)
  b: LayoutNode;  // the smaller piece
};
```

**Invariants**:

- Every `id` in the tree is unique.
- The minimum cell size is enforced when splitting and resizing. A canvas change can leave existing cells below it. They stay valid and are never auto-changed.
- The tree always has at least one cell. The initial tree, and the result of Clear, is one `CellNode`.
- A photo sits only on a `CellNode`, and each `CellNode` holds at most one photo.
- Nothing about geometry is stored except `ratio` and `path`. Cell shapes are always computed from the tree.
- A straight `SplitNode` only appears in a rectangular region (all ancestors are straight splits). Straight strokes over shaped cells become 2-point `PathSplitNode`s.
- A `PathSplitNode`'s path never crosses itself and runs from boundary to boundary of its parent region.

### CellImage (framing of one photo in one cell)

| Field | Type | Rules |
|-------|------|-------|
| `assetId` | string | Must exist in the image store. |
| `zoom` | number | ≥ 1, where 1 means the photo just covers the cell. The upper limit is 8. |
| `focusX` | number | 0–1. The image point shown at the cell's center, clamped when the frame is derived. |
| `focusY` | number | 0–1. Same as `focusX`, on the other axis. |

Reset sets `zoom = 1` and `focusX = focusY = 0.5`. This is a refinement of the brief's `scale/offsetX/offsetY` ([research R9](./research.md)).

### Style

Values are in reference pixels, where the canvas short side equals 1080 ([research R14](./research.md)).

| Field | Type | Range | Default |
|-------|------|-------|---------|
| `gap` | number | 0–40 | 8 |
| `color` | CSS hex `#RRGGBB` | — | `#FFFFFF` |
| `radius` | number | 0–100 | 0 |
| `padding` | number | 0–100 | 0 |

Gap and padding are also limited so that every cell stays at least 1 export pixel wide and tall.

## 2. Image store (not undoable, reference-counted)

```ts
type ImageAsset = {
  id: string;
  url: string;          // object URL of the downscaled blob (editor <img>)
  bitmap: ImageBitmap;  // decoded, orientation-corrected (Preview/Export)
  width: number; height: number; // after downscale
  downscaledTo?: number; // the long-side limit used, set only if the photo was actually scaled down
};
```

- **Created** when a file is picked or dropped, after it's checked and scaled down to a long side of at most `max(canvasW, canvasH, 2048)`.
- **Released** (`revokeObjectURL` and `bitmap.close()`) when no `Doc` in `past`, `present` or `future` refers to its `assetId` any more. This is checked after every history operation and cap trim ([research R10](./research.md)).

## 3. History

```ts
type History = {
  past: Doc[];        // capped at 100
  present: Doc;
  future: Doc[];
  gestureBase?: Doc;  // set while a transient gesture is in progress
};
```

| Operation | Effect |
|-----------|--------|
| `commit(action)` | Push `present` to `past`, apply the action, clear `future`. |
| `preview(action)` | If there's no `gestureBase`, set it to `present`. Then apply the action to `present` without pushing. |
| `endGesture()` | If `present` differs from `gestureBase`, push `gestureBase` to `past` and clear `future`. Clear `gestureBase`. |
| `cancelGesture()` | Set `present` back to `gestureBase` (used by Escape during a drag, or by an invalid stroke). |
| `undo()` / `redo()` | Standard. Not allowed while a gesture is in progress. |

## 4. UI state (not undoable)

| Field | Type | Notes |
|-------|------|-------|
| `mode` | `'arrange' \| 'draw'` | Custom mode means `draw`. |
| `selectedDividerId` | string? | Pressing Delete or Backspace removes it. |
| `focusedCellId` | string? | Keyboard focus. |
| `stroke` | `{ axis, coord, span, snapGuide?, invalid: boolean }?` | The live drawing preview (FR-010, FR-013, FR-045). |
| `previewOpen` | boolean | Preview dialog (User Story 5). |
| `exportSettings` | `{ format: 'png' \| 'jpg'; quality: 10–100 }` | The default is PNG, quality 92. |
| `toasts` | `Toast[]` | Merge notices, load errors, export errors, and the Preview shortcut (FR-044). |

## 5. Derived values (pure functions, never stored)

| Function | Input → Output | Used for |
|----------|----------------|----------|
| `computeRegions(layout)` | → `Map<cellId, { polygon: Pt[]; bbox: NRect; rect: boolean }>` in content-area coordinates (0–1) | Everything |
| `computeRects(layout)` | → `Map<cellId, NRect>`: the bounding box of each cell (equal to the cell for rectangles) | Straight splits, snapping, framing |
| `dividers(layout)` | → `{ splitId, direction, coord, span: [s0, s1] }[]` for straight splits, in normalized coordinates | Straight divider hit targets and the × handle |
| `pathDividers(layout)` | → `{ splitId, points: Pt[] }[]` for path splits, in content-area coordinates | Path divider hit targets, gap strokes |
| `minSizeNorm(canvas)` | → `{ x, y }`, the normalized minimum cell size: `max(0.05·size, 40px) / contentSize` | Split and resize validation |
| `minAreaNorm(canvas, style)` | → the minimum shaped-cell area as a fraction of the content area: `s² / (contentW·contentH)`, `s = max(0.05·shortSide, 40px)` | Freehand split validation (R23) |
| `layoutPixels(doc, sizePx)` | → `{ cellId, x, y, w, h, r, polygon? }[]`: bounding box with padding, gap/2 inner insets (rectangles) and a clamped radius; `polygon` (px, rounded) for shaped cells | Editor, Preview, Export |
| `frameImage(cellPx, asset, cellImage)` | → `{ sx, sy, sw, sh }` source rectangle (or a CSS transform), always covering the cell | Editor, Preview, Export |
| `planDraw(doc, assets, sizePx)` | → `DrawOp[]` (background fill, per-cell clip, drawImage) | Preview, Export, and tests |

## 6. State transitions (layout)

These are all pure `LayoutNode → LayoutNode` functions in `src/model/layout.ts`. See [contracts/layout-model.md](./contracts/layout-model.md).

| Transition | Trigger | Rules |
|-----------|---------|-------|
| `applyPreset(kind)` | Preset button | Photos are moved over in reading order and extras dropped. It's one commit. |
| `splitAt(axis, coord, span)` | End of a straight stroke | Every crossed rectangular leaf is split at the same coordinate, and it's all-or-nothing on min size. The photo goes to `a`. |
| `splitByPath(path)` | End of a freehand stroke | Every cell the path crosses from edge to edge is split along each chord; overshoot is ignored; all-or-nothing on min area; self-crossing paths are rejected. The photo goes to `a` (the larger piece). |
| `resizeDivider(splitId, coord)` | Straight divider drag | Ratio clamped to min size on both sides (shaped cells inside use the min-area rule) (a no-op if no valid position exists; see [contract](./contracts/layout-model.md)). It uses preview during the gesture, then one commit. |
| `removeDivider(splitId)` | Delete, Backspace or × | The whole subtree becomes one cell with the first photo from `a` (else `b`). It returns counts for the toast. |
| `clear()` | The Clear button | Resets to one cell and keeps the first photo in reading order. |
| `setImage` / `removeImage` / `swapImages` / `setFraming` | Cell actions | `setFraming` uses preview during pan or pinch, then one commit. |
