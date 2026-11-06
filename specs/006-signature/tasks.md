# Tasks: Signature

**Input**: Design documents from `specs/006-signature/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/signature-ui.md](./contracts/signature-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Included only for the pure logic that [quickstart.md](./quickstart.md) lists: `normalizeStrokes`, `planSignature`, `removeBackground`, the signature reducer actions and `historyAssets`. The pad feel, real-photo background removal and the match between canvas and file are checked by hand.

**Organization**: Tasks are grouped by user story. The data model, reducer actions, placement plan, drawing and the drag target are foundational, because every story uses them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story the task belongs to (US1–US4)

## Path Conventions

Single frontend project at the repo root: `src/model` (types, pure geometry), `src/render` (pure pixel work and canvas drawing), `src/state` (reducer, history, image store), `src/components` (UI and CSS Modules). Vitest runs in `node` with globals.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm the baseline is green: run `npm run typecheck`, `npm run lint` and `npm test` from the repo root and record the test count (290 after feature 005; no file changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the signature to the document, with its actions, placement plan and drawing in exports and the editor overlay, plus a drag target that can be the text or the signature. **With no signature (the default), the app must look and behave exactly as after feature 005.**

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Model and reducer

- [X] T002 In `src/model/types.ts`, following [data-model.md §1](./data-model.md):
  - Add `export type SignaturePicture = { kind: 'strokes'; strokes: Pt[][]; aspect: number; lineWidth: number } | { kind: 'image'; assetId: string; aspect: number }`, with doc comments: "points 0–1 in the signature box", "box width ÷ height, > 0", "pen width ÷ box width, > 0", and "assetId: must exist in imageStore; cleaned PNG with transparent paper".
  - Add `export interface Signature { picture: SignaturePicture; keepColors: boolean; color: string; opacity: number; size: number; rotation: number; x: number; y: number }`, with doc comments:
    - `keepColors`: "image only: draw original colors instead of ink color"
    - `color`: "ink, '#RRGGBB', uppercase"
    - `opacity`: "0.1–1"
    - `size`: "signature WIDTH ÷ canvas short side, 0.1–0.8"
    - `rotation`: "degrees, −90–90; |r| ≤ 3 snaps to 0"
    - `x`, `y`: "center ÷ canvas width/height, 0–1"
  - Add `signature: Signature | null` to `Doc`.
  - Export `DEFAULT_SIGNATURE_PLACEMENT = { keepColors: false, color: '#111111', opacity: 1, size: 0.35, rotation: 0, x: 0.75, y: 0.85 }` (typed `Omit<Signature, 'picture'>`) and `SIGNATURE_RANGES = { opacity: [0.1, 1], size: [0.1, 0.8], rotation: [-90, 90] } as const`.
- [X] T003 Add `signature: null` to every `Doc` literal: `initialDoc()` in `src/state/docReducer.ts`, and the test helpers in `src/model/geometry.test.ts`, `src/render/planDraw.test.ts` and `src/state/useHistory.test.ts`. Then run `npm run typecheck` and fix anything else it reports.
- [X] T004 [P] Add a `describe('signature actions (feature 006, T004)')` to `src/state/docReducer.test.ts` (it fails until T006). Use a strokes picture `{ kind: 'strokes', strokes: [[{x:0,y:0.5},{x:1,y:0.5}]], aspect: 3, lineWidth: 0.02 }`. Cases:
  - `setSignaturePicture` on `initialDoc()` creates `{ picture, ...DEFAULT_SIGNATURE_PLACEMENT }`
  - after `setSignature({ x: 0.2, size: 0.5, color: '#1E3A8A' })`, a second `setSignaturePicture` with a different picture keeps x, size and color and swaps the picture
  - `setSignaturePicture` with `keepColors: true` sets it
  - clamping: size 0.05 → 0.1 and 0.9 → 0.8; opacity 0 → 0.1; rotation 2 → 0, −120 → −90, 10 stays 10; x −1 → 0; color `'#1e3a8a'` → `'#1E3A8A'`, and `'blue'` is ignored
  - `setSignature` with no signature returns the same `doc` (`toBe`); a no-op patch returns the same `doc`
  - `removeSignature` sets `null`; on a doc that already has `null` it returns the same `doc`
  - `newCollage` keeps `doc.signature` (`toBe`)
  - existing `setWatermark` tests still pass after the shared clamp refactor (no changes to them)
- [X] T005 [P] Write `src/model/signature.test.ts` (it fails until T007):
  - `normalizeStrokes([[{x:10,y:20},{x:110,y:70}]], 4)`: pad = 2 + 0.04·100 = 6, so the box is x 4–116, y 14–76 (w 112, h 62). Points become `{(10−4)/112, (20−14)/62}` and `{(110−4)/112, (70−14)/62}`, `aspect` is 112/62, and `lineWidth` is 4/112. Check each with `toBeCloseTo`.
  - Two strokes share one box (the max over all points).
  - A single point `[[{x:50,y:50}]]` with pen 4 gives a square box (`aspect` 1), with the point at 0.5/0.5.
  - `planSignature` on canvas 1080×1920 at surface 1080×1920 with size 0.35, x 0.75, y 0.85, aspect 3: `w` = 378, `h` = 126, `cx` = 810, `cy` = 1632.
  - At surface 540×960, every value is exactly half.
  - Rotation 30 → `angle` = π/6.
- [X] T006 In `src/state/docReducer.ts`:
  - Extract the number/color clamping from the `setWatermark` case into a module-level `clampPlacement<T extends { color: string; opacity: number; size: number; rotation: number; x: number; y: number }>(cur: T, patch: Partial<T>, ranges: { opacity; size; rotation }): T`. It handles color (`/^#[0-9A-Fa-f]{6}$/`, uppercase), opacity, size, rotation (clamp, then snap to 0 when `|r| ≤ ROTATION_SNAP`), and x/y in 0–1. Use it in `setWatermark`, which still handles `text` and `repeat` itself.
  - Add to `DocAction`: `| { type: 'setSignaturePicture'; picture: SignaturePicture; keepColors?: boolean } | { type: 'setSignature'; patch: Partial<Omit<Signature, 'picture'>> } | { type: 'removeSignature' }`.
  - Implement them per [data-model.md §2](./data-model.md). `setSignature` also takes `keepColors` from the patch. Each returns the same `doc` when nothing changes (compare every field; compare `picture` by reference).
  
  T004 must pass, along with all existing reducer tests.
- [X] T007 Create `src/model/signature.ts` with `normalizeStrokes(strokes: Pt[][], penPx: number)` and `planSignature(sig: Signature, canvas: {width: number; height: number}, sizePx: Size): { cx: number; cy: number; w: number; h: number; angle: number }`, exactly as in [data-model.md §3](./data-model.md) and [research S3, S4](./research.md). Make T005 pass.
- [X] T008 In `src/state/useHistory.ts`, make `historyAssets` also add `d.signature.picture.assetId` when `d.signature?.picture.kind === 'image'`, for every doc it scans. Add a test to `src/state/useHistory.test.ts` that builds a `History` whose past, present and future docs each hold a different signature image asset id, and expects all three in `historyAssets(h)`.

### Drawing and the drag target

- [X] T009 In `src/render/renderCollage.ts`, add `export function drawSignature(ctx: Ctx, sig: Signature | null, canvas: {width; height}, sizePx: Size): void` per [research S4, S7](./research.md):
  - `null` → return
  - otherwise `const p = planSignature(...)`, then `save`, `translate(p.cx, p.cy)`, `rotate(p.angle)`, `globalAlpha = sig.opacity`
  - **strokes**: `lineWidth = picture.lineWidth * p.w`, `strokeStyle = fillStyle = sig.color`, `lineCap = lineJoin = 'round'`. For each stroke, map points to `(x*p.w − p.w/2, y*p.h − p.h/2)`. One point → `arc` fill with radius lineWidth/2. Two points → `lineTo`. More → `moveTo(first)`, then for i = 1..n−2 `quadraticCurveTo(pt[i], mid(pt[i], pt[i+1]))`, then `lineTo(last)`, and `stroke()`.
  - **image**: `const asset = getAsset(picture.assetId)`; if missing, return. If `sig.keepColors`, `drawImage(asset.bitmap, −w/2, −h/2, w, h)`. Otherwise draw `tinted(asset, sig.color)`.
  - `tinted` is a module-level one-entry cache `{ key: assetId + color, canvas }`. On a miss, make an `OffscreenCanvas` (or a `document.createElement('canvas')` fallback) the size of the bitmap, fill it with the color, set `globalCompositeOperation = 'destination-in'`, and `drawImage(bitmap)`.
  - `restore`
  
  In `renderCollage`, call `drawSignature(ctx, doc.signature, doc.canvas, sizePx)` after `drawTextMark` and before the credit (FR-617). Update the file's header comment.
- [X] T010 Generalize `src/components/MarkLayer.tsx`:
  - Add a `signature: Signature | null` prop. In the layout effect, call `drawSignature(ctx, signature, canvas, backing)` between `drawTextMark` and the credit, and add `signature` to the dependencies.
  - Replace the `interactive: boolean` prop with `target: 'text' | 'signature' | null`. The layer is interactive when `target !== null`. The drag start and arrow keys read x/y from `target === 'text' ? mark : signature!`, and `move()` builds `{ type: 'setWatermark', patch: {x, y} }` or `{ type: 'setSignature', patch: {x, y} }`.
  - Change the `aria-label` to "Watermark position…" for text and "Signature position. Drag or use arrow keys to move." for the signature.
- [X] T011 Wire the tab and target:
  - `src/App.tsx`: add `const [markTab, setMarkTab] = useState<'text' | 'signature'>('text')`, and pass `markTab` and `setMarkTab` to `WatermarkPanel`. Replace `editWatermark={panel === 'watermark'}` with `markTarget={panel !== 'watermark' ? null : markTab === 'text' ? (history.doc.watermark.text.trim() ? 'text' : null) : (history.doc.signature ? 'signature' : null)}`.
  - `src/components/Editor.tsx`: replace the `editWatermark` prop with `markTarget: 'text' | 'signature' | null`, and pass `target={props.markTarget}` and `signature={doc.signature}` to `MarkLayer`.
  - `src/components/WatermarkPanel.tsx`:
    - Accept `tab` and `onTab` props, and render a `.segmented` control with **Text** and **Signature** buttons (`.segment`, `aria-pressed`) at the top. The Text tab renders the existing controls unchanged; the Signature tab is filled in by T013.
    - Move the existing `slider(...)` helper and the swatches row into local components or functions that take the value, the range and a `toPatch`/`onPick` callback, so the Signature tab can reuse them. Keep the text tab behaviour identical.

**Checkpoint**: `npm run typecheck`, `npm run lint` and `npm test` pass. With no signature, the editor, Preview and exports look as before, and the Text tab works exactly as in feature 005.

---

## Phase 3: User Story 1 - Draw my signature on the image (Priority: P1) 🎯 MVP

**Goal**: Draw a signature in a pad, place it, and style it. It appears in all outputs and is undoable.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 1 (and step 5).

- [X] T012 [P] [US1] Create `src/components/SignaturePadDialog.tsx` and `SignaturePadDialog.module.css` per [contracts/signature-ui.md](./contracts/signature-ui.md) and [research S9](./research.md). Props: `{ onDone: (picture: Extract<SignaturePicture, {kind: 'strokes'}>) => void; onCancel: () => void }`.
  - A native `<dialog>` opened with `showModal()` in an effect (copy `ConfirmDialog`). The `cancel` event (Escape) and a backdrop click call `onCancel`. Title "Draw your signature".
  - A `<canvas>` with `aria-label="Signature pad. Draw with your finger, mouse or pen."` and `touch-action: none`:
    - **Size**: phones (`innerWidth < 768`): width = dialog content width, height = min(width/2, 0.6·innerHeight). Desktop: width = min(720, 0.9·innerWidth), height = width/3. Recompute on `resize`.
    - **Backing store**: `devicePixelRatio`-scaled.
    - **Guides**: a faint baseline at 75% height from 8% to 92% width, a small "×" at its left, and centered "Sign here" text while there are no strokes. Guides are drawn but never exported.
  - **State**: `strokes: Pt[][]` in **pad-width units** (x and y divided by the pad's CSS width), so a resize just rescales them.
    - Pointer down: `setPointerCapture`, start a stroke.
    - Pointer move: for each of `e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]`, append the point and draw the segment from the previous point straight away (`lineTo`, round caps).
    - Pointer up: replace the stroke's points with `smoothStroke(pointsInPx)` converted back to units, then redraw everything with the same quadratic-midpoint routine as `drawSignature` (export the stroke-path helper from `renderCollage.ts`, or duplicate the ~10 lines in a shared function in `src/model/signature.ts`; pick one and use it in both).
  - **Pen width**: `max(2.5, padHeight · 0.018)` CSS px.
  - **Buttons**: **Undo stroke** (pop) and **Clear** (empty), both disabled when empty; **Cancel**; **Done** (primary, disabled when empty) calls `onDone(normalizeStrokes(strokesInPx, penPx))`.
  - None of this touches the document history (FR-606).
- [X] T013 [US1] Fill in the Signature tab in `src/components/WatermarkPanel.tsx` (it needs `doc.signature`, `commit`, `preview` and `endGesture`, already in props):
  - **No signature**: a primary **Draw signature** button and the note "Stays on your device and is forgotten when you close the page." The Upload button comes in T020.
  - **With a signature**:
    - Size slider 10–80 (`size*100`, patch `size: v/100`), Rotation −90–90, Opacity 10–100 (`opacity*100`), reusing the T011 slider helper with `setSignature` actions.
    - Ink color swatches `['#111111', '#FFFFFF', '#1E3A8A', '#E53935']` plus a picker, reusing the T011 swatches with `setSignature`. Hide them when `signature.keepColors`.
    - **Center** (`setSignature {x:0.5, y:0.5}`).
  - A local `const [pad, setPad] = useState(false)` opens `<SignaturePadDialog onDone={(p) => { commit({ type: 'setSignaturePicture', picture: p, keepColors: false }); setPad(false); }} onCancel={() => setPad(false)} />`.
- [X] T014 [US1] Check that the Sheet doesn't close when the pad dialog opens, or when you click inside it. The sheet's outside-press handler checks `ref.current.contains`, and the dialog is rendered inside the sheet's DOM, so it should already be safe. If a press inside the dialog still closes the sheet, add `SHEET_IGNORE_ATTR` to the dialog element.
- [X] T015 [US1] Run [quickstart.md](./quickstart.md) manual steps 1 and 5 in `npm run dev` and with a phone-size viewport. Fix what fails.

**Checkpoint**: US1 is fully usable on its own. This is the MVP.

---

## Phase 4: User Story 2 - Use a photo of my real signature (Priority: P1)

**Goal**: Upload a photo, remove the paper automatically, fine-tune with Sensitivity, optionally keep original colors, and place it.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 2.

- [X] T016 [P] [US2] Write `src/render/removeBackground.test.ts` (it fails until T017). A helper `img(w, h, fill: (x, y) => [r, g, b, a])` builds `{ data, width, height }`. Cases:
  - **Clean page**: a 200×100 white (245) page with a dark (30) bar at x 50–149, y 40–59. At sensitivity 50, bar pixels have alpha 255, paper pixels 0, and the `box` contains the bar and lies within the bar plus a margin of 3% of 100 = 3 px (clipped to the image).
  - **Warm light**: paper 185 and ink 60 give the same outcome at 50.
  - **Sensitivity**: on a 3-tone image (paper 240, a mid-grey 140 block, ink 30), sensitivity 100 keeps the grey block (alpha ≥ 128) and sensitivity 0 drops it (alpha < 128).
  - **Blank page**: an all-white (250) image gives `box: null`.
  - **Existing transparency**: pixels with input alpha 0 stay 0.
  - **Colors**: the R, G and B values of every pixel are unchanged.
- [X] T017 [US2] Create `src/render/removeBackground.ts` exporting `removeBackground(img: { data: Uint8ClampedArray; width: number; height: number }, sensitivity: number): { data: Uint8ClampedArray; box: { x: number; y: number; w: number; h: number } | null }` per [research S5](./research.md) and [data-model §3](./data-model.md):
  - Luminance `0.299R + 0.587G + 0.114B`.
  - A 256-bin histogram, then **Otsu** (maximize between-class variance), with the result clamped to 60–220.
  - `cutoff = otsu + (sensitivity − 50) · 1.2`.
  - `alpha' = round(alpha · clamp((cutoff − L) / 24 + 0.5, 0, 1))`, written into a copy of `data`.
  - The bounding box of `alpha' ≥ 128`, or `null` when fewer than `max(1, 0.0005 · w · h)` pixels qualify. Expand it by `ceil(0.03 · max(bw, bh))` and clip it to the image.
  
  Make T016 pass.
- [X] T018 [P] [US2] In `src/state/imageStore.ts`, add `export async function addAssetFromCanvas(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<ImageAsset>`. It encodes PNG with the existing `toBlob`, calls `createImageBitmap(blob)`, creates an object URL, registers the asset with `newId()` in `assets`, and returns it. Also export `makeCanvas` (it's currently module-private) for use by the upload dialog.
- [X] T019 [US2] Create `src/components/SignatureUploadDialog.tsx` and `SignatureUploadDialog.module.css` per [contracts/signature-ui.md](./contracts/signature-ui.md) and [research S6, S10](./research.md). Props: `{ assetId: string; inkColor: string; onDone: (picture: Extract<SignaturePicture, {kind: 'image'}>, keepColors: boolean) => void; onCancel: () => void }`.
  - On mount, `holdAsset(assetId)`. Build a **preview source** by drawing the asset bitmap to a canvas with a long side of at most 512 px and reading `getImageData` once.
  - **State**: `sensitivity` (50) and `keepColors` (false).
  - **Each change**: run `removeBackground` on the preview source, put the result on an offscreen canvas, and draw the cropped `box` region, fitted, onto the visible preview canvas. The visible canvas sits over a CSS checkerboard background (`background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px`). When `!keepColors`, tint the preview with `inkColor` using the same `destination-in` method.
  - **UI**: title "Use a photo of your signature"; a **Sensitivity** range 0–100; a **Keep original colors** `role="switch"` with the hint "On for a logo; off to recolor the ink."; the message "No signature found — try a higher sensitivity or a clearer photo" when `box` is null; **Cancel**; **Done** (disabled when `box` is null). A native `<dialog>`; Escape cancels.
  - **Done**:
    1. Draw the asset bitmap at a long side of at most 2048 px to a canvas.
    2. `getImageData`, run `removeBackground` at the current sensitivity, `putImageData`.
    3. Copy the `box` region into a new canvas of `box.w × box.h` and call `addAssetFromCanvas` on it.
    4. `onDone({ kind: 'image', assetId: newAsset.id, aspect: box.w / box.h }, keepColors)`.
    5. Finally, `dropHeld(assetId)` (the source is released by the next `releaseUnreferenced`).
  - **Cancel**: `dropHeld(assetId)`, then `onCancel()`.
- [X] T020 [US2] In `src/components/WatermarkPanel.tsx`:
  - Add an **Upload signature** button (the no-signature state) that clicks a hidden `<input type="file" accept="image/*">`.
  - On change: `loadImage(file, 2048)` (from `imageStore`). On `ImageLoadError`, call a `pushToast` prop with `e.message`; add `pushToast` to the props and pass `ui.pushToast` from `App.tsx`. On success, set `upload` state to the asset id, which renders `<SignatureUploadDialog assetId={...} inkColor={doc.signature?.color ?? DEFAULT_SIGNATURE_PLACEMENT.color} onDone={(p, keep) => { commit({ type: 'setSignaturePicture', picture: p, keepColors: keep }); setUpload(null); releaseUnused(); }} onCancel={() => { setUpload(null); releaseUnused(); }} />`.
  - Add a `releaseUnused` prop, passed from `App.tsx` as `() => releaseUnreferenced(referencedAssetsInHistory())`, the same as Editor's.
  - Reset the input's value after each pick, so the same file can be chosen again.
- [ ] T021 [US2] Run [quickstart.md](./quickstart.md) manual step 2 with real phone photos of a signature (blue and black pen) and a logo PNG. If SC-602 fails on typical photos, tune the Otsu clamp or the soft-edge width in `removeBackground.ts`, and update the expected values in T016's tests.

**Checkpoint**: US1 and US2 both work.

---

## Phase 5: User Story 3 - Change or remove the signature (Priority: P2)

**Goal**: Redraw, replace or remove an existing signature, keeping its placement.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 3.

- [X] T022 [US3] In the Signature tab's "with a signature" state in `src/components/WatermarkPanel.tsx`, add above the sliders:
  - A **thumbnail**: a 160×60 CSS px `<canvas>` (DPR-aware) that, in a layout effect on `doc.signature`, draws the signature with `drawSignature` (a copy with `x: 0.5, y: 0.5, rotation: 0`, sized to fit). Use a fake canvas of `{ width: 160, height: 60 }` (short side 60), with `size = min(144, 54 * aspect) / 60`, so the signature fills 90% of the thumbnail's width or height, whichever limits first. This copy is never committed, so the reducer's size range doesn't apply. It is `aria-hidden`.
  - **Redraw** (opens the pad), **Upload** (opens the file picker) and **Remove** (`commit({ type: 'removeSignature' })`).
  
  Because `setSignaturePicture` keeps placement, Redraw and Upload already keep the position, size, rotation, opacity and color.
- [X] T023 [US3] Run [quickstart.md](./quickstart.md) manual step 3.

---

## Phase 6: User Story 4 - Watermark and signature together (Priority: P2)

**Goal**: Both marks on one image, in the right order, with the tab deciding which one is dragged.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 4.

- [X] T024 [US4] Run [quickstart.md](./quickstart.md) manual steps 4 and 5. Confirm the draw order (pattern < signature < credit) in a downloaded PNG, and that switching tabs switches the drag target. Fix the order in `src/render/renderCollage.ts` or `src/components/MarkLayer.tsx`, or the `markTarget` logic in `src/App.tsx`, if it's wrong.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T025 [P] Update `README.md`. In Features, after the Watermark bullet, add a **Signature** bullet: draw it with a finger, mouse or pen, or upload a photo of your pen signature (the paper is removed automatically); place, size, rotate, fade and recolor it; use it together with a text watermark; never leaves the device and is forgotten when you close the page. Mention that a logo on a light or transparent background works the same way.
- [ ] T026 Run [quickstart.md](./quickstart.md) manual steps 6 (memory release), 7 (Network: no requests; reload clears the signature) and 8 (keyboard).
- [X] T027 Final gate: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all pass. The test count is the T001 baseline plus the new signature, `removeBackground`, reducer and history tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: needs Phase 1 and blocks every story. Order:
  - T002 → T003
  - then T004 ∥ T005
  - then T006, T007
  - then T008 ∥ T009
  - then T010 → T011
- **US1 (Phase 3)**: needs Phase 2. T012 can start as soon as T007 and T009 are done (it uses `normalizeStrokes` and the stroke path helper). Then T013 → T014 → T015.
- **US2 (Phase 4)**: needs Phase 2. T016 → T017, with T018 in parallel; then T019 → T020 → T021. It needs the Signature tab from T013 to add the Upload button.
- **US3 (Phase 5)**: needs T013 (pad wired). The Upload part needs T020.
- **US4 (Phase 6)**: needs US1 and the 005 watermark (already shipped).
- **Polish (Phase 7)**: after the stories you ship.

### Parallel Opportunities

- Phase 2: T004 ∥ T005 (tests); T008 ∥ T009.
- US1: T012 (pad dialog, new files) ∥ T011's panel refactor once T007 and T009 are done.
- US2: T016/T017 (pure background removal) ∥ T018 (image store); both are independent of the UI.
- Polish: T025 ∥ T026.

## Parallel Example: Foundational

```text
Task: "T004 Signature reducer tests in src/state/docReducer.test.ts"
Task: "T005 normalizeStrokes/planSignature tests in src/model/signature.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "T016/T017 removeBackground + tests in src/render/removeBackground.ts"
Task: "T018 addAssetFromCanvas in src/state/imageStore.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 → Phase 2 (no visible change; verify the Text tab still works).
2. Phase 3 (US1): draw, place, style, export. **Stop and validate** with quickstart steps 1 and 5.

### Incremental Delivery

1. + US2 Upload: the real pen signature, which most users will prefer, so ship it right after the MVP.
2. + US3 Redraw, Replace and Remove, with the thumbnail.
3. + US4 check (mostly free from Phase 2).
4. Polish: README, the memory, privacy and keyboard checks, and the final gate.
