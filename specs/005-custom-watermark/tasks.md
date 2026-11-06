# Tasks: Custom Watermark

**Input**: Design documents from `specs/005-custom-watermark/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/watermark-panel.md](./contracts/watermark-panel.md), [quickstart.md](./quickstart.md)

**Tests**: Included only for the pure logic that [quickstart.md](./quickstart.md) lists: `planTextMark` and the `setWatermark` reducer case. The panel, dragging and the match between canvas and file are checked by hand with quickstart.md.

**Organization**: Tasks are grouped by user story. The data model, the reducer action and the shared draw plan are foundational, because every story uses them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on unfinished tasks)
- **[Story]**: Which user story the task belongs to (US1–US4)

## Path Conventions

Single frontend project at the repo root: `src/model` (types), `src/render` (pure draw plans and canvas drawing), `src/state` (reducer, history, UI state), `src/components` (UI and CSS Modules). Vitest runs in `node` with globals.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm the baseline is green: run `npm run typecheck`, `npm run lint` and `npm test` from the repo root and record the test count (no file changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the watermark to the document, add one reducer action that validates it, add a pure draw plan, and draw it in exports and in the editor. **With empty text (the default), the app must look and export exactly as it does today.**

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Model and reducer

- [X] T002 In `src/model/types.ts`:
  - Add `export interface Watermark { text: string; color: string; opacity: number; size: number; rotation: number; x: number; y: number; repeat: boolean }`. Give each field a doc comment from [data-model.md §1](./data-model.md):
    - `text`: "'' = no watermark; ≤ 100 chars"
    - `color`: "'#RRGGBB', uppercase"
    - `opacity`: "0.1–1"
    - `size`: "text height ÷ canvas short side, 0.02–0.2"
    - `rotation`: "degrees, −90–90; |r| ≤ 3 snaps to 0"
    - `x`, `y`: "text center ÷ canvas width/height, 0–1 (Repeat: pattern offset)"
  - Add `watermark: Watermark` to `Doc`.
  - Export `DEFAULT_WATERMARK: Watermark = { text: '', color: '#FFFFFF', opacity: 0.5, size: 0.06, rotation: 0, x: 0.5, y: 0.5, repeat: false }`.
  - Export `WATERMARK_RANGES = { opacity: [0.1, 1], size: [0.02, 0.2], rotation: [-90, 90] } as const`, `WATERMARK_MAX_CHARS = 100`, `ROTATION_SNAP = 3` and `REPEAT_ROTATION = -30`.
- [X] T003 Fix every `Doc` literal the new required field breaks by adding `watermark: DEFAULT_WATERMARK`: `initialDoc()` in `src/state/docReducer.ts`, plus the test helpers in `src/model/geometry.test.ts`, `src/render/planDraw.test.ts`, `src/state/useHistory.test.ts` and `src/render/exportCanvas.test.ts`. Then run `npm run typecheck` and fix any other literal it reports, for example in `src/model/fixtures/` or `src/model/testUtils.ts`.
- [X] T004 [P] Add tests for `setWatermark` to `src/state/docReducer.test.ts` (they fail until T005):
  - text longer than 100 characters is cut to 100
  - opacity 0 → 0.1 and 2 → 1
  - size 0.5 → 0.2 and 0 → 0.02
  - rotation 120 → 90, −2 → 0 and 2.9 → 0 (snap), but 4 stays 4
  - x −1 → 0 and y 3 → 1
  - color `'#ff0000'` → `'#FF0000'`; `'red'` and `'#fff'` are ignored
  - a patch that changes nothing returns the same `doc` object (`toBe`)
  - `{ repeat: true }` with rotation 0 sets rotation −30; with rotation 15 it keeps 15
  - `{ repeat: false }` keeps rotation and x/y
  - `newCollage` on a doc with a photo and a watermark keeps `doc.watermark` unchanged
- [X] T005 In `src/state/docReducer.ts`:
  - Add `| { type: 'setWatermark'; patch: Partial<Watermark> }` to `DocAction`.
  - Implement it like `setStyle`: clamp each patched field with the T002 constants, and apply the color only if it matches `/^#[0-9A-Fa-f]{6}$/` (then uppercase it). Snap rotation to 0 when `|r| ≤ ROTATION_SNAP`, and slice text to `WATERMARK_MAX_CHARS`. When `repeat` goes false → true and the resulting rotation is 0, set rotation to `REPEAT_ROTATION`.
  - Return the same `doc` when every field is unchanged.
  - Confirm `newCollage` keeps `watermark` (it spreads `doc`, so no change is expected).
  
  T004 must pass.

### Draw plan and rendering

- [X] T006 [P] Write `src/render/textMark.test.ts` (fails until T007). Use a fake `measure = (text, px) => text.length * px * 0.5`:
  - empty text and whitespace-only text return `null`
  - single mark on 1080×1920 at sizePx 1080×1920 with x 0.25, y 0.75: `points` is `[{x: 270, y: 1440}]` and `fontPx` is `0.06 * 1080`
  - the same mark at sizePx 540×960 gives exactly half of the `fontPx` and the point coordinates (SC-502)
  - `angle` is `rotation * Math.PI / 180`, and `alpha` equals opacity
  - Repeat on 1080×1920, size 0.06, rotation −30, text "For verification only": for each canvas quarter, at least one point lies inside that quarter inset by half the text's rotated bounding box (SC-503)
  - Repeat with x moved by +0.1 shifts every point by +108 px in x (the pattern moves with a drag)
  - Repeat point count stays under 400 at the minimum size 0.02 on 8000×8000 (performance guard)
- [X] T007 Create `src/render/textMark.ts` with `export interface TextMarkOp { text; font; fontPx; color; alpha; angle; points: Pt[] }` and `export function planTextMark(mark: Watermark, canvas: {width: number; height: number}, sizePx: Size, measure: (text: string, fontPx: number) => number): TextMarkOp | null`, following [research C4](./research.md) and [data-model §3](./data-model.md):
  - `k = sizePx.w / W` and `fontPx = mark.size * min(W, H) * k`
  - the font comes from `watermarkFont(fontPx)` in `src/render/watermark.ts`
  - single: one point at `(x * sizePx.w, y * sizePx.h)`
  - repeat: a lattice with row step `dx = measure(text, fontPx) + 2*fontPx` and row spacing `dy = 2*fontPx`, built in the rotated frame around the surface center, shifted by `((x-0.5)*sizePx.w, (y-0.5)*sizePx.h)`, and keeping only points within `hypot(w, h)/2 + max(dx, dy)` of the center
  
  Make T006 pass.
- [X] T008 In `src/render/renderCollage.ts`:
  - Add `export function drawTextMark(ctx: Ctx, mark: Watermark, canvas, sizePx)`. It calls `planTextMark` with `ctx.measureText`, then inside `save/restore` sets the font, `fillStyle = color`, `globalAlpha = alpha`, `textAlign = 'center'` and `textBaseline = 'middle'`. For each point it does `translate`, `rotate(angle)`, `fillText(text, 0, 0)` and `setTransform` back to the saved transform; using `save/restore` per point is fine.
  - In `renderCollage`, call `drawTextMark(ctx, doc.watermark, doc.canvas, sizePx)` after the plan loop and **before** the credit (FR-513).
  - Update the header comment, which says "never by the editor".
- [X] T009 Rename `src/components/WatermarkLayer.tsx` → `src/components/MarkLayer.tsx` and `WatermarkLayer.module.css` → `MarkLayer.module.css`.
  - New props: `{ canvas: {width; height}; mark: Watermark; showCredit: boolean; size: Size }`.
  - The layout effect clears the backing canvas, calls `drawTextMark(ctx, mark, canvas, backing)`, then `drawWatermark(...)` only if `showCredit`. Its dependencies include `mark` and `showCredit`.
  - Keep `aria-hidden="true"` and `pointer-events: none` for now (dragging comes in US1).
  
  In `src/components/Editor.tsx`, import `MarkLayer`, rename the prop `showWatermark` → `showCredit`, and always render `<MarkLayer canvas={doc.canvas} mark={doc.watermark} showCredit={props.showCredit} size={previewSize} />` where the old layer was. Rename the prop at its one call site in `src/App.tsx` (`showCredit={panel === 'export' && ui.ui.exportSettings.watermark}`).

**Checkpoint**: `npm run typecheck`, `npm run lint` and `npm test` pass. With the default empty text, the editor, Preview and exports look identical to before. In the browser console, a temporary `commit({type:'setWatermark', patch:{text:'TEST'}})` (or a test) shows the text on the canvas and in a download.

---

## Phase 3: User Story 1 - Stamp an ID card photo with my own text (Priority: P1) 🎯 MVP

**Goal**: A Watermark panel where the user types text, sets color, opacity, size and rotation, and drags the text anywhere. It appears in Preview, Download and Share, and every change is undoable.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 1, plus steps 5 and 7.

- [X] T010 [P] [US1] In `src/components/icons.tsx`, add `export const WatermarkIcon` using the same `Icon` wrapper and stroke style as `StyleIcon`, for example a "T" over a diagonal line or a stamp shape, 20×20 viewBox.
- [X] T011 [US1] In `src/components/Dock.tsx`:
  - Extend `PanelName` to `'layout' | 'style' | 'watermark' | 'export'` and widen `onTogglePanel`'s parameter to `'layout' | 'style' | 'watermark'`.
  - Add `<Item label="Watermark" icon={<WatermarkIcon />} active={panel === 'watermark'} controls="watermark-sheet" onClick={() => onTogglePanel('watermark')} />` after Style.
  
  In `src/App.tsx`, add `watermark: 'Watermark'` to `TITLES`. Make sure opening any panel from the dock still leaves Draw mode the same way Layout and Style do (check `togglePanel`, and set `ui.setMode('arrange')` when opening Watermark if the others do it).
- [X] T012 [US1] Create `src/components/WatermarkPanel.tsx` with props `{ doc; commit; preview; endGesture }` (same as `StylePanel`), using `Panel.module.css` classes and following [contracts/watermark-panel.md](./contracts/watermark-panel.md):
  - **Text**: `<input type="text" maxLength={100} aria-label="Watermark text" placeholder="e.g. For verification by Bank X only">`, value `doc.watermark.text`. `onChange` → `preview({type:'setWatermark', patch:{text}})`; `onBlur` → `endGesture()` (research C8).
  - **Sliders** (`StylePanel`'s `dragging` ref pattern: `preview` while the pointer is down, `endGesture` on pointer up/cancel, `commit` for keyboard):
    - Size: 2–20, value `round(size*100)`, patch `size: v/100`
    - Rotation: −90–90, with an `<output>` showing `°`
    - Opacity: 10–100, value `round(opacity*100)`, patch `opacity: v/100`
  - **Color**: swatches `['#FFFFFF', '#111111', '#E53935', '#808080']` that `commit`, with `aria-pressed` and `aria-label="Color {hex}"`. Plus an `<input type="color">` that `preview`s on input and calls `endGesture` on its native `change` event, copying `StylePanel`'s `useEffect`.
  - **Center** button: `commit({setWatermark:{x:0.5,y:0.5}})`.
  - Every control except Text is `disabled` while `doc.watermark.text.trim() === ''`.
  
  Wire it in `src/App.tsx`: `{panel === 'watermark' && <WatermarkPanel doc={history.doc} commit={history.commit} preview={history.preview} endGesture={history.endGesture} />}`.
- [X] T013 [US1] Make the mark draggable in `src/components/MarkLayer.tsx`:
  - Add props `interactive: boolean`, `preview: (a: DocAction) => void`, `commit`, `endGesture` and `cancelGesture`.
  - Wrap the `<canvas>` in a `<div>` that fills the surface. When `interactive`, it has:
    - `pointer-events: auto`, `touch-action: none`, `tabIndex={0}`
    - `aria-label="Watermark position. Drag or use arrow keys to move."`
    - `{...{[SHEET_IGNORE_ATTR]: ''}}` (from `./Sheet`), so a press doesn't close the sheet
  - Otherwise it keeps `pointer-events: none` and `aria-hidden="true"`.
  - Pointer handling: on `pointerdown`, `setPointerCapture` and remember the start client point and `mark.x/y`. On `pointermove`, `preview({type:'setWatermark', patch:{x: x0 + dx/size.w, y: y0 + dy/size.h}})`. On `pointerup`, `endGesture()`; on `pointercancel`, `cancelGesture()`.
  - Keys: the arrow keys `commit` a ±0.01 move, ±0.1 with Shift, with `preventDefault`.
  - Add a `:focus-visible` outline in `MarkLayer.module.css`. Its z-index must stay above cells and lines but below divider handles and menus (keep `z-index: 3`), and while interactive it must sit above the cells' pointer targets. Check `Cell.module.css` and `Divider.module.css`; raise it only if a drag on a photo still pans the photo.
  
  In `src/components/Editor.tsx`, add an `editWatermark: boolean` prop and pass `interactive={props.editWatermark && doc.watermark.text.trim() !== ''}` along with the history callbacks. In `src/App.tsx`, pass `editWatermark={panel === 'watermark'}`.
- [X] T014 [US1] Run [quickstart.md](./quickstart.md) manual steps 1, 5 and 7 in `npm run dev` and on a phone (`npm run dev -- --host`): type, drag with a finger, style, PNG and JPG download match the canvas, and Undo steps back one change at a time. Fix what fails.

**Checkpoint**: US1 is fully usable on its own. This is the MVP.

---

## Phase 4: User Story 2 - Cover the whole image with repeating text (Priority: P1)

**Goal**: A Repeat switch that tiles the text across the canvas. Dragging shifts the pattern.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 2.

- [X] T015 [US2] In `src/components/WatermarkPanel.tsx`, add a **Repeat** switch using the same markup and classes as the 003 Watermark switch in `src/components/ExportPanel.tsx` (`role="switch"`, `aria-checked={doc.watermark.repeat}`, and a short hint: "Repeats the text across the whole image so it can't be cropped out"). `onClick` → `commit({type:'setWatermark', patch:{repeat: !repeat}})`. It is disabled while the text is empty. Place it right under the text box.
- [X] T016 [US2] Run [quickstart.md](./quickstart.md) manual step 2: tiles reach all four corners at −30°, dragging shifts the pattern, every quarter of the downloaded file shows the text, and turning Repeat off brings the single mark back where it was. Check that dragging Repeat on a phone has no visible lag (SC-504). If it lags, reduce the work in `drawTextMark`, for example by setting the font and style once outside the point loop.

**Checkpoint**: US1 and US2 both work.

---

## Phase 5: User Story 3 - Add today's date in one tap (Priority: P2)

**Goal**: An Add date button that appends the local short date.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 3.

- [X] T017 [US3] In `src/components/WatermarkPanel.tsx`, add an **Add date** button next to the text box (enabled even when the text is empty):
  - `const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date())`
  - `commit({type:'setWatermark', patch:{text: text.trim() ? `${text} · ${date}` : date}})` (research C9)
  
  The reducer cuts the result to 100 characters.

**Checkpoint**: US3 works on its own on top of the MVP.

---

## Phase 6: User Story 4 - Choose credit and watermark separately (Priority: P2)

**Goal**: The 003 switch is relabelled **SplitFrame credit** and works independently of the custom mark.

**Independent Test**: [quickstart.md](./quickstart.md) manual step 4.

- [X] T018 [P] [US4] In `src/components/ExportPanel.tsx`, change the switch's visible label from "Watermark" to "SplitFrame credit". The description text and the `aria-*` wiring stay the same.
- [X] T019 [P] [US4] In `src/components/PreviewDialog.tsx`, change its switch label from "Watermark" to "SplitFrame credit" the same way.
- [X] T020 [US4] Run [quickstart.md](./quickstart.md) manual step 4: credit off → custom mark only in Preview and the download; credit on → both, with the credit drawn on top.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T021 [P] Update `README.md`:
  - In Features, add a **Custom watermark** bullet: your own text, drag to place, color, opacity, size and rotation, Repeat across the image, and Add date, with the ID-card use case in one line.
  - Rename the existing Watermark bullet to **SplitFrame credit**.
- [X] T022 [P] In `specs/003-export-watermark/spec.md`, add a dated note under FR-209 that the switch is now labelled "SplitFrame credit" (feature 005, FR-516).
- [X] T023 Run [quickstart.md](./quickstart.md) manual steps 6 (shape change) and 8 (DevTools Network: no requests while stamping and exporting).
- [X] T024 Final gate: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all pass. The test count is the T001 baseline plus the new `textMark` and `setWatermark` tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: needs Phase 1, and blocks every story. Order: T002 → T003 → (T004 ∥ T006) → T005, T007 → T008 → T009.
- **US1 (Phase 3)**: needs Phase 2. T010 ∥ T011, then T012 → T013 → T014.
- **US2 (Phase 4)**: needs T012 (the panel exists). Rendering is already done in T007/T008.
- **US3 (Phase 5)**: needs T012.
- **US4 (Phase 6)**: needs Phase 2 only (labels). It can run in parallel with US1–US3.
- **Polish (Phase 7)**: after the stories you ship.

### User Story Dependencies

- US2 and US3 add controls to the panel US1 creates, but are otherwise independent of each other.
- US4 is independent of US1–US3.

### Parallel Opportunities

- Phase 2: T004 (reducer tests) ∥ T006 (textMark tests).
- Phase 3: T010 (icon) ∥ T011 (dock).
- Phase 6: T018 ∥ T019, and both can run any time after Phase 2.
- Phase 7: T021 ∥ T022.

## Parallel Example: Foundational

```text
Task: "T004 Add setWatermark tests in src/state/docReducer.test.ts"
Task: "T006 Write src/render/textMark.test.ts"
```

## Parallel Example: User Story 4

```text
Task: "T018 Relabel switch in src/components/ExportPanel.tsx"
Task: "T019 Relabel switch in src/components/PreviewDialog.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 → Phase 2 (the default output is unchanged; verify).
2. Phase 3 (US1) → **stop and validate** with quickstart steps 1, 5 and 7. This already covers a single ID stamp.

### Incremental Delivery

1. + US2 Repeat: the strongest protection for ID cards, so ship it soon after the MVP.
2. + US3 Add date.
3. + US4 credit label (tiny; it can ride along with any of the above).
4. Polish: README, the 003 note, and the final gate.
