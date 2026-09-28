# Tasks: Photo Adjust Popup

**Input**: Design documents from `specs/004-photo-adjust-popup/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/adjust.md](./contracts/adjust.md), [quickstart.md](./quickstart.md)

**Tests**: Included for logic. The project brief requires unit tests for layout, framing and export rectangles, and [contracts/adjust.md](./contracts/adjust.md) lists guarantees to unit-test. The popup UX is checked by hand with [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story. The framing-model change is foundational because every story depends on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

Single frontend project at the repo root: `src/model` (pure geometry and framing), `src/render` (draw plan), `src/state` (reducer, image store, hooks), `src/components` (UI and CSS Modules). Vitest runs in `node` with globals.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm the baseline is green: run `npm run typecheck`, `npm run lint` and `npm test` from the repo root and record the test count (no file changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generalize photo framing so a photo can be smaller than its cell (research P1, P2). Switch every consumer to it, and add the reducer and image-store support the popup needs. **With no UI changes, the app must look identical afterwards (FR-319).**

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [X] T002 [P] Extend `src/model/frame.test.ts`. **Keep the existing 9 cases unchanged** (the zoom ≥ 1 regression). Add these cases, using a cell `{w: 100, h: 300}` (tall) and assets `{width: 400, height: 200}` (landscape) and `{width: 200, height: 400}` (portrait):
  - `zoomMin` of the landscape asset in the tall cell is `(100/400) / (300/200) = 1/6`.
  - `zoomMin` of an asset with the same aspect as the cell is `1`.
  - `placeImage` at `zoom ≥ 1`: `dest` is `{x:0, y:0, w:100, h:300}` and `src` deep-equals `frameImage(...)`, for 3 different focus/zoom combos.
  - `placeImage` at `zoom = zoomMin`: `src` is the whole image, `dest.w === 100`, `dest.h === 50`, and `dest.y === 125` (centered).
  - Panning below fill: `panBy` by `(0, +1000)` then by `(0, −1000)` keeps `0 ≤ y0` and `y0 + D ≤ 300`, where `D` is the displayed height. On the covering axis (x), `100 − Dx ≤ x0 ≤ 0`.
  - `zoomAt` snapping: a result of 0.97 → exactly 1; 1.04 → exactly 1; 0.9 stays 0.9 (above `zoomMin`).
  - `zoomAt` never goes below `zoomMin` or above `ZOOM_MAX`.
  - `zoomTo(img, 0.5, cell, asset)` → `zoom` 0.5, zooming around the cell center.
  - `effectiveZoom(cell, asset, 0.1)` → `zoomMin` when `zoomMin > 0.1`.
  - *Deviation*: one existing case, `clamps zoom to [1, 8]`, encoded the old "never below cover" rule that FR-319 replaces on purpose. It was renamed `clamps zoom to [fit, 8]` and now expects `zoomMin`. The other original cases pass unchanged.
- [X] T003 [P] Extend `src/render/planDraw.test.ts` with a below-fill case: the doc has one cell holding an image with `zoom` below 1. The `image` op's `dest` lies inside the cell rect and is strictly smaller in one dimension, and the first op is still the background `fill`.
- [X] T004 [P] Extend `src/state/docReducer.test.ts`:
  - `setImage` with `framing: {zoom: 0.6, focusX: 0.3, focusY: 0.7}` stores exactly those values.
  - `setImage` without `framing` stores `{zoom: 1, focusX: 0.5, focusY: 0.5}`.

### Implementation

- [X] T005 Rewrite the internals of `src/model/frame.ts` per research P1/P2 and [contracts/adjust.md](./contracts/adjust.md):
  - Add `ZOOM_SNAP = 0.05`, `zoomMin`, `effectiveZoom`, `snapZoom`, the `ImagePlacement` interface and `placeImage`, which uses the per-axis offset model: `x0 = L/2 − focus·D`, clamped to `[min(0, L − D), max(0, L − D)]`.
  - Re-implement `panBy` and `zoomAt` on top of `placeImage`. Re-derive the stored focus as `focus = (L/2 − x0) / D`, clamp the zoom to `[zoomMin, ZOOM_MAX]`, and snap it with `snapZoom`.
  - Add `zoomTo(img, zoom, cell, asset)`, which zooms around the cell center.
  - Keep `frameImage` as `placeImage(...).src`, and update its doc comment (it no longer "always covers").
  - Update the `zoom` doc comment in `src/model/types.ts` from "≥ 1" to "> 0; 1 = fills the cell, below 1 zooms out toward fit (feature 004)".
  - Make T002 pass, with the old 9 cases unchanged.
- [X] T006 In `src/render/planDraw.ts`, build the `image` op from `placeImage(cell, asset, image)` as `{ op: 'image', assetId, src: p.src, dest: { x: rect.x + p.dest.x, y: rect.y + p.dest.y, w: p.dest.w, h: p.dest.h } }`. Leave the clip, restore and fill ops unchanged. Make T003 pass.
- [X] T007 In `src/components/Cell.tsx`, replace the `frameImage` block (the comment "Shaped cells frame the photo against their bounding box…") with `const p = placeImage(px, asset, image)` and the style `{ width: asset.width * p.scale, height: asset.height * p.scale, transform: `translate(${p.x0}px, ${p.y0}px)` }`. Keep the comment about bounding boxes. Gaps show the surface's `doc.style.color` behind the cell (research P9).
- [X] T008 [P] In `src/state/docReducer.ts`, add `framing?: Pick<CellImage, 'zoom' | 'focusX' | 'focusY'>` to the `setImage` action type. In the reducer, use `{ ...defaultFraming(action.assetId), ...action.framing }`. Make T004 pass.
- [X] T009 [P] In `src/state/imageStore.ts`:
  - Add a module-level `const held = new Set<string>()`.
  - Add `export function holdAsset(id: string): void` and `export function dropHeld(id: string): void`, each with a doc comment: "Protects an asset that isn't in the history yet (the Adjust popup's photo) from releaseUnreferenced".
  - Make `releaseUnreferenced` skip ids in `held` (`if (referenced.has(id) || held.has(id)) continue;`).

**Checkpoint**: `npm test` passes (old and new cases), and `npm run typecheck` passes. In `npm run dev`, existing collages, sample fills, pan, pinch, Preview and Download look and behave exactly as before (quickstart #17).

---

## Phase 3: User Story 1 - Frame a new photo before it goes into the cell (Priority: P1) 🎯 MVP

**Goal**: Picking a device photo for a cell (empty cell or Replace) opens the Adjust popup. Done adds it with that framing as one Undo step; Cancel adds nothing.

**Independent Test**: 9:16 with 3 columns. Tap the left cell and pick a landscape photo. The popup shows a tall frame with the outside dimmed. Drag, zoom, then Done: the cell matches, and one Undo removes it. Pick again and Cancel: the cell is still empty and nothing is in Undo (quickstart #1–5, #10–12, #15–16).

### Implementation for User Story 1

- [X] T010 [P] [US1] Create `src/components/AdjustDialog.module.css`, following `PreviewDialog.module.css`:
  - `.dialog`: transparent, no border or padding, `max-width/max-height: none`. `::backdrop` is `rgb(10 10 14 / 0.82)`.
  - `.body`: a flex column, centered, with `gap: var(--space-3)`.
  - `.frame`: a block canvas with no background.
  - `.bar`: flex, wrapping, centered, `gap: var(--space-2)`, max width `min(560px, 92vw)`.
  - `.zoom`: flex row, with `.slider` (flex 1, `min-width: 120px`) and a relative wrapper holding a 2px `.fillMark` tick positioned by a `--fill` CSS variable (percent).
  - `.icon`: 40×40 round buttons, `rgb(255 255 255 / 0.14)` background, white.
  - `.secondary` and `.primary`: the same as the PreviewDialog buttons (primary uses `var(--accent)`).
  - Under `@media (max-width: 767px)`: the bar is full width and the zoom row takes its own line.
- [X] T011 [US1] Create `src/components/AdjustDialog.tsx` per [contracts/adjust.md](./contracts/adjust.md). Props are `{ doc, cellId, assetId, initial, onDone, onCancel }`.
  - **Geometry**: find the cell in `layoutPixels(doc, { w: doc.canvas.width, h: doc.canvas.height })`, at the export size. Only the shape's proportions matter, and the export size gives the true corner radius and polygon proportions. Compute the frame size as the viewport (`innerWidth·0.92`, `innerHeight·0.92 − bar height`, where the bar height is 120 px below 768 px and 72 px otherwise) scaled by `k = min(frameW / cell.w, frameH / cell.h)`. Scale the corner radius and `polygon` (translated by `−cell.x, −cell.y`) by `k`. Recompute on `resize`.
  - **Draft state**: `useState(initial)` for the framing, using the asset from `getAsset(assetId)`.
  - **Drawing** (`useLayoutEffect` on the draft and sizes; the canvas backing store at device pixel ratio). The canvas is larger than the frame by a margin (for example 12% on each side) so the dimmed overflow is visible. Draw in this order:
    1. The whole displayed image at `globalAlpha 0.35`, using `placeImage`'s `x0, y0, scale`, offset by the frame origin.
    2. `save`, then build the cell path (a rounded rect via `roundRect`, or the polygon), `fillStyle = doc.style.color`, fill, clip.
    3. `drawImage` with `placeImage`'s `src` → `dest` offset by the frame origin.
    4. `restore`, then stroke the path with a 1.5 px `rgb(255 255 255 / 0.8)` line.
  - **Input**:
    - `useGestures` on the canvas: `onDragMove` → `panBy` (the delta in frame px, with the frame size as the cell); `onPinch` and `onWheel` → `zoomAt` around the point relative to the frame origin; `onDoubleTap` → reset to `{1, .5, .5}`.
    - Keyboard handler on the dialog: arrows pan 2% of the frame (10% with Shift); `+`/`=` → `zoomAt(1.25)` at the center; `-` → `zoomAt(0.8)`; `0` → reset; `Enter` → `onDone(draft)`.
    - The dialog `onCancel` (Escape) → `preventDefault()` + `onCancel()`. Clicks on the backdrop must **do nothing**.
  - **Control bar**, in order:
    1. `Zoom out` icon button (−)
    2. a zoom `<input type="range" aria-label="Zoom">` over `log(zoom)` from `log(zoomMin)` to `log(ZOOM_MAX)` (step 0.01). `onChange` → `zoomTo(draft, exp(value))`. `aria-valuetext` is "fill" at 1, "fit" at `zoomMin`, otherwise `${zoom.toFixed(1)}×`. The `--fill` style is at `(0 − log zoomMin) / (log 8 − log zoomMin)`.
    3. `Zoom in` icon button (+)
    4. `Reset`
    5. `Cancel`
    6. `Done` (primary)
  - **Open and focus**: `showModal()` on mount, and focus Done.
  - Header comment: `// The Adjust photo popup: frame a photo inside its cell's exact shape before it goes in (feature 004, FR-301 to FR-313).`
- [X] T012 [US1] Wire the popup into `src/components/Editor.tsx`:
  1. **State**: add `const [adjust, setAdjust] = useState<{ mode: 'new' | 'replace' | 'adjust'; cellId: string; assetId: string; framing: { zoom: number; focusX: number; focusY: number } } | null>(null)`.
  2. **`loadInto`**: after `loadImage`, call `holdAsset(asset.id)` and `setAdjust({ mode: cellHasImage ? 'replace' : 'new', cellId, assetId: asset.id, framing: { zoom: 1, focusX: 0.5, focusY: 0.5 } })`. **Remove** the direct `commit({ type: 'setImage', … })` and the "All cells filled" toast from here.
  3. **`onDone(framing)`**:
     - For `new`/`replace`: work out `fillsLast` exactly as `loadInto` did before, then `commit({ type: 'setImage', cellId, assetId, framing })`, then `dropHeld(assetId)`, then push the "All cells filled" toast if `fillsLast`.
     - For `adjust`: `commit({ type: 'setFraming', cellId, patch: framing })`.
     - Then `setAdjust(null)` and return focus to the cell with the existing `focusCell(cellId)`.
  4. **`onCancel`**: for `new`/`replace`, `dropHeld(assetId)` and `props.releaseUnused()`. Then `setAdjust(null)` and `focusCell(cellId)`.
  5. **Render**: `{adjust && <AdjustDialog doc={doc} cellId={adjust.cellId} assetId={adjust.assetId} initial={adjust.framing} onDone={…} onCancel={…} />}` as the last child of the editor root.
  6. **New prop**: `releaseUnused: () => void` in `EditorProps`.

  Leave the sample paths (`putSampleIn`, `trySamples`, `fillEmptyWithSamples`) untouched (FR-303).
- [X] T013 [US1] In `src/App.tsx`, pass `releaseUnused={() => releaseUnreferenced(referencedAssetsInHistory())}` to `<Editor>`.

**Checkpoint**: US1 works end to end. Run quickstart #1–5, #10–12 and #15–16.

---

## Phase 4: User Story 2 - Zoom out to fit more of the photo (Priority: P1)

**Goal**: The popup and slider zoom below fill down to "fit", with gaps in the background color everywhere, and snap to fill.

**Independent Test**: A portrait photo in a 1:1 cell, zoomed fully out in the popup, shows the whole photo with side gaps and moves sideways inside the frame. Done, then Preview and Download show the same gaps. Zooming slowly past fill settles exactly on fill (quickstart #6–9).

### Implementation for User Story 2

- [X] T014 [US2] Verify and finish the below-fill behavior in `src/components/AdjustDialog.tsx`:
  - The slider's minimum is `log(zoomMin(frame, asset))`, and the fill tick shows.
  - The − button stops at fit; the + button stops at `ZOOM_MAX`.
  - Gaps inside the frame are filled with `doc.style.color` (drawing step 2).
  - Snapping comes from `zoomAt`/`zoomTo`; add nothing extra here.

  Then confirm by hand that Preview and Download show the same gaps (they use `planDraw`, updated in T006). If `aria-valuetext` doesn't read "fill" after snapping, fix the comparison to use `zoom === 1`.

**Checkpoint**: Quickstart #6–9 pass.

---

## Phase 5: User Story 3 - Adjust a photo that is already placed (Priority: P2)

**Goal**: ⋯ → Adjust… opens the same popup with the current framing. Done is one Undo step; Cancel changes nothing.

**Independent Test**: Narrow a photo's cell by dragging a divider, then ⋯ → Adjust…, move the photo, Done. The cell updates, and one Undo restores the previous framing (quickstart #8, #13).

### Implementation for User Story 3

- [X] T015 [P] [US3] In `src/components/CellMenu.tsx`, add an `onAdjust: () => void` prop and a first menu item **Adjust…**, in the same style as the others. Update the doc comment to "Adjust… / Replace / Remove / Reset position…".
- [X] T016 [US3] In `src/components/Editor.tsx`, pass `onAdjust` to `<CellMenu>`. It finds the menu cell's image with `images.get(menuCellId)` and calls `setAdjust({ mode: 'adjust', cellId: menuCellId, assetId: image.assetId, framing: { zoom: image.zoom, focusX: image.focusX, focusY: image.focusY } })`, then `closeMenu()`. The Done and Cancel handling for `adjust` from T012 applies.

**Checkpoint**: Quickstart #8 and #13 pass.

---

## Phase 6: User Story 4 - Quick adjustments in the cell still work (Priority: P3)

**Goal**: In-cell drag and pinch follow the new range and snapping; double-tap still resets.

**Independent Test**: Pinch a photo in its cell below fill: gaps appear. Pinch back: it snaps to fill. Double-tap: it resets (quickstart #14).

### Implementation for User Story 4

- [X] T017 [US4] In `src/components/Cell.tsx`, check that the gesture handlers (`panBy`, `zoomAt`, and `resetFraming` on double-tap) need no change beyond T005/T007. Update the comment "Pan, pinch, wheel zoom and double-tap reset for photos, in Arrange mode only (FR-023, FR-024)" to also cite feature 004 FR-318. Then check by hand that below-fill pinching in the cell shows gaps in the background color and snaps back to fill.

**Checkpoint**: Quickstart #14 and #17 pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T022 [US1] UI polish after review (user request, 2026-09-28), in `src/components/AdjustDialog.tsx` and `.module.css`, plus `ResetIcon` in `src/components/icons.tsx`:
  - A phone-style header: Cancel · "Adjust photo" · Done, with a hint line "Drag to move · pinch or scroll to zoom" that fades after the first move.
  - Rule-of-thirds guides inside the frame while dragging or zooming.
  - **Fit** and **Fill** chips (showing as pressed when active) and a zoom % readout, where 100% means fill.
  - A frosted rounded toolbar with a Reset icon. On phones the slider gets its own row.

- [X] T018 [P] Amend `specs/001-splitframe-collage-editor/spec.md` per the plan's "Base spec amendment":
  - FR-023: "The photo MUST always cover its cell, so zoom can never go below cover size" → "Photos fill their cell by default. Users may zoom out down to fit (see feature 004 FR-314 to FR-317); gaps show the background color."
  - User Story 2 acceptance scenario 2: "cannot zoom out past the size where it just covers the cell" → "can zoom out down to where the whole photo fits, with gaps shown in the background color, and snaps to fill when close".
  - Add "*(Amended 2026-09-28 by feature 004.)*" to both.
- [X] T019 [P] In `README.md`:
  - Change the Features "Photos" bullet to mention "picking a photo opens **Adjust photo** to move and zoom it in the cell's shape before it goes in; **Adjust…** in the ⋯ menu reopens it; zoom out to fit the whole photo (gaps use the background color)".
  - Add **Adjust…** to the list of ⋯ menu items.
- [X] T020 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, and fix anything they report in the files touched by T002–T019.
- [X] T021 Run the manual checks in `specs/004-photo-adjust-popup/quickstart.md` (#1–17), on desktop and on a phone (`npm run dev -- --host`). Record the results under a new "Results" heading at the end of that file.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: blocks every story. T005 blocks T006, T007 and T011. T008 and T009 block T012.
- **US1 (Phase 3)**: after Phase 2. This is the MVP.
- **US2 (Phase 4)**: after US1 (it refines the same component).
- **US3 (Phase 5)**: after US1 (it reuses the popup and the Editor session). T015 can be done any time.
- **US4 (Phase 6)**: after Phase 2; it is mostly verification.
- **Polish (Phase 7)**: after the stories.

### Task-level dependencies

- T002 → T005 → T006 (with T003) and T007
- T004 → T008
- T005, T010 → T011 → T012 → T013
- T011 → T014
- T012, T015 → T016
- T005, T007 → T017

### Parallel Opportunities

- T002, T003 and T004: three different test files.
- T008 and T009: different files, independent of T005.
- T010 (CSS) alongside T005–T009.
- T015 (`CellMenu`) at any time after Phase 2.
- T018 and T019: docs.

---

## Parallel Example: Foundational

```text
# In parallel:
Task T002: frame.test.ts new cases
Task T003: planDraw.test.ts below-fill case
Task T004: docReducer.test.ts setImage framing
Task T008: docReducer setImage.framing
Task T009: imageStore holdAsset/dropHeld

# Then:
T005 (frame.ts) → T006 (planDraw) ∥ T007 (Cell.tsx)
```

---

## Implementation Strategy

### MVP First

1. T001, then Phase 2 (T002–T009). **Stop and check that nothing looks different** (FR-319).
2. US1 (T010–T013). Framing new photos in the popup already delivers the core ask.
3. US2 (T014). Zoom-out to fit; the model already allows it.
4. US3 (T015–T016): Adjust… for placed photos.
5. US4 (T017): verify in-cell behavior.
6. Polish (T018–T021), then commit and deploy.

---

## Notes

- `placeImage` is the single source of truth for where a photo is drawn. Don't compute framing anywhere else.
- The popup never calls `preview()` or `commit()` until Done (SC-305).
- Always `dropHeld` a held asset on both Done and Cancel, or it leaks for the whole session.
- Commit after each task or logical group.
