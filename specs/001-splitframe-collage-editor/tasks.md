---

description: "Task list for SplitFrame — Custom-Grid Photo Collage Editor"
---

# Tasks: SplitFrame — Custom-Grid Photo Collage Editor

**Input**: Design documents from `specs/001-splitframe-collage-editor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/layout-model.md](./contracts/layout-model.md), [contracts/ui-interactions.md](./contracts/ui-interactions.md), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED. The brief requires Vitest unit tests for layout, snapping and export rectangles. Their exact cases are listed in [contracts/layout-model.md](./contracts/layout-model.md) under "Required test cases" 1–8. Write each test task before the implementation task it covers, and make sure the test fails first.

**Organization**: Tasks are grouped by user story (US1–US7, matching spec.md), so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, and no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1…US7)
- Paths are relative to the repository root (`C:\Projects\SplitFrame`). This is a single project, and tests sit next to the code they test (`*.test.ts`).

## Conventions that apply to every task

- TypeScript `strict`. Every file under `src/model/` and `src/render/planDraw.ts` must be **pure**: no DOM, no `window`, no React.
- Model functions never change their inputs. They always return new objects.
- Keep **every** doc change going through `useHistory`. Use `commit` for single actions. For continuous gestures, use `preview` and then `endGesture` (see [data-model.md §3](./data-model.md)).
- `direction` is the direction of the **divider line**. `'horizontal'` means `a` = top and `b` = bottom. `'vertical'` means `a` = left and `b` = right.
- Style values are in reference px, where the canvas **short side = 1080**. The scale is `min(w, h) / 1080`.
- No network calls, no analytics, and no runtime dependencies other than `react` and `react-dom`.
- Styling uses CSS Modules (`*.module.css`) plus `src/styles/tokens.css`. Don't use Tailwind.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the project and its tooling.

- [X] T001 Create `package.json` at the repository root:
  - `"name": "splitframe"`, `"private": true`, `"type": "module"`.
  - Scripts: `dev` = `vite`, `build` = `tsc --noEmit && vite build`, `preview` = `vite preview`, `test` = `vitest run`, `test:watch` = `vitest`, `typecheck` = `tsc --noEmit`, `lint` = `eslint .`.
  - Dependencies: `react@^19`, `react-dom@^19`.
  - Dev dependencies: `vite`, `@vitejs/plugin-react`, `typescript@^5`, `vitest`, `jsdom`, `@types/react`, `@types/react-dom`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@testing-library/react`.

  Then run `npm install`.
- [X] T002 [P] Create `tsconfig.json`:
  - `strict: true`, `noUncheckedIndexedAccess: true`.
  - `target` and `lib`: `ES2022`, `DOM`, `DOM.Iterable`.
  - `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`.
  - `types: ["vite/client", "vitest/globals"]`, `include: ["src", "vite.config.ts"]`.
- [X] T003 [P] Create `vite.config.ts`:
  - Use `@vitejs/plugin-react`.
  - Import `defineConfig` from `vitest/config`. Add a `test` block with `globals: true`, `environment: 'node'` and `include: ['src/**/*.test.ts']`. Hook tests switch themselves to jsdom with a `// @vitest-environment jsdom` comment.
  - Add a build-only plugin (`apply: 'build'`, `transformIndexHtml`) that injects `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'">`. This enforces FR-001 in production without breaking dev hot reload.
- [X] T004 [P] Create `eslint.config.js`: flat config with `@eslint/js` recommended, `typescript-eslint` recommended, and `react-hooks` rules. Add a `no-restricted-globals` rule for `fetch` and `XMLHttpRequest` across `src/**` (FR-001).
- [X] T005 [P] Create `index.html` with `<title>SplitFrame</title>`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` and `<div id="root">`. Create `src/main.tsx`, which renders `<App />` inside `React.StrictMode` and imports `./styles/tokens.css`.
- [X] T006 [P] Create `src/styles/tokens.css` with:
  - CSS custom properties for surface, text, accent, danger, border and focus-ring colors, with light and dark versions through `prefers-color-scheme`.
  - Spacing scale 4/8/12/16/24.
  - A global `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }` (FR-040).
  - `body { margin: 0; background: var(--surface); }`.
- [X] T007 [P] Create `.gitignore` with `node_modules`, `dist`, `coverage`, `*.log` and `.DS_Store`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, core geometry, history, image store, gestures and the editor shell that **every** story needs.

**⚠️ CRITICAL**: Finish this phase before starting any user story.

### Tests for Foundational (write first, make sure they fail)

- [X] T008 [P] Write `src/model/layout.test.ts` (core section):
  - `computeRects` on a single cell returns `{x:0,y:0,w:1,h:1}`.
  - `computeRects` on a hand-built nested tree gives rectangles that cover [0,1]² exactly with no overlaps. Check it by summing areas to 1 and testing every pair for intersection.
  - `dividers()` returns one entry per split, with `{splitId, direction, coord, span}` in global normalized coordinates.
  - `cellsInReadingOrder` visits depth-first, `a` before `b`.
  - `setCellImage`, `swapCellImages` (which resets both framings to `zoom:1, focusX:0.5, focusY:0.5`) and `setFraming` never change their input.
  - `referencedAssets` collects every `assetId`.
- [X] T009 [P] Write `src/model/geometry.test.ts`:
  - `layoutPixels` for a 2-column (`ratio 0.5`, `'vertical'`) 1080×1920 doc with gap 20 and padding 0 gives cells `{x:0,y:0,w:530,h:1920}` and `{x:550,y:0,w:530,h:1920}` (contract case 7).
  - Padding 30 insets the content area by 30 on every side, and outer edges get no gap.
  - Radius is clamped to `min(r, w/2, h/2)`.
  - At 1920×1080, gap 20 is still 20 px, because the scale is `min(w,h)/1080 = 1`. At 2160×3840 it's 40 px.
  - `minSizeNorm` for 1080×1920 gives `x = max(54, 40)/1080` and `y = max(96, 40)/1920`. For a custom 400×400 canvas it gives `40/400` on both axes.
- [X] T010 [P] Write `src/model/frame.test.ts` (cover section):
  - `frameImage` for many cell and image aspect ratios returns a source rect with the same aspect ratio as the cell (within 1e-6), always inside `[0,width]×[0,height]` (contract case 8).
  - `zoom:1, focus 0.5/0.5` crops centered on the longer axis.
  - A focus outside what can be reached is clamped, not rejected.
- [X] T011 [P] Write `src/state/useHistory.test.ts` (starting with `// @vitest-environment jsdom`, using `renderHook` and `act` from `@testing-library/react`):
  - `commit` pushes to `past` and clears `future`.
  - `undo` and `redo` round-trip.
  - Several `preview` calls followed by `endGesture` make exactly **one** history entry, whose undo returns the pre-gesture doc (FR-037).
  - `endGesture` with no net change pushes nothing.
  - `cancelGesture` restores `gestureBase`.
  - `undo` is ignored while a gesture is in progress.
  - `past` is capped at **100** entries.
  - `referencedAssetsInHistory()` returns the union of assets across `past`, `present` and `future`.

### Implementation for Foundational

- [X] T012 Create `src/model/types.ts`. Copy the types exactly from [data-model.md](./data-model.md) §1:
  - `CanvasPreset = '9:16' | '1:1' | '4:5' | '16:9' | 'custom'`.
  - `CanvasSpec { preset; width; height }`.
  - `LayoutNode = CellNode | SplitNode`, with `SplitNode.direction: 'horizontal' | 'vertical'` and `ratio: number // 0 < ratio < 1, relative to parent region`.
  - `CellImage { assetId: string; zoom: number /* ≥ 1, max 8 */; focusX: number /* 0–1 */; focusY: number /* 0–1 */ }`.
  - `Style { gap /* 0–40 */; color /* #RRGGBB */; radius /* 0–100 */; padding /* 0–100 */ }`.
  - `Doc { canvas; layout; style }`, `NRect`, `PxCell { cellId; x; y; w; h; r }`, `Divider`, `MinSize`.
  - Constants: `DEFAULT_STYLE = { gap: 8, color: '#FFFFFF', radius: 0, padding: 0 }`, `ZOOM_MAX = 8`, `REF_SHORT_SIDE = 1080`.
  - `newId()`, using `crypto.randomUUID()` with a counter fallback.
- [X] T013 Implement the core of `src/model/layout.ts` so that T008 passes: `singleCell()`, `computeRects(tree): Map<string, NRect>`, `dividers(tree): Divider[]`, `cellsInReadingOrder(tree)`, `findNode(tree, id)`, `replaceNode(tree, id, node)`, `setCellImage(tree, cellId, image | undefined)`, `swapCellImages(tree, idA, idB)`, `setFraming(tree, cellId, patch)` and `referencedAssets(tree): Set<string>`.
- [X] T014 [P] Implement `src/model/geometry.ts` so that T009 passes:
  - `styleScale(sizePx) = Math.min(w, h) / 1080`.
  - `minSizeNorm(canvas, style)`: `max(0.05·dim, 40)` export px divided by the content-area size on each axis.
  - `layoutPixels(doc, sizePx): PxCell[]`: first inset by padding, then map normalized rects into the content area, then inset **only inner edges** by `gap/2`, then clamp the radius. All style values are multiplied by `styleScale`.
- [X] T015 [P] Implement `frameImage(cell: PxCell, asset: {width, height}, img: CellImage): {sx, sy, sw, sh}` and `resetFraming(): Pick<CellImage,'zoom'|'focusX'|'focusY'>` in `src/model/frame.ts` so that T010 passes. The source rect is `sw = cell.w / (coverScale·zoom)` and `sh = cell.h / (coverScale·zoom)`, centered on the clamped focus.
- [X] T016 Implement `src/state/useHistory.ts` so that T011 passes:
  - `useHistory(initial: Doc, reducer)` returns `{ doc, commit(action), preview(action), endGesture(), cancelGesture(), undo(), redo(), canUndo, canRedo, inGesture, referencedAssetsInHistory() }`.
  - Internally it's a `useReducer` over `{ past, present, future, gestureBase? }`, with `past` capped at 100.
- [X] T017 Create `src/state/docReducer.ts`:
  - `DocAction` discriminated union and `docReducer(doc, action): Doc`, delegating to model functions.
  - Initial actions: `setImage { cellId, assetId }` (sets `zoom:1, focusX:0.5, focusY:0.5`) and `setLayout { layout }`.
  - `initialDoc()` returns canvas `{ preset:'9:16', width:1080, height:1920 }`, `singleCell()` and `DEFAULT_STYLE`.
  - Later stories add more actions to this file.
- [X] T018 [P] Create `src/state/uiState.ts`: a `useReducer`-based `useUiState()` holding `mode: 'arrange' | 'draw'` (default `'arrange'`), `selectedDividerId?`, `focusedCellId?`, `stroke?: { axis; coord; span; snapGuide?; invalid: boolean }`, `previewOpen: boolean`, `exportSettings: { format: 'png' | 'jpg'; quality: number /* 10–100, default 92 */ }` and `toasts: { id; message; action?: { label; run } }[]`, with actions for each field and `pushToast` / `dismissToast`.
- [X] T019 [P] Implement `src/state/imageStore.ts` as a module-level singleton, **outside React state and history**:
  - `loadImage(file: File, maxSide: number): Promise<ImageAsset>`:
    1. Reject if `!file.type.startsWith('image/')`.
    2. Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`. If decoding fails, throw `ImageLoadError`.
    3. If `max(w,h) > maxSide`, draw it scaled onto a canvas (OffscreenCanvas if available).
    4. Re-encode once: `image/png` if the source type is png, webp or gif, otherwise `image/jpeg` at 0.92.
    5. Make `url = URL.createObjectURL(blob)` and create a fresh `ImageBitmap` from the blob.
    6. Return `{ id, url, bitmap, width, height, downscaledTo? }`, where `downscaledTo = maxSide` is set only if step 3 actually scaled the photo down.
  - `getAsset(id)`.
  - `releaseUnreferenced(referenced: Set<string>)`: for every stored id not in `referenced`, call `URL.revokeObjectURL(url)` and `bitmap.close()`, then delete it (research R10).
  - `maxSideFor(canvas) = Math.max(canvas.width, canvas.height, 2048)`.
- [X] T020 [P] Implement `src/input/useGestures.ts`. It's a hook that returns pointer handlers for an element and supports these callbacks: `onTap(p)`, `onDoubleTap(p)`, `onDragStart(p)`, `onDragMove(p, delta, totalDelta)`, `onDragEnd(p)`, `onPinch(scale, center)`, `onPinchEnd()`, `onWheel(factor, p)` and `onCancel()`.
  - Call `setPointerCapture` on pointerdown and keep a `Map<pointerId, point>`.
  - Movement under **6 px** counts as a tap.
  - A double tap is two taps within **300 ms and 10 px**.
  - Two pointers start a pinch around the midpoint.
  - Throttle move callbacks with `requestAnimationFrame`.
  - Wheel is a **non-passive** listener with `preventDefault`, where `factor = Math.exp(-deltaY * 0.0015)`.
  - Escape during a drag calls `onCancel`.
- [X] T021 [P] Create `src/components/Toasts.tsx` and `Toasts.module.css`. Toasts appear in an `aria-live="polite"` region at the bottom center, with an optional action button (for example "Undo" or "Preview") and a close button with `aria-label="Dismiss"`. They disappear after 6 s.
- [X] T022 [P] Create `src/components/Cell.tsx` and `Cell.module.css`, which render one `PxCell` in preview pixels:
  - It's an absolutely positioned `<div role="button" tabIndex={0}>` with `overflow:hidden` and `border-radius` taken from `PxCell.r`.
  - `aria-label` is "Empty cell N — press Enter to add a photo" or "Photo in cell N".
  - A filled cell shows an `<img draggable={false}>` from `getAsset(assetId).url`. Its position and size come from a CSS transform derived from `frameImage`: the img size is `asset.width·k × asset.height·k` with `k = cell.w / sw`, translated by `(-sx·k, -sy·k)`.
  - An empty cell shows a "+" prompt.
- [X] T023 Create `src/components/Editor.tsx` and `Editor.module.css`, the canvas surface:
  - It measures its container with a `ResizeObserver` and fits the largest rectangle with the canvas aspect ratio, with 16 px margins.
  - It renders the background as `style.color`, and each cell from `layoutPixels(doc, previewSize)` using `<Cell>`.
  - The surface has `touch-action: none` and `user-select: none`.
  - It exposes `previewSize` to its children through props.
- [X] T024 Create `src/App.tsx` and `App.module.css`, the app shell:
  - A header with the text "SplitFrame", a toolbar slot at the top, `<Editor>` in the center, a side panel slot on the right and `<Toasts>`.
  - It wires `useHistory(initialDoc(), docReducer)` and `useUiState()`.
  - After every history change it runs a `useEffect` that calls `imageStore.releaseUnreferenced(referencedAssetsInHistory())`.

**Checkpoint**: `npm test` passes T008–T011. `npm run dev` shows "SplitFrame" with one empty 9:16 cell.

---

## Phase 3: User Story 1 - Make a collage from a preset layout and export it (Priority: P1) 🎯 MVP

**Goal**: Choose a canvas shape and a preset, add a photo to each cell (cover fit), and download a full-resolution PNG or JPG.

**Independent Test**: Choose 9:16 and "2 columns", add two photos and export a PNG. The file is named `splitframe-YYYYMMDD-HHmm.png`, is exactly 1080×1920, and both photos fill their halves ([quickstart](./quickstart.md) phases 1, 2.1–2.2 and 6).

### Tests for User Story 1 (write first, make sure they fail)

- [X] T025 [P] [US1] Write `src/model/presets.test.ts`:
  - For each of `'cols2' | 'cols3' | 'cols4' | 'rows2' | 'rows3' | 'grid2x2'`, `buildPreset` gives the expected cell count (2, 3, 4, 2, 3, 4), rectangles with equal areas (within 1e-9), full coverage and no overlaps (contract case 1).
  - `applyPreset` on a tree with 3 photos → `cols2` keeps the first 2 photos in reading order and returns `droppedImages: 1`.
- [X] T026 [P] [US1] Write `src/render/planDraw.test.ts`:
  - For a 2-column 1080×1920 doc with gap 20 and padding 0, the first op is `{op:'fill', color}`, followed by clip ops with rects `{0,0,530,1920}` and `{550,0,530,1920}` (contract case 7).
  - An empty cell makes a clip with no image op.
  - An image op's `src` equals `frameImage(...)` for that cell.
  - The plan at 540×960 equals the 1080×1920 plan scaled by 0.5, within 1% of the canvas size (SC-003, SC-010).
  - Shaped cells (research R22): a doc with one diagonal path split gives `clip` ops carrying `path` (px) and `image` ops whose `dest` is the cell's bounding box, and one `{op:'stroke', points, width, color}` per divider after all cells. For contract case 7, filter the ops to `clip` before comparing rects.
- [X] T027 [P] [US1] Write `src/render/filename.test.ts`: `exportFilename(new Date(2026, 8, 3, 9, 5), 'png') === 'splitframe-20260903-0905.png'`, using local time, zero-padded, 24-hour clock. The `'jpg'` format gives the `.jpg` extension.

### Implementation for User Story 1

- [X] T028 [P] [US1] Implement `src/model/presets.ts` so that T025 passes:
  - `CANVAS_PRESETS = { '9:16': [1080,1920], '1:1': [1080,1080], '4:5': [1080,1350], '16:9': [1920,1080] }`.
  - `buildPreset(kind)`: N columns chain `'vertical'` splits with ratios `1/N`, then `1/(N−1)` of the rest, and so on. Rows use `'horizontal'`. `grid2x2` is one horizontal split at 0.5 with a vertical split at 0.5 in each half.
  - `applyPreset(tree, kind): { tree, droppedImages }` moves photos over in reading order.
- [X] T029 [US1] Add these actions to `src/state/docReducer.ts`:
  - `setCanvasPreset { preset }`: sets the width and height from `CANVAS_PRESETS` and leaves the layout untouched.
  - `setCustomSize { width, height }`: only valid when both values are integers "Custom: 100–8000". Otherwise the action is a no-op, and the caller shows the message.
  - `applyPreset { kind }`.
- [X] T030 [US1] Create `src/components/Toolbar.tsx` and `Toolbar.module.css`, with the **aspect ratio** group and the **layout presets** group:
  - The aspect group has buttons for 9:16, 1:1, 4:5 and 16:9, marked with `aria-pressed`. A Custom button reveals W and H number inputs (min 100, max 8000). Invalid values show an inline message "Enter whole numbers from 100 to 8000", and the previous size is kept.
  - Preset buttons each have a small inline SVG icon and an `aria-label`, such as "3 columns".
  - Each change is a `commit`. When `applyPreset` drops photos, show the toast "N photos didn't fit the new layout" with an Undo action.
  - When the chosen Custom size leaves cells below the minimum, show the note "Some cells are smaller than the minimum size." If any photo in use has `downscaledTo < maxSideFor(newCanvas)`, show the toast "Re-add photos for full sharpness at this size."
  - Place it in the toolbar slot of `src/App.tsx`.
- [X] T031 [US1] Add photo input to `src/components/Cell.tsx`:
  - A hidden `<input type="file" accept="image/*">`. Clicking, tapping, or pressing Enter/Space on an **empty** cell in `arrange` mode opens it.
  - Handle `dragover` and `drop`: use only the **first** file.
  - Then call `imageStore.loadImage(file, maxSideFor(canvas))` and `commit({type:'setImage', cellId, assetId})`.
  - If `ImageLoadError` is thrown, show the toast "That file couldn't be opened as an image." and leave the cell unchanged.
  - Add a drag-over highlight style in `Cell.module.css`.
- [X] T032 [P] [US1] Implement `exportFilename(date, format)` in `src/render/filename.ts` so that T027 passes.
- [X] T033 [US1] Implement `planDraw(doc, assets: (id) => {width,height} | undefined, sizePx): DrawOp[]` in `src/render/planDraw.ts` (pure) so that T026 passes. `DrawOp` = `{op:'fill', color, rect}` | `{op:'clip', rect, r}` | `{op:'image', assetId, src:{sx,sy,sw,sh}, dest:rect}` | `{op:'restore'}`.
  - Emit `{op:'clip', rect, r, path?}` (`path` for shaped cells, from `PxCell.polygon`) and, after all cells, `{op:'stroke', points, width: gap × scale, color: style.color}` for every straight and path divider (research R22).
- [X] T034 [US1] Implement `renderCollage(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, doc, sizePx)` in `src/render/renderCollage.ts`:
  - It runs `planDraw` and executes each op.
  - `clip` uses `save`, `beginPath`, `roundRect` and `clip`. If `roundRect` is missing, it falls back to a manual arc path.
  - `image` uses `drawImage(getAsset(id).bitmap, sx, sy, sw, sh, dx, dy, dw, dh)`.
  - Set `imageSmoothingQuality = 'high'`.
  - A `clip` op with `path` builds the clip from `moveTo`/`lineTo` over the polygon. A `stroke` op draws the polyline with `lineWidth = width`, `lineCap = lineJoin = 'round'` and `strokeStyle = color`.
- [X] T035 [US1] Implement `exportCollage(doc, settings): Promise<void>` in `src/render/exportCanvas.ts`:
  1. The size is exactly `canvas.width × canvas.height`.
  2. On WebKit (`/AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(...)`), if `w·h > 16_777_216`, throw `ExportError('too-large')`.
  3. Use `OffscreenCanvas` + `convertToBlob` if available, otherwise a detached `<canvas>` + `toBlob`.
  4. The type is `image/png`, or `image/jpeg` with `quality/100` (quality range 10–100, default 92).
  5. A `null` blob or a thrown error becomes `ExportError`.
  6. Download through a temporary `<a download={exportFilename(new Date(), format)}>`, click it, then revoke the object URL right after.
  7. Nothing is downloaded when it fails (FR-035).
- [X] T036 [US1] Add the **Export** group to `src/components/Toolbar.tsx`:
  - A PNG/JPG format toggle.
  - A JPG quality slider (range 10–100, default 92) that shows only when JPG is selected, with a visible value and a label.
  - A "Download" button that calls `exportCollage`, shows a busy state while it runs, and catches `ExportError`. On error it shows the toast "Export failed — try a smaller canvas size."
  - Settings are stored in `uiState.exportSettings`.

**Checkpoint**: US1 is fully usable. Presets, aspect ratios, upload/drop and export all work, and T025–T027 pass.

---

## Phase 4: User Story 2 - Position photos inside cells (Priority: P1)

**Goal**: Pan, zoom and reset a photo inside its cell, with Replace, Remove and Reset actions. The export matches the framing.

**Independent Test**: Put a landscape photo in a tall cell, pan it sideways, zoom in and export. The file shows exactly the framing seen in the editor ([quickstart](./quickstart.md) phase 2.3–2.5).

### Tests for User Story 2

- [X] T037 [P] [US2] Extend `src/model/frame.test.ts`:
  - After any `panBy`, `frameImage` still stays inside the image bounds.
  - `zoomAt` clamps zoom to **[1, 8]**.
  - `zoomAt(factor, point)` keeps the image point under `point` fixed (within 0.5 px) when not clamped.
  - Zooming below 1 gives exactly 1, meaning cover (FR-023).

### Implementation for User Story 2

- [X] T038 [US2] Implement `panBy(img, dxPx, dyPx, cell, asset): CellImage` and `zoomAt(img, factor, pointPx, cell, asset): CellImage` in `src/model/frame.ts` so that T037 passes. Clamp the focus so the crop always stays inside the image, and clamp zoom so that "`zoom` ≥ 1 … upper limit 8".
- [X] T039 [US2] Add these actions to `src/state/docReducer.ts`: `setFraming { cellId, patch }`, `resetFraming { cellId }` and `removeImage { cellId }`.
- [X] T040 [US2] Wire `useGestures` into `src/components/Cell.tsx` for **filled** cells in `arrange` mode:
  - Attach the Cell gesture handlers only when `uiState.mode === 'arrange'`. In draw mode the Cell has no pointer handlers, so events go to the Editor surface.
  - Drag calls `preview(setFraming(panBy(...)))`, and drag end calls `endGesture()`.
  - Pinch calls `preview(setFraming(zoomAt(...)))`, and pinch end calls `endGesture()`.
  - Wheel calls `preview(zoomAt)`, then `endGesture()` after a **300 ms** pause, so a whole wheel burst is one undo step.
  - Double tap or double click calls `commit(resetFraming)`.
  - Escape calls `cancelGesture()`.
- [X] T041 [US2] Add a cell action menu to `src/components/Cell.tsx` and `Cell.module.css`:
  - On a filled cell, a small "⋯" button (`aria-label="Photo options"`) and Enter/Space on the focused cell both open a menu with **Replace** (opens the file picker, then `setImage` with the default fit), **Remove** (`removeImage`) and **Reset position** (`resetFraming`).
  - The menu closes with Escape and when you click outside it. Focus goes back to the cell.
  - Delete/Backspace on a focused filled cell calls `removeImage`.
- [X] T042 [US2] Photo swap (optional, FR-028) in `src/components/Cell.tsx`:
  - In `arrange` mode, pressing and holding a filled cell for **350 ms** without moving starts a swap drag. A ghost thumbnail follows the pointer and target cells are highlighted.
  - Releasing over another cell calls `commit(swapCellImages)`, and both photos get the default fit.

**Checkpoint**: US1 and US2 work. Framing survives export, and each gesture is one undo step (you can check this with `history.undo` in dev tools).

---

## Phase 5: User Story 3 - Draw your own lines, straight or freehand (Priority: P2)

**Goal**: In Draw lines mode, strokes become straight dividers that run edge to edge and snap into place. They split every crossed cell at the same coordinate and follow the minimum-size rule, with a live preview that includes the new photo crop.

**Independent Test**: From a blank canvas, draw a rough vertical stroke near the middle (it snaps to 50%), then a horizontal stroke across only the right half. You get 3 rectangular cells ([quickstart](./quickstart.md) phase 3).

### Tests for User Story 3

- [X] T043 [P] [US3] Extend `src/model/layout.test.ts` with `splitAt` tests (contract cases 2 and 3):
  - A single split creates a split node with the right local ratio.
  - A horizontal stroke across 3 side-by-side cells splits all 3 at the same global y, and a 4th cell outside the span is unchanged.
  - When one target out of several would fall below `min`, it returns `{error:'too-small'}` and the input tree is unchanged.
  - A span that crosses no cell returns `{error:'no-target'}`.
  - A photo in a split cell moves to child `a`.
  - Child `a` keeps the target cell's id. Calling `splitAt` twice with the same `makeId` gives the same split-node id and the same `b` cell id for every target, and all ids in the tree stay unique.
  - `clear()` returns one cell holding the first photo in reading order.
- [X] T044 [P] [US3] Write `src/model/snap.test.ts` (contract case 6):
  - `snapCandidates` includes 1/3, 1/2 and 2/3 plus every parallel edge from `computeRects`, and leaves out the excluded split's own edge.
  - `snap` returns the nearest candidate within the threshold, with `guide.kind` set.
  - For equal distances, the priority is center > third > edge.
  - Nothing snaps outside the threshold.
  - `strokeToLine` picks `'horizontal'` when `|dx| > |dy|`, otherwise `'vertical'`. It returns `null` for strokes shorter than **6** screen px, and clamps the span to [0,1].

### Implementation for User Story 3

- [X] T045 [US3] Implement these in `src/model/layout.ts` so that T043 passes:
  - `splitAt(tree, axis, coord, span, min, makeId?): { tree } | { error: 'too-small' | 'no-target' }`, where `makeId(targetCellId, role: 'split' | 'b')` defaults to `newId()` and supplies the two new ids for each target. Child `a` keeps the target cell's id. Targets are leaves whose rect crosses `span` and strictly contains `coord`. Every target is checked before anything changes. Each target is replaced by `{type:'split', direction: axis, ratio: (coord − rect.start)/rect.size, a: {…leaf, photo kept}, b: newEmptyCell}`.
  - `clear(tree)`.
- [X] T046 [P] [US3] Implement `src/model/snap.ts` so that T044 passes: `snapCandidates(tree, axis, excludeSplitId?)`, `snap(raw, candidates, thresholdNorm)` and `strokeToLine(points, previewSize)`.
- [X] T047 [US3] Add these actions to `src/state/docReducer.ts`: `splitAt { axis, coord, span }` (a no-op when the model returns an error) and `clearLayout`.
- [X] T048 [US3] Add the **Custom** group to `src/components/Toolbar.tsx`:
  - A "Draw lines" toggle button (`aria-pressed`) that switches `uiState.mode` between `'draw'` and `'arrange'`. Entering draw mode keeps the current layout (FR-014).
  - A "Clear" button that calls `commit(clearLayout)` and is enabled only when the layout has more than one cell.
  - Keyboard shortcuts **D** and **A** switch modes, but not while focus is in a text or number input.
- [X] T049 [US3] Add a mode indicator to `src/components/Editor.tsx`: a pill above the canvas that says "Draw lines — drag to split" or "Arrange — drag to move photos". It's inside an `aria-live="polite"` region. The cursor is `crosshair` in draw mode.
- [X] T050 [US3] Add stroke handling to `src/components/Editor.tsx` (in `'draw'` mode), using `useGestures` on the surface:
  - Pointer priority is divider first (T056), then in draw mode the surface stroke, then in arrange mode the cell gesture (T040).
  - At stroke start, create a per-stroke id map keyed by `${targetCellId}:${role}`: `makeId = (id, role) => strokeIds.get(`${id}:${role}`) ?? set(newId())`. Pass it to every tentative `splitAt` and to the final commit, so the committed ids match the preview.
  - A tap does nothing (it doesn't open the picker).
  - On each drag move:
    1. Collect points and call `strokeToLine`.
    2. Snap the coordinate with `snap(raw, snapCandidates(doc.layout, axis), 8 / previewPxAlongAxis)`.
    3. Run `splitAt` on the **current doc without committing** to get a tentative tree or an error.
    4. Store `uiState.stroke = { axis, coord, span, snapGuide, invalid }`.
  - On release: if the stroke is valid, `commit({type:'splitAt', ...})`. Otherwise do nothing. Either way, clear the stroke.
  - Escape clears the stroke.
- [X] T051 [P] [US3] Create `src/components/StrokeOverlay.tsx` and `StrokeOverlay.module.css`, rendered by `Editor`:
  - While `uiState.stroke` is set, draw the tentative divider segments, one per target cell over its full span, as a 2 px accent line.
  - A dashed guide line with a small label ("Center", "⅓" or "Edge") shows when `snapGuide` is set.
  - When `invalid` is true, the line turns `var(--danger)` with a "Too small" label (FR-013).
  - It uses `pointer-events: none`.
- [X] T052 [US3] Add the live crop preview (FR-045) in `src/components/Editor.tsx`: while `uiState.stroke` is valid, render the cells from the **tentative tree** (`layoutPixels` of `{...doc, layout: tentativeTree}`), so photos in the split cells already show their new crop in child `a`. When the stroke is invalid or cleared, go back to `doc.layout`. Build the tentative tree with the stroke's `makeId` from T050, so cells keep the same React keys from frame to frame and aren't remounted.

### Freehand lines (clarification 2026-09-24; research R19–R25)

Tasks T043–T052 built straight horizontal/vertical drawing. These tasks add freehand lines: diagonal, bent and curved strokes that keep their smoothed shape, overshoot trimming and shaped cells. They are numbered T076+ because they were added after the original list; do them in the order shown.

- [X] T076 [US3] Extend `src/model/types.ts` (data-model §1): add `Pt { x; y }`; `PathSplitNode { type: 'path'; id; path: Pt[] /* ≥ 2 points, normalized to the PARENT region's bounding box; first and last on its boundary */; a: LayoutNode /* the LARGER piece */; b: LayoutNode /* the smaller piece */ }`; change `LayoutNode = CellNode | SplitNode | PathSplitNode`; add `Region { polygon: Pt[]; bbox: NRect; rect: boolean }`; add optional `polygon?: Pt[]` (px) to `PxCell`. Update every `switch`/`type === 'split'` walker in `src/model/layout.ts`, `src/model/presets.ts` and `src/state/useHistory.ts` so the project still type-checks (path nodes are walked like splits: `a` then `b`).
- [X] T077 [P] [US3] Write `src/model/polygon.test.ts` (contract case 10): `polygonArea`/`polygonBBox`/`pointInPolygon` on convex and concave (L-shaped) polygons; `segmentIntersection` including parallel and touching segments; `pathChords` returns only sub-paths between consecutive crossings whose midpoint is inside (overshoot dropped, dangling ends dropped, a wavy path gives several chords); `splitPolygonByChord` on the unit square with a diagonal gives two triangles of area 0.5 each, with an L-shaped chord gives a rectangle plus an L-shaped piece, on a non-convex polygon the two areas sum to the original, and it handles both chord ends on the same edge and a chord ending exactly on a vertex; `roundPolygon` leaves vertices turning ≤ 30° untouched, rounds a square's corners, and clamps the arc to half the shorter neighbouring edge.
- [X] T078 [P] [US3] Write `src/model/stroke.test.ts` (contract case 13): `isStraightStroke` returns `'vertical'` for a ±5 px wobbly line over 430 px and `'horizontal'` for a slightly tilted (≤ 5°) flat line, and `null` for a 30° diagonal, an L shape and a quarter-circle; `smoothStroke` reduces the maximum deviation of a noisy straight line, keeps an L's corner within 6 px of the original corner, never moves the endpoints, and returns fewer points than it got; `extendEnds` lengthens each end by 16 px along its end direction; `selfIntersects` is true for a figure-8 and false for an L and a gentle curve.
- [X] T079 [US3] Create the fixture `src/model/fixtures/referenceSketch.ts`, which exports the 7 strokes of the clarification sketch as point lists in content-area coordinates (0–1), read from the sketch: TL corner cut (top edge → left edge, overshooting both), long wobbly vertical at x ≈ 0.39, horizontal from x ≈ 0.32 (left of the vertical) to past the right edge at y ≈ 0.27–0.37, TR corner cut, L from the left edge at y ≈ 0.47 across to x ≈ 0.27 and down past the bottom, L from past the right edge at y ≈ 0.56 left to x ≈ 0.56 and down past the bottom, and BR corner cut. Then extend `src/model/layout.test.ts` (contract cases 9, 11, 12): `computeRegions` polygons tile [0,1]² for a tree mixing straight and path splits (areas sum to 1; point sampling on a 50×50 grid finds each point in exactly one region); the reference sketch run through `isStraightStroke` → (`splitAt` | `smoothStroke` → `extendEnds` → `splitByPath`) in order gives exactly **8** cells and the overshoot of stroke 3 leaves the left side unsplit; `splitByPath` returns `'self-crossing'`, `'no-target'` and `'too-small'` (tree unchanged) for the matching inputs; after a corner cut of a photo cell, the photo is in the larger piece (child `a`); after resizing an ancestor straight divider, the path-split regions still tile; `pathDividers` returns one entry per path node; ids stay stable with a shared `makeId`.
- [X] T080 [P] [US3] Implement `src/model/polygon.ts` so that T077 passes: `polygonArea`, `polygonBBox`, `pointInPolygon` (even-odd), `segmentIntersection`, `pathChords(path, poly)`, `splitPolygonByChord(poly, chord)` (piece 1 = chord + boundary walked forward from its end to its start; piece 2 = reversed chord + boundary from its start to its end; points closer than 1e-9 merged), and `roundPolygon(poly, r)`.
- [X] T081 [P] [US3] Implement `src/model/stroke.ts` so that T078 passes: `isStraightStroke(points)` ("within 5° of horizontal or vertical" and every point within "max(4 px, 3% of the stroke length)"), `smoothStroke(points)` (resample at 3 px, moving average over 5 points with endpoints fixed, RDP at ε = 0.6 px), `extendEnds(points, 16)` and `selfIntersects(points)`.
- [X] T082 [US3] Update `src/model/layout.ts` so that T079 passes:
  - Walk the tree carrying each region's polygon and bounding box: `computeRegions(tree)`; `computeRects` returns bounding boxes; `dividers` returns straight splits only; add `pathDividers(tree)`.
  - Path splits map their stored `path` from parent-bbox coordinates to content coordinates, then `splitPolygonByChord` the parent polygon; `a` is the larger piece.
  - `splitAt` only targets rectangular leaves (`region.rect === true`).
  - Add `splitByPath(tree, path, minArea, makeId?)` per the contract: per leaf, split along every chord from `pathChords` (later chords split whichever piece contains them), store each chord normalized to the region's bbox, put the larger piece in `a` (it keeps the target id and photo), check every new piece against `minArea`, and return `'self-crossing'` / `'no-target'` / `'too-small'` without changing the tree.
- [X] T083 [US3] Update `src/model/geometry.ts`: add `minAreaNorm(canvas, style)` = `s² / (contentW·contentH)` with `s = max(0.05 × canvas short side, 40)` (research R23); `layoutPixels` returns each cell's bounding box, and for shaped cells also `polygon` in px, rounded with `roundPolygon(poly, r)`. Rectangular cells keep the gap/2 insets from R15 (existing tests must still pass).
- [X] T084 [US3] Add the action `splitByPath { path: Pt[]; makeId?: MakeId }` to `src/state/docReducer.ts` (a no-op when the model returns an error).
- [X] T085 [US3] Update the stroke handling in `src/components/Editor.tsx` (research R20–R21):
  1. On each move, if `isStraightStroke(points)` gives an axis **and** every cell the straight line crosses is rectangular, use the existing straight pipeline (`strokeToLine` → `snap` → `splitAt`, snapping guides, draggable result).
  2. If it's straight but crosses a shaped cell, build a 2-point path at the snapped coordinate and use `splitByPath`.
  3. Otherwise: `smoothStroke` → `extendEnds(…, 16)` → convert to content coordinates → `splitByPath` with the per-stroke `makeId`.
  - Keep the draft's reason (`too-small`, `self-crossing`, `no-target`) for the overlay, render cells from the tentative tree (live crop, FR-045), and commit the same action on release.
- [X] T086 [P] [US3] Update `src/components/StrokeOverlay.tsx` and its CSS to draw freehand drafts as an SVG `<polyline>` of the smoothed, extended stroke (accent color, 2 px, round joins), turning `var(--danger)` when invalid with the label "Too small", "Lines can't cross themselves" or "Draw from edge to edge". Straight drafts keep the current segment and guide rendering.
- [X] T087 [US3] Render shaped cells in `src/components/Cell.tsx`: when `px.polygon` is set, the div sits at the bounding box with `clip-path: polygon(…)` in local px (so hit-testing follows the shape), the photo uses `frameImage` against the bounding box, and the CSS dashed outline is turned off (T088 draws it).
- [X] T088 [US3] Create `src/components/LineLayer.tsx` and `LineLayer.module.css`: an SVG layer above the cells, `pointer-events: none`, that draws (1) every divider (straight segments from `dividers` and paths from `pathDividers`, in preview px) as a stroke `gap × styleScale(preview)` wide in `style.color` with round caps and joins, and (2) the dashed outline of each empty shaped cell. Render it from `src/components/Editor.tsx`.

**Checkpoint**: US3 works on top of US1 and US2. T043–T044 and T077–T079 pass. Drawing the reference sketch in the browser gives 8 cells (SC-011).

---

## Phase 6: User Story 4 - Adjust and remove dividers, with undo/redo (Priority: P2)

**Goal**: Drag dividers (clamped and snapped), delete them (merge option A), and undo or redo everything with buttons and shortcuts.

**Independent Test**: With 2 columns, drag the divider to about 30/70, delete it, then press undo twice. The 2 equal columns come back. Build a nested grid, delete the main divider and undo once. Everything comes back ([quickstart](./quickstart.md) phase 4).

### Tests for User Story 4

- [X] T053 [P] [US4] Extend `src/model/layout.test.ts` (contract cases 4 and 5):
  - `resizeDivider` clamps so the **smallest leaf in a nested subtree** on either side stays ≥ `min`, and ratios in child subtrees keep their relative values.
  - `removeDivider` between two photo cells keeps `a`'s photo and returns `droppedImages: 1, removedDividers: 1`.
  - `removeDivider` whose sides are nested sub-grids (for example the right side has 3 rows) returns one cell with `removedDividers: 3` and the right `droppedImages`.
  - When `a` has no photos, the first photo in `b` is kept.
  - The result's cell has a new id.
  - `resizeDivider` on a layout where cells are already below `min` (for example after Custom 100×100) is a no-op for moves that would shrink the smaller side, and allowed for moves that make it bigger.
  - Also: `removeDivider` on a path split merges its subtree like a straight split, keeping the first photo from `a` (the larger piece), else `b`; `resizeDivider` refuses path-split ids (no-op) and, when it stretches shaped cells inside, clamps by bisection until every shaped cell still meets `minAreaNorm` (research R23).

### Implementation for User Story 4

- [X] T054 [US4] Implement these in `src/model/layout.ts` so that T053 passes:
  - `resizeDivider(tree, splitId, coord, min): LayoutNode`.
  - `removeDivider(tree, splitId): { tree, removedDividers, droppedImages, keptAssetId? }`. It replaces the whole split subtree with one cell and keeps the first photo in reading order from `a`, or from `b` if `a` has none (research R8, Q1 option A).
  - `removeDivider` accepts both node types. `resizeDivider` only accepts straight splits and applies the min-area bisection from T053 to shaped descendants.
- [X] T055 [US4] Add these actions to `src/state/docReducer.ts`: `resizeDivider { splitId, coord }` and `removeDivider { splitId }`. `removeDivider` returns the counts through a helper `removeDividerWithReport(doc, splitId)` so the caller can show a toast.
- [X] T056 [US4] Create `src/components/Divider.tsx` and `Divider.module.css`:
  - On pointerdown, call `stopPropagation()` so dragging a divider always wins over the cell or surface, in both modes.
  - It's a hit target centered on each `dividers()` entry, 12 px thick, or 24 px under `@media (pointer: coarse)`, positioned in preview px.
  - The cursor is `row-resize` for `'horizontal'` and `col-resize` for `'vertical'`.
  - `role="separator"` with `aria-orientation`, `aria-valuenow` (the ratio as a percentage), `aria-label="Divider"` and `tabIndex={0}`.
  - Drag uses `useGestures`: `preview(resizeDivider(snap(coord, snapCandidates(tree, axis, splitId), 8/previewPx)))`, then `endGesture` on release. It works in both modes.
  - Click or tap selects the divider (`uiState.selectedDividerId`) and shows a round **×** button (`aria-label="Remove divider"`) at its midpoint.
  - Arrow keys move it by **1%** (**10%** with Shift) through `commit(resizeDivider)`.
  - Only for straight dividers from `dividers()`. Path dividers get their hit targets in T057.
- [X] T057 [US4] Update `src/components/Editor.tsx`:
  - Render `<Divider>` for each `dividers(doc.layout)` entry above the cells.
  - Clicking an empty area of the surface clears the selection.
  - When a divider is selected, Delete/Backspace and the × button call `commit(removeDivider)`.
  - If `droppedImages > 0` or `removedDividers > 1`, show the toast "Merged — {removedDividers} dividers and {droppedImages} photo(s) removed" with an **Undo** action (FR-018, FR-019).
  - Path dividers (research R24): in `src/components/LineLayer.tsx`, add a second SVG group with `pointer-events: stroke` that draws each `pathDividers()` entry with a transparent hit stroke 12 px wide (24 px under `@media (pointer: coarse)`). Click or tap selects it (highlighted in the accent color) and shows the × handle at the path's midpoint; Delete/Backspace and × remove it the same way as straight dividers. Path dividers are not draggable and use the default cursor.
- [X] T058 [US4] Add the **Undo/Redo** group to `src/components/Toolbar.tsx`. It has buttons with `aria-label`s "Undo" and "Redo", disabled when `!canUndo` or `!canRedo`. In `src/App.tsx`, add a global `keydown` handler:
  - Ctrl/Cmd+Z → `undo()`.
  - Ctrl/Cmd+Shift+Z or Ctrl+Y → `redo()`.
  - It's ignored while focus is in a text or number input, or while `inGesture` is true.
  - Call `preventDefault` on the handled keys.

**Checkpoint**: US1–US4 work. The grid can be edited fully, and undo covers every doc change (SC-008).

---

## Phase 7: User Story 5 - Preview the finished collage (Priority: P2)

**Goal**: A clean dialog that matches the export, where each photo is cropped to its own cell shape, plus a shortcut once every cell is filled.

**Independent Test**: Fill a custom grid that has differently shaped cells. A toast offers Preview but doesn't open it. Preview shows no editor controls and matches the exported file ([quickstart](./quickstart.md) phase 7).

**Depends on**: US1's `planDraw`, `renderCollage` and `exportCollage` (T033–T035).

### Implementation for User Story 5

- [X] T059 [US5] Create `src/components/PreviewDialog.tsx` and `PreviewDialog.module.css`:
  - A `<dialog>` opened with `showModal()`, which gives a focus trap and `aria-modal`, with `aria-label="Collage preview"`.
  - It holds a `<canvas>` sized to fit 90% of the viewport at the canvas aspect ratio. The backing store is display size × `devicePixelRatio`.
  - It draws with `renderCollage(ctx, doc, backingSize)` when it opens and whenever the doc changes. No dividers, handles, prompts or selection are drawn.
  - The buttons are "Close" and "Export", where Export calls `exportCollage` with the current `exportSettings` and handles errors as in T036.
  - It closes with Escape, the Close button or a click on the backdrop. The editor state doesn't change.
- [X] T060 [US5] Add a "Preview" button (`aria-label="Preview collage"`) to `src/components/Toolbar.tsx`, between Undo/Redo and Export, that sets `uiState.previewOpen = true`. Render `<PreviewDialog>` from `src/App.tsx` when `previewOpen` is true.
- [X] T061 [US5] Add the "all cells filled" shortcut (FR-044) in `src/App.tsx`: after a `setImage` commit that makes the number of empty cells go from ≥1 to 0, show the toast "All cells filled" with a **Preview** action that opens the dialog. Don't open it automatically.

**Checkpoint**: US5 works. Preview and export match, which is covered by T026's scaling test and by the check in quickstart phase 7.4.

---

## Phase 8: User Story 6 - Style the collage (Priority: P3)

**Goal**: Gap, color, corner radius and outer padding with a live preview, scaled correctly in the export.

**Independent Test**: Set gap 20, radius 16, padding 30 and color white, then export. The file matches the preview in proportion ([quickstart](./quickstart.md) phase 5).

### Tests for User Story 6

- [X] T062 [P] [US6] Extend `src/model/geometry.test.ts`: `styleLimits(doc)` returns `maxGap ≤ 40` and `maxPadding ≤ 100`. At those limits, every cell from `layoutPixels(doc, exportSize)` is still at least 1 × 1 export px, including on a crowded 12-cell grid.

### Implementation for User Story 6

- [X] T063 [US6] Implement `styleLimits(doc): { maxGap, maxPadding }` in `src/model/geometry.ts` so that T062 passes.
- [X] T064 [US6] Add the action `setStyle { patch: Partial<Style> }` to `src/state/docReducer.ts`. Clamp the values with `styleLimits` and the ranges gap 0–40, radius 0–100, padding 0–100, and check that color matches `/^#[0-9A-Fa-f]{6}$/`.
- [X] T065 [US6] Create `src/components/StylePanel.tsx` and `StylePanel.module.css`:
  - Labeled range inputs for **Gap** (0 to `maxGap`), **Corner radius** (0–100) and **Padding** (0 to `maxPadding`), each with a visible number, plus a **Color** `<input type="color">`.
  - While a slider is being dragged it calls `preview(setStyle)`, and on `pointerup` or `change` it calls `endGesture()`, so one slider move is one undo step. Keyboard changes call `commit`.
  - Place it in the side panel slot of `src/App.tsx`.
- [X] T066 [US6] In `src/components/Editor.tsx` and `src/components/Cell.tsx`, check that the editor uses `style.color` for the surface background, gaps, padding and empty cells, and uses `PxCell.r` for the corner radius (preview scale = `previewShortSide / 1080`), so the editor matches the export for every style value.
  - For shaped cells, check that the rounded polygon (`PxCell.polygon`) is used for the clip path and that radius is approximate next to lines (FR-029).

**Checkpoint**: US6 works. Style changes show live, and the export matches in proportion.

---

## Phase 9: User Story 7 - Use on phones, tablets and with a keyboard (Priority: P3)

**Goal**: Complete a collage with touch only on a phone, and do the main actions with the keyboard only.

**Independent Test**: On a phone, choose a preset, draw a line, add photos, pinch-zoom one and export, all by touch. On a desktop, do the keyboard flow in [quickstart](./quickstart.md) phase 8.2.

### Implementation for User Story 7

- [X] T067 [US7] Make `src/components/StylePanel.tsx` and `StylePanel.module.css` work as a bottom sheet on phones. Under `@media (max-width: 767px)`, the side panel becomes a **bottom sheet** that opens with a "Style" button in the toolbar. It closes with Escape, a drag-down handle or tapping outside, and respects `env(safe-area-inset-bottom)`. The editor area resizes so the canvas stays fully visible.
- [X] T068 [P] [US7] Make `src/components/Toolbar.module.css` responsive. On narrow screens, the toolbar groups scroll horizontally in one row with `overflow-x: auto` and no page horizontal scroll. Every control's touch target is at least 44 × 44 px under `@media (pointer: coarse)`.
- [X] T069 [US7] Harden touch handling in `src/components/Editor.module.css`, `Cell.module.css` and `Divider.module.css`:
  - `touch-action: none` on the surface, cells and dividers.
  - `-webkit-touch-callout: none` and `-webkit-user-select: none`.
  - Prevent iOS double-tap zoom on the surface.
  - Check that pinch inside a cell never zooms the page, and that the page still scrolls outside the canvas (FR-039).
- [X] T070 [US7] Do a keyboard and accessibility pass across `src/App.tsx`, `src/components/Toolbar.tsx`, `Editor.tsx`, `Cell.tsx` and `Divider.tsx`. The Tab order must be toolbar → cells in reading order → dividers → style panel ([contracts/ui-interactions.md](./contracts/ui-interactions.md)). Every control needs an accessible name. The mode indicator must be announced. Every interactive element must show the global `:focus-visible` ring. Escape must close Preview, menus and the bottom sheet (FR-040).

- **UI refresh (2026-09-24, user request "more minimalist and responsive on phone")**: the toolbar and the side panel were replaced by a top bar, a bottom dock and Layout/Style/Export panels (side card on wide screens, bottom sheet on phones), and a Draw-mode pill with Done was added. See FR-038 and contracts/ui-interactions.md "Screen layout". T067 and T068 are covered by this new layout. Checked with headless screenshots at 1440×900 and iPhone 13 size.

**Checkpoint**: All user stories work on their own and together.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T071 [P] Write `README.md` at the repository root. It covers what SplitFrame is, the privacy promise (no network, photos stay on the device), the scripts (`dev`, `build`, `test`, `typecheck`, `lint`) and the supported browsers (the latest two versions of Chrome, Edge, Firefox and Safari, plus iOS/iPadOS Safari 16.4 or newer).
- [ ] T072 Performance pass in `src/components/Editor.tsx` and `Cell.tsx`:
  - Wrap `Cell` and `Divider` in `React.memo`, keyed by the cell id and a stable `PxCell`.
  - Memoize `layoutPixels` and `dividers` for each doc and preview size.
  - Check that dragging on a mid-range phone has no noticeable lag (SC-007). Use Chrome DevTools performance with 4× CPU throttling.
  - Measure the time from the Preview click until the first canvas paint for a 6-photo 1080×1920 collage with 4× CPU throttling. It must be under 1 s (SC-010). If it's slower, render at display size first and skip a second pass.
- [ ] T073 Memory check in `src/state/imageStore.ts`:
  - Log (dev only) the asset count after each `releaseUnreferenced`.
  - Check that replacing a photo 101 times keeps at most about 101 assets, and that the count drops once entries fall off the history cap.
  - Check that exporting 6 photos of 12 MP or more at 1080×1920 finishes in under 5 s with no crash on a phone (SC-006).
- [ ] T074 Privacy check. Run `npm run build` and confirm that `dist/index.html` contains the CSP meta tag with `connect-src 'none'`. Search `src/` for `fetch`, `XMLHttpRequest`, `sendBeacon` and `WebSocket` and find none. Do a full session with DevTools → Network open and see no requests beyond static assets (SC-005).
- [ ] T075 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`, and fix any failures. Then run every scenario in [quickstart.md](./quickstart.md), phases 1–8, and note any deviations in `specs/001-splitframe-collage-editor/checklists/requirements.md` under Notes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and **blocks all stories**.
- **US1 (Phase 3)**: after Foundational. This is the MVP.
- **US2 (Phase 4)**: after Foundational. It's independent of US1 for framing, but checking the framing in the export needs US1's export (T033–T035).
- **US3 (Phase 5)**: after Foundational. It works on a single cell, and presets from US1 are optional.
- **US4 (Phase 6)**: after Foundational. It needs dividers, so to try it out you need either US1 presets or US3 drawing.
- **US5 (Phase 7)**: **needs US1** (`planDraw`, `renderCollage`, `exportCollage`).
- **US6 (Phase 8)**: after Foundational. `layoutPixels` already applies style, so this story only adds the UI and limits.
- **US7 (Phase 9)**: after the stories it polishes (ideally all of them).
- **Polish (Phase 10)**: after all the stories you want in the release.

### Mapping to the brief's delivery phases (stop for review after each)

| Brief/plan phase | Tasks |
|------------------|-------|
| 1. Scaffold, model and tests, presets as empty cells | T001–T030 |
| 2. Upload, cover fit, pan/zoom | T031, T037–T042 |
| 3. Custom drawing (straight and freehand), snapping, minimum size | T043–T052, T076–T088 |
| 4. Divider resize, delete/merge, undo/redo | T053–T058 |
| 5. Style options | T062–T066 |
| 6. Full-resolution export | T025–T027 (tests only), T032–T036 |
| 7. Preview | T059–T061 |
| 8. Mobile and accessibility | T067–T070, then T071–T075 |

This task list follows user-story order, so export (T032–T036) is part of the US1 MVP. If you follow the brief's review order strictly instead, do T032–T036 after T066.

### Within each story

- Test tasks come before their implementation, and each test must fail first.
- Order within a story: `model/*` → `state/docReducer.ts` actions → components.
- **Same-file note**: `docReducer.ts`, `Toolbar.tsx`, `Editor.tsx`, `Cell.tsx` and `layout.ts` are edited by several stories. Tasks that touch the same file are never marked [P] relative to each other, and stories touching them should be merged one after another.

### Parallel Opportunities

- **Setup**: T002–T007 all in parallel, after T001.
- **Foundational**:
  - Tests T008–T011 in parallel.
  - Then T012 (types) → [T013, T014 [P], T015 [P]] alongside T016 → T017.
  - T018, T019, T020, T021 and T022 in parallel with the model work.
  - T023 → T024 last.
- **US1**: T025, T026 and T027 in parallel. T028 and T032 in parallel. T033 → T034 → T035 → T036.
- **US3**: T043 and T044 in parallel. T046 and T051 in parallel with T045. For freehand: T076 first, then T077 and T078 in parallel, then T079; T080 and T081 in parallel; then T082 → T083 → T084 → T085, with T086 in parallel; T087 → T088.
- Across stories, US3 model work (T043–T046) and US4 model tests (T053) can start as soon as Foundational is done, in parallel with US1 UI work, because they only touch `src/model/*.ts`. Merge the `layout.ts` edits one after another.

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "T025 Write src/model/presets.test.ts (preset counts, equal areas, applyPreset reading order)"
Task: "T026 Write src/render/planDraw.test.ts (2-col 1080×1920 gap 20 → {0,0,530,1920},{550,0,530,1920})"
Task: "T027 Write src/render/filename.test.ts (splitframe-20260903-0905.png)"

# Then independent implementations, together:
Task: "T028 Implement src/model/presets.ts"
Task: "T032 Implement src/render/filename.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T043 Extend src/model/layout.test.ts with splitAt cases"
Task: "T044 Write src/model/snap.test.ts"
# after tests:
Task: "T046 Implement src/model/snap.ts"
Task: "T051 Create src/components/StrokeOverlay.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 (US1): presets, aspect ratios, upload, cover fit, export.
3. **Stop and check**: quickstart phases 1, 2.1–2.2 and 6. The result is a usable preset collage maker.

### Incremental Delivery

1. US1 is the MVP: collages from presets.
2. US2 adds framing, so the collage looks right.
3. US3 adds custom drawing, the differentiator.
4. US4 adds divider editing and undo, so drawing is safe to experiment with.
5. US5 adds Preview.
6. US6 adds styling.
7. US7 is mobile and accessibility polish, followed by Phase 10.

Stop for review after each story's checkpoint, as the brief asks.

---

## Notes

- [P] means a different file with no unfinished dependency.
- The [USn] label ties a task to a story in spec.md.
- The FR-027 refinement (memory is released once no undo state refers to the photo) is carried out by T019 and T024. See plan.md "Changes to the spec and brief".
- Commit after each task or logical group, once the project is a git repository.
