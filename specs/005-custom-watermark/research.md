# Research: Custom Watermark

The base app ([001 research](../001-splitframe-collage-editor/research.md)), share (002) and credit (003, W1–W9) still apply. These decisions add to them.

## C1. Where the watermark lives: on `Doc`

- **Decision**: add `watermark: Watermark` to `Doc`. It is always present, and empty text means no watermark.
- **Rationale**: FR-514 makes it undoable, and undo is snapshot-based on `Doc` (`useHistory`). Putting it on the document also means Preview, Download and Share already get it, and `sameExportInput` (compares `doc` by identity) already invalidates a pre-rendered share file when it changes. Having it always present (not optional) keeps renderers free of `undefined` checks.
- **Alternatives considered**: UI state like the 003 credit was rejected: it isn't undoable, and the share cache would need another field. A list of marks was rejected because the spec allows one watermark (YAGNI). The later logo/signature features can turn it into a list when they need to.

## C2. One `setWatermark` patch action

- **Decision**: `{ type: 'setWatermark'; patch: Partial<Watermark> }`. The reducer clamps every field:
  - text: trimmed to 100 characters
  - opacity: 0.1 to 1
  - size: 0.02 to 0.2
  - rotation: −90 to 90, snapping to 0 within ±3
  - x and y: 0 to 1
  - color: `#RRGGBB` only, uppercased
  
  It returns the same `doc` when nothing changes. When `repeat` turns on while rotation is 0, rotation becomes −30.
- **Rationale**: this mirrors `setStyle`, a pattern the codebase already uses. One action covers the panel, the drag and the keyboard. Returning the same object keeps no-op commits out of history.
- **Alternatives considered**: one action per field (`moveWatermark`, `setWatermarkColor`, …) was rejected: more code for the same behaviour.

## C3. Units: relative to the canvas

- **Decision**: position `x` and `y` are fractions (0–1) of the canvas width and height, and mark the text's center. `size` is the text height as a fraction of the canvas's short side. Rotation is in degrees.
- **Rationale**: the spec's edge case says the mark stays put when the canvas shape or resolution changes. Fractions are what the credit (003) and the rest of the model use, so the same plan scales to the editor, Preview and export surfaces.

## C4. Drawing plan: `planTextMark`

- **Decision**: a pure `planTextMark(mark, canvas, sizePx, measure)` in `src/render/textMark.ts` returns `null` when the text is empty, otherwise:
  - `font`, `fillStyle` (the color with opacity applied through `globalAlpha`), `angle` in radians
  - `points`: the centers to draw the text at, in surface px
  - **Single**: one point at `(x·w, y·h)`
  - **Repeat**: a lattice in the rotated frame. The step along a row is `textWidth + 2·fontPx`, and between rows `2·fontPx` (a text height plus a one-height gap). It is shifted by `(x−0.5, y−0.5)` of the canvas, so dragging moves the pattern. It is clipped to points whose copy can touch the canvas (a circle with the canvas diagonal as its radius around the center).
  
  The font is the existing system stack `watermarkFont(px)`, with no web font (003 W4). The drawing code calls `translate(point)`, `rotate(angle)` and `fillText` with `textAlign: center` and `textBaseline: middle`.
- **Rationale**: this follows the tested `planWatermark` pattern, with `measure` injected so it runs in `node` tests. Using one plan for every surface is what makes the canvas and the file match (SC-502). The lattice covers the whole rotated canvas, which gives SC-503 (every quarter has a full copy) for any size of at least 2%.
- **Alternatives considered**: a `createPattern` tile was rejected: a rotated pattern needs an off-screen canvas and gets resampled, so it would look softer in export than in the editor. A text shadow or outline for readability was rejected: the spec makes contrast the user's choice through color and opacity, and the canvas shows the true result. It can be added later if people ask.

## C5. Editor display: generalize `WatermarkLayer` into `MarkLayer`

- **Decision**: rename `WatermarkLayer` to `MarkLayer`. It draws the custom mark (always, when there is text) and the credit (only when `showCredit`, which is today's `showWatermark` rule from 003 FR-215) on one DPR-aware overlay canvas, sharing the draw helper with `renderCollage`.
- **Rationale**: one overlay instead of two; same z-index and the same sizing code. FR-511 needs the mark visible at all times, which the existing layer already supports in its `useLayoutEffect`.

## C6. Dragging and keyboard

- **Decision**: when `interactive` (Watermark panel open and text non-empty), the layer gets `pointer-events: auto`, `touch-action: none`, `tabIndex=0`, an `aria-label` ("Watermark position…", see the contract), and `SHEET_IGNORE_ATTR`. Pointer down anywhere on it captures the pointer:
  - each move calls `preview({ setWatermark: { x: x0 + dx/w, y: y0 + dy/h } })`
  - up calls `endGesture()`, cancel calls `cancelGesture()`
  
  Arrow keys commit a 1% move (10% with Shift). With Repeat on, the same delta shifts the pattern.
- **Rationale**: dragging anywhere instead of hit-testing the text works on a phone even when the text is small, rotated or tiled, and it can't miss. Using `preview`/`endGesture` makes one drag one undo step (FR-514), as Divider and Cell drags already do. Without `SHEET_IGNORE_ATTR`, the sheet's outside-press handler would close the panel on the first touch.
- **Alternatives considered**: hit-testing the rotated text box was rejected: more code, and it fails on small text and in Repeat mode. Two-finger pinch/rotate on the canvas was skipped for now. The sliders cover it, and it can be added later if people ask for it.

## C7. Panel

- **Decision**: `WatermarkPanel`, laid out like `StylePanel` with `Panel.module.css`:
  - text `<input maxLength=100 placeholder="e.g. For verification by Bank X only">` and an **Add date** button
  - a **Repeat** `role="switch"` (same markup as the 003 switch)
  - sliders for Size, Rotation and Opacity
  - color swatches (white, black, red `#E53935`, gray `#808080`) and an `<input type="color">`
  - a **Center** button (x = y = 0.5)
  
  The controls other than the text box are disabled while the text is empty. A new dock item, **Watermark**, opens it, with `PanelName` gaining `'watermark'`.
- **Rationale**: it reuses existing markup and styles. The Center button gives keyboard and screen-reader users placement without dragging (FR-510).

## C8. Undo grouping for typing and sliders

- **Decision**:
  - Sliders: the `StylePanel` pattern (`preview` while the pointer is down, `endGesture` on release; keyboard steps commit).
  - Color input: `preview` on `input`, `endGesture` on `change`.
  - Text box: `preview` on each input and `endGesture` on blur. Add date, Repeat, swatches and Center each `commit`.
- **Rationale**: one typing session is one undo step instead of one per letter. A `commit` mid-gesture already closes the open gesture first (`historyReducer`), so nothing is lost if the user taps a button while the text box is focused.

## C9. Date text

- **Decision**: `new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date())`, appended as `" · " + date`, or used alone when the text is empty. The result is clamped to 100 characters by the reducer.
- **Rationale**: built into every target browser, and it uses the device's local format as the spec assumes. No date library.
