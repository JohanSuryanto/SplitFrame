# Contract: Framing model, Adjust popup and entry points

**Feature**: [../spec.md](../spec.md) · **Data model**: [../data-model.md](../data-model.md)

## Module `src/model/frame.ts` (changed)

```ts
export const ZOOM_SNAP = 0.05;

/** "Fit": the zoom at which the whole photo is visible in the cell (≤ 1). */
export function zoomMin(cell: { w: number; h: number }, asset: AssetSize): number;

/** zoom clamped to [zoomMin, ZOOM_MAX]. */
export function effectiveZoom(cell, asset, zoom: number): number;

/** Snaps to exactly 1 within ±ZOOM_SNAP. */
export function snapZoom(zoom: number): number;

export interface ImagePlacement { scale: number; x0: number; y0: number; src: SourceRect; dest: { x: number; y: number; w: number; h: number } }

/** Where the photo is drawn in its cell. The one source of truth for the canvas, Preview, export and the popup (P1). */
export function placeImage(cell: { w: number; h: number }, asset: AssetSize, img: CellImage): ImagePlacement;

/** Unchanged signatures. Now allow zoom below 1, use per-axis clamping (P1), and snap (P2). */
export function panBy(img, dx, dy, cell, asset): CellImage;
export function zoomAt(img, factor, point, cell, asset): CellImage;

/** Sets an absolute zoom around the cell center (slider and ± buttons), snapped and clamped. */
export function zoomTo(img, zoom: number, cell, asset): CellImage;

/** Kept for compatibility: equals placeImage(...).src. */
export function frameImage(cell, asset, img): SourceRect;
```

Guarantees (unit-tested):
- **Regression**: for any `zoom ≥ 1`, `placeImage(...).dest` is the whole cell and `src` equals the current `frameImage` result (the existing `frame.test.ts` cases pass unchanged).
- At `zoomMin`, `src` is the whole image and `dest` is centered along the axis where the photo is smaller than the cell.
- Along an axis where the image is smaller than the cell, after any `panBy`: `0 ≤ x0` and `x0 + D ≤ L`. Along an axis where it's larger: `L − D ≤ x0 ≤ 0`.
- `zoomAt` and `zoomTo` never return `zoom < zoomMin` or `zoom > ZOOM_MAX`. They return exactly `1` when the result is within `1 ± ZOOM_SNAP`.

## Consumers (changed)

- **`src/render/planDraw.ts`**: the `image` op uses `placeImage`. `dest = { x: cell.x + p.dest.x, y: cell.y + p.dest.y, w: p.dest.w, h: p.dest.h }` and `src = p.src`. The `clip` and `restore` ops are unchanged, and the background fill is still first, so gaps show `doc.style.color`.
- **`src/components/Cell.tsx`**: `<img>` style `width: asset.width·p.scale`, `height: asset.height·p.scale`, `transform: translate(p.x0px, p.y0px)`.

## Module `src/state/imageStore.ts` (changed)

```ts
/** Protects an asset that isn't in the history yet (the popup's photo) from releaseUnreferenced. */
export function holdAsset(id: string): void;
export function dropHeld(id: string): void;
```

`releaseUnreferenced` skips held ids.

## Reducer `src/state/docReducer.ts` (changed)

`setImage` accepts an optional `framing` (data model). `defaultFraming` is used when it's left out.

## Component `src/components/AdjustDialog.tsx` (new)

```ts
interface AdjustDialogProps {
  doc: Doc;                     // for the cell's shape, the background color and the canvas size
  cellId: string;
  assetId: string;
  initial: { zoom: number; focusX: number; focusY: number };
  onDone: (framing: { zoom: number; focusX: number; focusY: number }) => void;
  onCancel: () => void;
}
```

- **Structure**: a modal `<dialog aria-label="Adjust photo">` with a `<canvas>` frame, and a control bar.
- **Control bar**:
  - `Zoom out` (−)
  - `<input type="range" aria-label="Zoom">` on a log scale with a "fill" tick
  - `Zoom in` (+)
  - `Reset`
  - `Cancel`
  - `Done` (primary)
- **Drawing order** (research P4): dimmed full photo → cell shape filled with the background and clipped → photo → outline.
- **Input**:
  - `useGestures` on the canvas: drag → `panBy`, pinch and wheel → `zoomAt`, double-tap → reset.
  - Keys: arrows, `+`/`=`, `-`, `0`, Enter.
  - The dialog `cancel` event → `onCancel`. Backdrop clicks do nothing.
- **Focus**: focus goes into the dialog on open (onto Done). On close, focus returns to the cell's element.
- **Layout**: fits the viewport in portrait and landscape with no scrolling (FR-321).

## Editor wiring `src/components/Editor.tsx` (changed)

- State: `adjust: AdjustSession | null`.
- `loadInto(cellId, file)` loads the photo and holds it with `holdAsset`. It sets `adjust = { mode: cell has image ? 'replace' : 'new', cellId, assetId, framing: {1, .5, .5} }`. It **does not commit**.
- `CellMenu` gets `onAdjust`, which sets `adjust = { mode: 'adjust', ... current framing }`.
- **onDone**:
  - `new`/`replace`: `commit({ type: 'setImage', cellId, assetId, framing })`, then `dropHeld`, then the existing "All cells filled" toast check.
  - `adjust`: `commit({ type: 'setFraming', cellId, patch: framing })`.
- **onCancel**: for `new`/`replace`, `dropHeld(assetId)` and ask the history to release unreferenced assets.
- Sample paths are unchanged.

## CellMenu `src/components/CellMenu.tsx` (changed)

A new first item, **Adjust…**, wired to `onAdjust`.
