# Tasks: Export Watermark

**Input**: Design documents from `specs/003-export-watermark/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/watermark.md](./contracts/watermark.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The project brief requires unit tests for logic modules, and [contracts/watermark.md](./contracts/watermark.md) lists guarantees that must each be unit-tested. Readability and the Story safe area are checked by hand with [quickstart.md](./quickstart.md).

**Organization**: Tasks are grouped by user story. Both stories are P1 and ship together. US1 (the credit) can be built and checked on its own because the default is on. US2 adds the switch.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Single frontend project at the repo root: `src/render` (pure drawing logic and export), `src/state` (UI state and hooks), `src/components` (UI and CSS Modules). Vitest runs in the `node` environment with globals (`describe`, `it`, `expect`, `vi`), as in `src/render/share.test.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing to initialize. No dependencies are added.

- [X] T001 Confirm the baseline is green: run `npm run typecheck`, `npm run lint` and `npm test` from the repo root and note any pre-existing failures (no file changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The new setting, plus a correct cache check for shared images (research W6, W7). Both stories depend on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `watermark: boolean` to `ExportSettings` in `src/state/uiState.ts`, with the doc comment `/** Adds the SplitFrame credit to Preview, Download and Share. Session only; default on (FR-210). */`. Set `exportSettings: { format: 'png', quality: 92, watermark: true }` in `initialUiState`. The `setExportSettings` reducer case needs no change, because a spread patch already handles a boolean. Data-model rule: "Session only; not saved and not in undo history (FR-210, FR-212)."
- [X] T003 [P] Write `src/render/exportCanvas.test.ts` for `sameExportInput`. Use one shared `doc` object; the `Doc` shape can be a cast `{} as Doc`, since only reference equality matters. Cases:
  - Same doc and same settings → `true`.
  - A different doc object → `false`.
  - A different `format` → `false`.
  - A different `watermark` → `false`.
  - PNG with a different `quality` → `true`.
  - JPG with a different `quality` → `false`.
- [X] T004 Add to `src/render/exportCanvas.ts`: `export function sameExportInput(a: { doc: Doc; settings: ExportSettings }, b: { doc: Doc; settings: ExportSettings }): boolean`, implementing exactly `a.doc === b.doc && a.settings.format === b.settings.format && a.settings.watermark === b.settings.watermark && (a.settings.format === 'png' || a.settings.quality === b.settings.quality)`. Add the doc comment `/** Whether two export requests produce the same file, so a rendered file can be reused (research W7). */`. Make T003 pass.
- [X] T005 In `src/state/useShare.ts`, delete the local `sameInput` function and its comment. In `getFile`, replace `sameInput(r, doc, settings)` with `sameExportInput(r, { doc, settings })`, where the `Rendered` entry already has `doc` and `settings` fields. Import `sameExportInput` from `../render/exportCanvas`. After this change, toggling Watermark invalidates a pre-rendered share file (spec edge case "Sharing from Preview").

**Checkpoint**: `npm run typecheck` and `npm test` pass (T003 green). The app behaves as before; nothing reads `watermark` yet.

---

## Phase 3: User Story 1 - Exported and shared images carry a small website credit (Priority: P1) 🎯 MVP

**Goal**: With the default settings, Download, Share and Preview all show "SplitFrame · splitframe.johansuryanto.dev" at the bottom center. It is sized to the canvas, readable on any background, and kept clear of the Story controls on 9:16. The editor never shows it.

**Independent Test**: A 9:16 collage with 3 photos, downloaded: the credit is at the bottom center, with its lowest pixel about 12% above the bottom edge, and readable on white and black photos. Preview shows the same thing and the editor shows nothing (quickstart #2–9).

### Tests for User Story 1

- [X] T006 [P] [US1] Write `src/render/watermark.test.ts` with a fake `measure = (text: string, fontPx: number) => text.length * 0.55 * fontPx`. Cover every row of the contract table:
  - `planWatermark({width:1080,height:1920}, {w:1080,h:1920}, measure)` → `fontPx` 27, `x` 540, `y` ≈ 1682.85 (`toBeCloseTo(1682.85, 2)`), `text === WATERMARK_TEXT`.
  - 1080×1080 → `y` ≈ 1040.85.
  - 2160×3840 vs 1080×1920 → `fontPx`, `x`, `y` and `shadow.blur` are exactly ×2.
  - `sizePx` half the export size (canvas 1080×1920, sizePx 540×960) → every length is exactly ×0.5 compared with the export plan.
  - 8000×400 → `fontPx` 10, not null.
  - 1080×1080 with `measure2 = (t, f) => 2 * measure(t, f)` → `measure2(text, fontPx) <= 0.9 * 1080 + 1e-9` and `fontPx < 27`.
  - 300×300 → `null`.
  - `watermarkFits` → `true` for 1080×1920, 1080×1080, 1920×1080 and 8000×400; `false` for 300×300 and 399×1000.
  - Font string → it starts with `` `600 ${fontPx}px` `` and contains `system-ui`.

### Implementation for User Story 1

- [X] T007 [US1] Create `src/render/watermark.ts` per [contracts/watermark.md](./contracts/watermark.md) and [data-model.md](./data-model.md). Header comment: `// The SplitFrame credit drawn on Preview and exported images. Pure: geometry comes from the export canvas and is scaled to the surface being drawn (FR-201 to FR-208; research W2).` It exports:
  - `WATERMARK_TEXT = 'SplitFrame · splitframe.johansuryanto.dev'`.
  - `watermarkFont(px: number): string` → `` `600 ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` ``. It is the one source of the font string, used by the op and by `renderCollage`'s measure.
  - `interface WatermarkOp { text; x; y; fontPx; font; color; shadow: { color; blur; offsetY } }`.
  - `watermarkFits(canvas)` → `0.025 * Math.min(canvas.width, canvas.height) >= 10`.
  - `planWatermark(canvas, sizePx, measure)`. With `W, H` = canvas size, `S = min(W, H)` and `k = sizePx.w / W`:
    1. `f0 = 0.025 * S`.
    2. `w0 = measure(WATERMARK_TEXT, f0)`.
    3. `f = w0 > 0.9 * W ? f0 * (0.9 * W) / w0 : f0`.
    4. Return `null` if `f < 10` ("the result is `null`… when the fitted `f < 10` export px").
    5. `margin = isStoryShape(canvas) ? 0.12 * H : 0.03 * S`, importing `isStoryShape` from `./share`.
    6. `baseline = H - margin - 0.25 * f`.
    7. `fontPx = f * k`.
    8. Return `{ text, x: sizePx.w / 2, y: baseline * k, fontPx, font: watermarkFont(fontPx), color: 'rgb(255 255 255 / 0.92)', shadow: { color: 'rgb(0 0 0 / 0.55)', blur: 0.35 * fontPx, offsetY: 0.06 * fontPx } }`.

  Keep the numbers as named constants at the top: `SIZE = 0.025`, `MIN_PX = 10`, `MAX_WIDTH = 0.9`, `STORY_MARGIN = 0.12`, `MARGIN = 0.03`, `DESCENT = 0.25`. Make T006 pass.
- [X] T008 [US1] Extend `renderCollage` in `src/render/renderCollage.ts` to `renderCollage(ctx, doc, sizePx, opts?: { watermark?: boolean })`. After the draw-plan loop, if `opts?.watermark`:
  1. `const op = planWatermark(doc.canvas, sizePx, (text, px) => { ctx.font = watermarkFont(px); return ctx.measureText(text).width; })`.
  2. If `op` is not null, draw it inside `ctx.save()`/`ctx.restore()`: set `ctx.font = op.font`, `textAlign = 'center'`, `textBaseline = 'alphabetic'`, `fillStyle = op.color`, `shadowColor = op.shadow.color`, `shadowBlur = op.shadow.blur`, `shadowOffsetX = 0`, `shadowOffsetY = op.shadow.offsetY`, then `ctx.fillText(op.text, op.x, op.y)`.

  Update the file header comment to mention the optional watermark. If `opts` is left out, the output is unchanged.
- [X] T009 [US1] In `src/render/exportCanvas.ts`, change `renderToBlob(doc, type, quality)` to also take `watermark: boolean`, and pass `{ watermark }` to both `renderCollage` calls (the OffscreenCanvas and `<canvas>` branches). In `renderExportFile`, call `renderToBlob(doc, type, quality, settings.watermark)`. Download and Share then both carry the credit (FR-211).
- [X] T010 [US1] In `src/components/PreviewDialog.tsx`, change the layout effect to call `renderCollage(ctx, doc, backing, { watermark: exportSettings.watermark })` and add `exportSettings.watermark` to its dependency array `[doc, display, exportSettings.watermark]`. Preview then matches the file (FR-211, SC-202). The editor is unchanged, because it never calls `renderCollage` (FR-215).

**Checkpoint**: US1 works with the default setting. Run `npm test` (T006 green), then quickstart #2–9.

---

## Phase 4: User Story 2 - Turn the watermark off for a clean image (Priority: P1)

**Goal**: A Watermark switch in the Export panel, on by default and accessible, turns the credit off for Download, Share and Preview together. Undo doesn't change it, and it resets on reload.

**Independent Test**: Open Export, switch Watermark off, then Download, open Preview and Share: none has the credit. Switch it on: all three have it. Reload: it's on. Undo doesn't flip it (quickstart #1, #10–14).

### Implementation for User Story 2

- [X] T011 [US2] Add the Watermark switch to `src/components/ExportPanel.tsx` as a new `<div className={styles.section}>` placed after the Quality section and before `<div className={styles.actions}>`.
  - Contents: `<button type="button" role="switch" aria-checked={settings.watermark} aria-describedby="watermark-desc" className={styles.switchRow} onClick={() => onChange({ watermark: !settings.watermark })}>`.
  - Inside the button: `<span className={styles.switchLabel}>Watermark</span>` and `<span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb} /></span>`.
  - After the button: `<p id="watermark-desc" className={styles.switchHint}>{watermarkFits(doc.canvas) ? 'Adds “SplitFrame · splitframe.johansuryanto.dev” at the bottom' : 'Too small for a watermark'}</p>`, importing `watermarkFits` from `../render/watermark`.
  - The button's accessible name comes from its text "Watermark", so the track needs no label (FR-209, FR-213, FR-208).
  - Update the component doc comment to mention the watermark.
- [X] T012 [US2] Add the switch styles to `src/components/Panel.module.css`:
  - `.switchRow`: `display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; padding: 0; border: 0; background: none; color: var(--text); font: inherit; font-weight: 600; cursor: pointer;`
  - `.switchTrack`: `position: relative; width: 40px; height: 24px; border-radius: 12px; background: var(--border-strong); transition: background 0.15s;`
  - `.switchThumb`: `position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.2); transition: transform 0.15s;`
  - `.switchRow[aria-checked='true'] .switchTrack { background: var(--text); }` and `.switchRow[aria-checked='true'] .switchThumb { transform: translateX(16px); }`
  - `.switchRow:focus-visible` with an outline matching other focusable panel controls (look for an existing `:focus-visible` rule in the file or `tokens.css` and reuse it).
    - *Done via the existing global `:focus-visible` rule in `src/styles/tokens.css`; no extra rule needed.*
  - `.switchHint { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }`
  - Wrap the transitions in `@media (prefers-reduced-motion: reduce) { .switchTrack, .switchThumb { transition: none; } }`.

**Checkpoint**: Both stories work. Run quickstart #1 and #10–14, including #11, which checks that the old image from Preview isn't reused after switching.

---

### Added after review (user request, 2026-09-24)

- [X] T019 [US2] Show the credit on the editing canvas **only while the Export panel is open** (FR-215 revised), so flipping the switch there has a visible effect. Export `drawWatermark` from `src/render/renderCollage.ts`. Add `src/components/WatermarkLayer.tsx` and `.module.css` (full strength, `inset: 0`, `z-index: 3`, `pointer-events: none`, `aria-hidden`, drawn at device pixel ratio). Add an Editor prop `showWatermark`, which `src/App.tsx` sets to `panel === 'export' && ui.ui.exportSettings.watermark`.
- [X] T018 [US1] Lower the 9:16 margin from 12% to 5% (`STORY_MARGIN = 0.05` in `src/render/watermark.ts`; test updated to `y ≈ 1920 − 96 − 6.75`), because at 12% the credit looked like it was floating. FR-203 updated.

- [X] T016 [US2] ~~Show a faint, non-interactive copy of the credit on the editing canvas~~. **Reverted the same day at the user's request:** the credit is hidden in the editor again (FR-215), `WatermarkHint.tsx`/`.module.css` were deleted, and `Editor.tsx` is unchanged from before this feature. Original task:
  - Export `drawWatermark(ctx, canvas, sizePx)` from `src/render/renderCollage.ts`.
  - Add `src/components/WatermarkHint.tsx` and `WatermarkHint.module.css`: a `<canvas aria-hidden>` with `inset: 0`, `z-index: 3`, `opacity: 0.55` and `pointer-events: none`, drawn at device pixel ratio.
  - Render it in `src/components/Editor.tsx` from a new `watermark` prop, passed by `src/App.tsx` from `ui.ui.exportSettings.watermark`.

- [X] T017 [US2] Add the Watermark switch to the Preview bar (FR-209a):
  - New prop `onExportSettingsChange` in `src/components/PreviewDialog.tsx`, passed from `src/App.tsx` as `ui.setExportSettings`.
  - A `<button role="switch" aria-checked>` with the label "Watermark", placed after the size label.
  - Dark-bar switch styles in `src/components/PreviewDialog.module.css`; the bar now wraps and is centered.
  - The reserved bar height is 112 px below 768 px wide, so the preview image still fits when the bar wraps.

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 [P] In `README.md`, add a Features bullet: "**Watermark**: a small 'SplitFrame · splitframe.johansuryanto.dev' credit at the bottom of exported and shared images, on by default; switch it off in Export." In the "Share to Story" section, add a sentence that the watermark is kept clear of Instagram's and WhatsApp's controls on 9:16.
- [X] T014 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, and fix anything they report in the files touched by T002–T013.
- [X] T015 Run the manual checks in `specs/003-export-watermark/quickstart.md` (#1–14). The phone Story checks (#8–9) need the HTTPS production site or a deploy preview. Record the results under a new "Results" heading at the bottom of that file. If the white-photo check (#4) shows the shadow isn't enough, apply the fallback from research W3 (a translucent pill behind the text) in `src/render/renderCollage.ts` and `src/render/watermark.ts`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: T002 blocks T009–T011, which read `settings.watermark`. T003→T004→T005 is the share-cache fix.
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: after Phase 2. T011 needs `watermarkFits` from T007, so in practice it follows US1. Both are P1 and ship together.
- **Polish (Phase 5)**: after both stories.

### Task-level dependencies

- T003 → T004 → T005
- T006 → T007 → T008 → T009, T010
- T002 → T009, T010, T011
- T007 → T011 → T012

### Parallel Opportunities

- T003 and T006 (two new test files) can be written in parallel, and alongside T002.
- T009 (`exportCanvas.ts`) and T010 (`PreviewDialog.tsx`) can run in parallel after T008. They aren't marked [P] because both depend on T008 in the same phase.
- T013 (README) can be done at any time.

---

## Parallel Example

```text
# In parallel:
Task T002: Add ExportSettings.watermark in src/state/uiState.ts
Task T003: Write src/render/exportCanvas.test.ts (sameExportInput)
Task T006: Write src/render/watermark.test.ts

# Then:
T004 → T005                    (share cache fix)
T007 → T008 → (T009 ∥ T010)    (credit drawn in export and Preview)
T011 → T012                    (switch)
```

---

## Implementation Strategy

### MVP First

1. T001, then Phase 2 (T002–T005).
2. US1 (T006–T010). The credit is on by default, so this is already visible and testable. **Don't ship without US2**: the spec requires an off switch.
3. US2 (T011–T012).
4. Polish (T013–T015), then deploy.

---

## Notes

- There are no network calls or web fonts (FR-214). The font is the system stack in `watermarkFont()`.
- Don't put `watermark` on `Doc`; it must stay out of undo history (FR-212).
- `renderCollage` without `opts` must draw exactly what it drew before, so any other caller keeps working.
- Commit after each task or logical group.
