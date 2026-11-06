# Research: Signature

The base app (001), the credit (003), the Adjust popup (004, especially its asset hold) and the custom watermark (005, C1–C9) still apply. These decisions add to them.

## S1. Where the signature lives: `Doc.signature: Signature | null`

- **Decision**: one optional mark on the document. `null` means none. The picture is a tagged union:
  - `{ kind: 'strokes'; strokes: Pt[][]; aspect; lineWidth }`: points normalized to 0–1 inside the signature's own box; `lineWidth` is a fraction of the box width.
  - `{ kind: 'image'; assetId; aspect }`: a cleaned-up upload in `imageStore`.
- **Rationale**: on the document it's undoable for free and reaches Preview, Download and Share through the shared renderer, exactly like feature 005 (C1). Vector strokes stay sharp at 8000 px (FR-605) and are tiny in undo snapshots (snapshots are shared by reference; a few hundred points). Uploads have to be pixels, and `imageStore` already handles decoding, downscaling, object URLs and release.
- **Alternatives considered**: rasterizing drawn signatures into an asset was rejected: it would be blurry at large export sizes unless rendered huge, and it would cost memory per undo step. A `marks: Mark[]` list was rejected because the spec allows one signature (YAGNI). A future multi-mark feature can turn `watermark` and `signature` into a list.

## S2. Actions and shared clamping

- **Decision**:
  - `setSignaturePicture { picture }`: if there's no signature, create one with `DEFAULT_SIGNATURE_PLACEMENT` (center 0.75/0.85, size 0.35, color `#111111`, opacity 1, rotation 0, `keepColors` false). Otherwise replace only `picture` (FR-615).
  - `setSignature { patch }`: patch the placement fields and `keepColors`, clamped. Size 0.1–0.8; opacity 0.1–1; rotation −90–90 with the ±3° snap; x/y 0–1; color `#RRGGBB`.
  - `removeSignature`.
  
  Every action returns the same `doc` when nothing changes. The number clamping and rotation snap move into a small `clampPlacement` helper used by both `setWatermark` and `setSignature`.
- **Rationale**: this mirrors `setWatermark`. Keeping the clamping in one helper means the two marks can't drift apart in behaviour.
- **Note on keepColors**: it's chosen in the upload dialog and sent together with the picture: `setSignaturePicture { picture, keepColors }`. A drawn signature always sets `keepColors: false`.

## S3. `planSignature`: one placement for every surface

- **Decision**: `planSignature(sig, canvas, sizePx) → { cx, cy, w, h, angle }`, where:
  - `w = sig.size · min(W, H) · (sizePx.w / W)` and `h = w / picture.aspect`
  - the center is `(x · sizePx.w, y · sizePx.h)`
  - `angle` is in radians
  
  Size is the signature's **width** as a share of the short side (FR-613/614), because a signature is wide and short, so width is the dimension people judge.
- **Rationale**: the same pure, scaled-to-surface pattern as `planWatermark` and `planTextMark`, so the editor, Preview and export match (SC-604).

## S4. Pad strokes → normalized picture: `normalizeStrokes`

- **Decision**: the pad records raw strokes in pad CSS px and smooths each one on pointer-up with the existing `smoothStroke` (resample, moving average, RDP). On Done, `normalizeStrokes(strokes, padLineWidthPx)`:
  1. Finds the bounding box of all points.
  2. Pads it by half the line width plus 4% of its larger side (so round caps and edges aren't clipped).
  3. Maps points to 0–1 within it.
  4. Returns `{ strokes, aspect: boxW / boxH, lineWidth: padLineWidthPx / boxW }`.
  
  A single tap (a 1-point stroke) becomes a dot: a box of one line width.
- **Rendering**: each stroke is drawn as a path through the midpoints of consecutive points with `quadraticCurveTo` (the classic smooth-signature technique), `lineCap`/`lineJoin` set to `round`, and a constant width. A 1-point stroke is drawn as a filled circle.
- **Rationale**: it reuses tested smoothing and gives smooth curves without a spline library. A constant width matches the spec ("one natural-looking line width"), and avoids pressure handling that varies between devices.
- **Pad line width**: `max(2.5, padHeight · 0.018)` CSS px, so a pad of about 220 px gives a 4 px pen.

## S5. Background removal: `removeBackground`

- **Decision**: a pure function on an `ImageData`-like `{ data: Uint8ClampedArray; width; height }`:
  1. Luminance `L = 0.299R + 0.587G + 0.114B` per pixel, kept in a `Float32Array`.
  2. **Auto cutoff** with Otsu's method on a 256-bin luminance histogram (ink vs paper is a textbook two-class split). Clamp the result to 60–220 so a nearly blank page doesn't produce a silly cutoff.
  3. **Sensitivity** `s` in 0–100 (default 50) shifts the cutoff: `c = otsu + (s − 50) · 1.2`. Higher means more counts as ink.
  4. **Alpha** with a soft edge for anti-aliasing: `a = clamp((c − L) / 24 + 0.5, 0, 1)`, applied as `alpha · original alpha` (transparent PNGs stay transparent). RGB is kept untouched, so Keep original colors works.
  5. **Ink box**: the bounding box of pixels with `a ≥ 0.5`. It's `null` when fewer than 0.05% of pixels qualify, which triggers "No signature found" (FR-612). Crop to the box plus a margin of 3% of its larger side (FR-610).
  
  It returns `{ data, box }`, with the alpha written into a copy. For the live preview it runs on a copy downscaled to a 512 px long side. On Done it runs on up to 2048 px, the crop is drawn to a canvas, and `addAssetFromCanvas` stores it as a PNG.
- **Rationale**: Otsu needs no tuning for typical phone photos (SC-602), is about 30 lines, and is easy to test on synthetic images. The soft edge avoids jagged ink. Processing a 512 px copy keeps the slider live on phones (FR-608).
- **Alternatives considered**: a fixed threshold was rejected: it fails under warm indoor light, where paper reads as about 180, not 240. Adaptive local thresholding (to handle shadows) was rejected: about 4× the code, and the spec accepts that bad light needs the slider or a retake. Colour-distance-from-paper was rejected: it's no better for dark ink, and worse for blue ink on cream paper.

## S6. Asset memory: holding and history

- **Decision**:
  - The upload dialog loads the photo with the existing `loadImage` (types, orientation, downscaling, error message, FR-607) and calls `holdAsset` on the source, as the Adjust popup does.
  - On Done, the cleaned crop becomes a **new** asset through `addAssetFromCanvas`, and the source is `dropHeld` and released. On Cancel, the source is dropped.
  - `historyAssets` adds `doc.signature?.picture.assetId` for every state, so replaced or removed signature images stay in memory while undo can bring them back, and are freed after.
- **Rationale**: this reuses the 004 hold mechanism and the base rule that photos are released once no undo step refers to them (FR-027), and the source photo isn't kept around.

## S7. Drawing and recoloring

- **Decision**: `drawSignature(ctx, sig, canvas, sizePx)`: `save`, `translate(cx, cy)`, `rotate(angle)`, `globalAlpha = opacity`, then:
  - **Strokes**: `strokeStyle = color` and `lineWidth = lineWidth · w`. Points map to `(px·w − w/2, py·h − h/2)`, drawn as in S4.
  - **Image with `keepColors`**: `drawImage(bitmap, −w/2, −h/2, w, h)`.
  - **Image recolored**: draw a tinted copy. It's made once per `(assetId, color)` by filling an offscreen canvas of the bitmap's size with the color, then `destination-in` with the bitmap, and kept in a one-entry module cache.
  
  `renderCollage` order: collage → `drawTextMark` → `drawSignature` → credit (FR-617).
- **Rationale**: tinting through compositing keeps the ink's soft alpha edge. The one-entry cache means dragging or exporting never redoes pixel work, and memory stays at one extra bitmap.

## S8. Tabs and the drag target

- **Decision**:
  - `App` holds `markTab: 'text' | 'signature'` (default `'text'`) and passes it to `WatermarkPanel` (as the selected tab) and to `Editor`.
  - `Editor` passes `MarkLayer` a `target: 'text' | 'signature' | null`. It's `null` when the Watermark panel is closed, or when the selected mark doesn't exist (empty text, no signature).
  - `MarkLayer`'s existing drag and arrow-key code reads x/y from the target and dispatches `setWatermark` or `setSignature`. Nothing else changes.
  - The tabs use the existing `.segmented`/`.segment` styles with `aria-pressed`.
- **Rationale**: one interactive layer and one drag implementation for both marks (FR-602, FR-614). The tab lives in `App` because both the panel and the canvas need it. It's UI state, not undoable.

## S9. Signature pad dialog

- **Decision**: a native `<dialog>` (`showModal`, Escape cancels), like `ConfirmDialog`, holding a canvas that is:
  - on phones: the full dialog width with a 2:1 aspect, at most 60% of the viewport height
  - on desktop: up to 720 px wide with a 3:1 aspect
  
  It has a faint baseline at 75% height with an "×", and shows "Sign here" until the first stroke.
  
  **Input**: Pointer Events with `touch-action: none`. On down, start a stroke. On move, append `getCoalescedEvents()` points where supported (smoother fast strokes on phones) and draw the new segment straight away. On up, replace the raw stroke with `smoothStroke(raw)` and redraw.
  
  **Buttons**: Undo stroke and Clear edit the local stroke list. Cancel closes. Done (disabled while empty) calls `onDone(normalizeStrokes(...))`.
  
  **Rotation and resize**: strokes are kept in pad-relative units (fractions of the pad width), so a rotation or resize simply rescales them.
  
  Strokes never touch `useHistory` (FR-606).
- **Rationale**: it matches existing dialogs. Coalesced events and incremental drawing give the "no gap behind the finger" feel (SC-605), and smoothing on pointer-up reuses tested code.

## S10. Upload dialog

- **Decision**: a native `<dialog>` with:
  - the processed preview on a CSS checkerboard (two `linear-gradient`s; no image)
  - a **Sensitivity** range 0–100 (default 50)
  - a **Keep original colors** `role="switch"` (when on, the preview shows original colors; when off, it shows the ink in the current or default ink color)
  - "No signature found — try a higher sensitivity or a clearer photo" when `box` is null, with Done disabled
  - Cancel and Done
  
  Slider changes reprocess the 512 px copy straight away (about 0.25 MP, a few ms). The file picker is a hidden `<input type="file" accept="image/*">` in `WatermarkPanel`, the same as the editor's photo picker.
- **Rationale**: the checkerboard makes "what's transparent" obvious, and live reprocessing on a small copy keeps it responsive. The text exactly as in FR-612.

## S11. Signature controls in the panel

- **Decision**: the Signature tab shows:
  - **No signature**: two large buttons, **Draw signature** and **Upload signature**, plus the note "Stays on your device and is forgotten when you close the page."
  - **With a signature**: a small thumbnail (rendered with `drawSignature` into a 160×60 canvas), then **Redraw**, **Upload** and **Remove**; then sliders for Size (10–80%), Rotation (−90–90°) and Opacity (10–100%); then ink color swatches and a picker (hidden when `keepColors`); then **Center**.
  
  The slider, swatch and picker behaviour (preview while dragging, `endGesture` on release or picker close, commit on keys) is the same code as the Text tab. Pull the existing `slider` helper and the swatches row into small local components inside `WatermarkPanel.tsx`, used by both tabs.
- **Rationale**: the user asked for the same controls as the watermark. Sharing the helpers within one file avoids drift without adding a new module.
