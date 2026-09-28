# Research: Photo Adjust Popup

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-28

Numbered P1–P10. Features 001–003 use R, S and W.

---

## P1. Framing below "fill": one rule per axis

Today `frameImage` returns only a **source** rectangle, and the photo is always drawn over the whole cell. That can't show gaps. Every consumer assumes it: `planDraw` (Preview/export), `Cell.tsx` (the editor's DOM `<img>`), `panBy` and `zoomAt`.

**Decision**: replace the "crop" model with an **offset** model per axis, expressed in cell pixels. With cell length `L`, image length `a`, cover scale `c = max(Lw/aw, Lh/ah)`, zoom `z` and scale `s = c·z`:

- The displayed image length is `D = a·s`.
- The unclamped left/top edge is `x0 = L/2 − focus·D`, so the focus point sits at the cell center.
- **Clamp**: `x0 ∈ [min(0, L − D), max(0, L − D)]`.
  - When `D ≥ L`, this is exactly today's "keep covering" rule.
  - When `D < L`, it's the new "stay fully inside" rule (FR-315).
- The stored focus is re-derived from the clamped offset, `focus = (L/2 − x0) / D`, so a stored value is always valid.

`placeImage(cell, asset, img)` returns `{ src: SourceRect, dest: Rect }`, where `dest` is relative to the cell. It's the intersection of the image rectangle `[x0, x0 + D]` with `[0, L]`, and `src = (dest − x0) / s`. For `z ≥ 1` on every axis, `dest` is the whole cell and `src` equals today's `frameImage`, so existing framing doesn't change (FR-319).

**Rationale**: one formula gives both rules with no special cases, and it's pure and unit-testable. The current 9 `frame.test.ts` cases pin the `z ≥ 1` behavior, so they are the regression guard.

**Alternatives considered**:
- *Keep `frameImage` and add a separate "letterbox" path*: two code paths that would have to agree at `z = 1`. Rejected.

## P2. Zoom range and snapping (FR-314, FR-316)

- `zoomMin(cell, asset) = min(Lw/aw, Lh/ah) / c`. This is "fit", and it's ≤ 1.
- It depends on the cell's shape, so it isn't stored. `zoom` stays "relative to fill" as today. Every consumer uses `effectiveZoom = clamp(zoom, zoomMin(cell), ZOOM_MAX)`, so if the cell changes shape a stored zoom below the new fit is simply shown at fit (spec edge case "Cell changes shape after Done").
- **Snap**: after any zoom change, `if |zoom − 1| ≤ 0.05 → zoom = 1` (`SNAP = 0.05`). The same rule applies in `zoomAt` and in the slider.

## P3. The zoom slider and buttons

**Decision**:
- **Slider scale**: a native `<input type="range">` over **log(zoom)** from `log(zoomMin)` to `log(8)`. A linear scale would squeeze fit–fill into a sliver.
- **Fill mark**: a visual tick at `log(1)`, plus `aria-valuetext` such as "fill", "2.4×" or "fit".
- **− and + buttons**: step ×0.8 and ×1.25 around the frame center, snapping as in P2.

**Rationale**: a native range input gives keyboard, touch and screen-reader support for free (FR-320).

## P4. The popup's rendering

**Decision**: a modal `<dialog>`, following `PreviewDialog`, containing one `<canvas>` sized to fit the viewport minus the control bar (FR-321). It draws, in order:

1. **Dimmed full photo**: the whole displayed image rectangle (`x0, y0, D`) at 35% opacity, so the part outside the shape is faintly visible (FR-305). It's clipped to the canvas, so it can spill beyond the frame.
2. **Cell shape**: the rounded rectangle or freehand polygon, scaled to the frame, filled with `doc.style.color` for gaps (FR-306), then clipped.
3. **The photo at full opacity** using `placeImage`.
4. **A thin outline** of the shape.

It uses the same `placeImage`, and framing is relative to the cell, so what you see equals the cell, Preview and export by construction (SC-303). No dividers, other cells or watermark are drawn (FR-307).

**Frame geometry**: take the cell's px geometry from `layoutPixels(doc, previewSize)` (its `x, y, w, h, r, polygon`) and scale it by `k = min(frameW / w, frameH / h)`, centered. The corner radius and polygon points scale by the same `k`.

**Alternatives considered**: a DOM `<img>` with CSS clip-path. It can't dim the outside part and clip the inside part without two images and brittle CSS. Rejected.

## P5. Gestures in the popup

**Decision**: reuse `useGestures` (`src/input/useGestures.ts`), the hook `Cell.tsx` already uses for drag, pinch, wheel and double-tap, on the popup canvas. It calls the same `panBy` and `zoomAt` with the popup frame as the "cell". Framing is scale-free, so moving the photo by N frame px means the same thing as moving it by N·(cell/frame) px in the cell.

**Keyboard** (FR-308, FR-309, FR-311, FR-312, FR-313):
- Arrow keys pan 2% of the frame (Shift for 10%).
- `+`/`=` and `−` zoom.
- `0` resets.
- Enter is Done.
- The dialog's `cancel` event (Escape) is Cancel.
- Backdrop clicks are **ignored** (FR-313), unlike Preview.

## P6. One Undo step for "add + framing" (FR-312)

**Decision**: extend the existing `setImage` action with an optional framing: `{ type: 'setImage'; cellId; assetId; framing?: Pick<CellImage,'zoom'|'focusX'|'focusY'> }`. The reducer uses `framing ?? defaults`. Done for a new or replaced photo commits one `setImage` with framing. Done for Adjust… commits one `setFraming`. The popup edits a **local draft**, never `preview()`, so Cancel has nothing to undo (SC-305).

## P7. Holding the picked photo while the popup is open

**Finding**: `App.tsx:66` calls `releaseUnreferenced(referencedAssetsInHistory())` on history changes. A freshly loaded asset isn't in the history until Done. The popup is modal, so the history *shouldn't* change while it's open, but a release triggered for any reason would close the photo's bitmap mid-edit.

**Decision**: add `holdAsset(id)` and `dropHeld(id)` to `src/state/imageStore.ts`. `releaseUnreferenced` skips held ids.
- **Picking** loads the asset and holds it.
- **Done** commits, then `dropHeld` (the history now references it).
- **Cancel** calls `dropHeld`, then `releaseUnreferenced(referencedAssetsInHistory())` to free it right away.

## P8. Which entry points open the popup (FR-301, FR-303)

These paths all go through `Editor.loadInto(cellId, file)`: the file picker from the "Add a photo" chooser, clicks on an empty cell, **Replace**, and drops on a cell. So `loadInto` changes from "load, then commit `setImage`" to "load, hold, then open the popup with `{ mode: 'new' | 'replace', cellId, assetId }`". The existing "All cells filled → Preview" toast moves to after Done.

The sample paths (`src/samples/actions.ts` `putSampleIn`, "Fill empty cells with samples", "Try sample photos") commit directly and are untouched.

**Adjust…**: a new `onAdjust` in `CellMenu` opens the popup with `{ mode: 'adjust', cellId, assetId: image.assetId, framing: image }`.

## P9. The editor's DOM cell with gaps (FR-317, FR-318)

`Cell.tsx` positions a full-size `<img>` with a transform computed from the source rectangle. That generalizes directly: with `placeImage`, the displayed image's top-left in cell px is `(x0, y0)` and its size is `(aw·s, ah·s)`. The `<img>` gets `width: aw·s; height: ah·s; transform: translate(x0, y0)`. The cell already clips (`overflow`, `clip-path` or `border-radius`), and the surface behind it is `doc.style.color`, so gaps show the background with no extra element.

`placeImage` should therefore also return `{ x0, y0, scale }`, so `Cell.tsx` doesn't re-derive them.

## P10. Testing approach

- **`frame.test.ts`**: the existing 9 cases must still pass unchanged (regression for z ≥ 1). New cases:
  - `zoomMin` for landscape-in-tall and portrait-in-wide cells.
  - `placeImage` at `z = zoomMin`: the whole image is visible, centered, and `dest` is a sub-rectangle.
  - Panning below fill stays inside the cell on the small axis and covers on the large axis.
  - `zoomAt` snaps 0.97 → 1 and 1.04 → 1, but not 0.9.
  - `effectiveZoom` clamps a stored 0.3 to a new, larger `zoomMin`.
- **`planDraw.test.ts`**: a below-fill image op has a `dest` smaller than the cell, and the background fill is still first.
- **`docReducer.test.ts`**: `setImage` with framing applies it; without framing it uses the defaults.
- **Image store**: a held asset survives `releaseUnreferenced`.
- **Manual testing** of the popup UX: [quickstart.md](./quickstart.md).
