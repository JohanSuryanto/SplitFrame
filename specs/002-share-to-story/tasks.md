# Tasks: Share to Story

**Input**: Design documents from `specs/002-share-to-story/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/share.md](./contracts/share.md), [quickstart.md](./quickstart.md)

**Tests**: The project brief requires unit tests for logic modules (see plan Constitution Check). The contract also requires the `shareFile` result mapping to be unit-tested, one case per row. So `src/render/share.test.ts` is included. UI and share-sheet behavior are checked by hand with [quickstart.md](./quickstart.md), because the OS share sheet can't be automated.

**Organization**: Tasks are grouped by user story, so each story can be built and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single frontend project at the repo root: `src/render` (pure browser logic next to export), `src/state` (hooks), `src/components` (UI + CSS Modules). Vitest runs in the `node` environment by default (`vite.config.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing to initialize. The project, tooling and test runner already exist from feature 001, and no dependencies are added (plan: "Primary Dependencies: none added").

- [X] T001 Confirm the baseline is green before changes: run `npm run typecheck`, `npm run lint` and `npm test` from the repo root and note any pre-existing failures (no file changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: One render path for Download and Share (research S6), and toast plumbing that can carry an action button. Every story depends on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Refactor `src/render/exportCanvas.ts` per [contracts/share.md](./contracts/share.md):
  - (a) Add `export async function renderExportFile(doc: Doc, settings: ExportSettings): Promise<File>`. Move into it the existing WebKit area guard (`throw new ExportError('too-large')`), the MIME/quality choice, `renderToBlob` with its catch that rethrows as `ExportError('failed')`, and the empty-blob check. Return `new File([blob], exportFilename(new Date(), settings.format), { type })`.
  - (b) Rename the private `download(blob, filename)` to `export function downloadFile(file: File): void`. It creates the object URL from the `File` and uses `file.name` as `a.download`, keeping the 1 s revoke timeout.
  - (c) Rewrite `exportCollage` as `downloadFile(await renderExportFile(doc, settings))`, keeping its doc comment "Nothing is downloaded on failure". Download behavior must be unchanged (FR-102, FR-104).
- [X] T003 [P] Add `ShareIcon` to `src/components/icons.tsx`, drawn with the same `Icon` wrapper as `DownloadIcon` (20×20, `currentColor`, stroke 1.6). Use a box with an up arrow, e.g. `<path d="M10 12.5V3M6.5 6.5 10 3l3.5 3.5M5 9.5H4.5A1.5 1.5 0 0 0 3 11v4.5A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5V11a1.5 1.5 0 0 0-1.5-1.5H15" />`.
- [X] T004 [P] Widen the `pushToast` prop type in `src/components/ExportPanel.tsx` and `src/components/PreviewDialog.tsx` from `(message: string) => void` to `(message: string, action?: Toast['action']) => void`, importing `Toast` from `src/state/uiState.ts`. `App.tsx` already passes `ui.pushToast`, which accepts an action, so it needs no change.

**Checkpoint**: `npm run typecheck` passes and Download works exactly as before in the dev server (quickstart #7 baseline).

---

## Phase 3: User Story 1 - Share a finished collage to a Story from the phone (Priority: P1) 🎯 MVP

**Goal**: A Share button in the Export panel opens the device share sheet with the exact Download image, so the user can post it to an Instagram Story or WhatsApp Status without saving it.

**Independent Test**: On a phone (HTTPS deploy preview), build a 9:16 collage with 3 photos, open Export, tap Share, pick Instagram → Story, then WhatsApp → My status. The collage appears in each editor and no file appears in Photos or Downloads (quickstart #1–7, #10–12).

### Tests for User Story 1

- [X] T005 [P] [US1] Write `src/render/share.test.ts` (Vitest, node env). Stub `globalThis.navigator` per test with `vi.stubGlobal('navigator', {...})` and restore it in `afterEach` with `vi.unstubAllGlobals()`. Cover every row of the contract mapping for `shareFile(file)`:
  - `navigator.canShare` missing → `'failed'`
  - `canShare` returns false → `'failed'`, and `share` is not called
  - `share` resolves → `'shared'`
  - rejects `new DOMException('x', 'AbortError')` → `'cancelled'`
  - rejects `new DOMException('x', 'NotAllowedError')` → `'needs-gesture'`
  - rejects `new TypeError()` → `'failed'`
  - rejects `new DOMException('x', 'DataError')` → `'failed'`

  Assert `share` is called with exactly `{ files: [file] }` (no title/text/url, research S8). For `canShareImages`:
  - true only when `canShare` returns true for the probe
  - false when `canShare` is missing
  - false when `canShare` throws
  - the probe `File` type is `image/png` for `'png'` and `image/jpeg` for `'jpg'`

  For `isStoryShape`: true for 1080×1920 and 720×1280, false for 1080×1080, 1920×1080 and 1080×1350.

### Implementation for User Story 1

- [X] T006 [US1] Create `src/render/share.ts` exporting:
  - `type ShareOutcome = 'shared' | 'cancelled' | 'needs-gesture' | 'failed'`
  - `canShareImages(format: ExportFormat): boolean`: `typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'`, then `navigator.canShare({ files: [new File([], 'probe.' + format, { type: mime })] })` inside try/catch, returning false on throw (research S3). `ExportFormat` comes from `src/render/filename.ts`.
  - `shareFile(file: File): Promise<ShareOutcome>`: it never throws. It returns `'failed'` if `canShare` is missing or `canShare({ files: [file] })` is false. Otherwise it awaits `navigator.share({ files: [file] })` and maps rejections by `e.name`: `AbortError` → `'cancelled'`, `NotAllowedError` → `'needs-gesture'`, anything else → `'failed'` (research S5).
  - `isStoryShape(canvas: { width: number; height: number }): boolean`: `canvas.width * 16 === canvas.height * 9`.

  Add a header comment in the file's style: `// Hands the rendered collage to the system share sheet (Instagram/WhatsApp Stories), entirely on the device (FR-101 to FR-116).` Make T005 pass.
- [X] T007 [US1] Create `src/state/useShare.ts` implementing the hook in [contracts/share.md](./contracts/share.md): `useShare({ doc, settings, pushToast, prerender? }) → { supported, busy, share }`.
  - `supported` is `useMemo(() => canShareImages(settings.format), [settings.format])`.
  - `busy` is state. A `busyRef` guards re-entry, so `share()` is a no-op while busy (FR-113).
  - The cache is a `useRef<{ key: { doc: Doc; format; quality }; file: File } | null>`. It matches when `key.doc === doc && key.format === settings.format && (settings.format === 'png' || key.quality === settings.quality)` (data-model "ShareFile").
  - `share()` flow:
    1. Set busy.
    2. Use the cached file if it matches, else `await renderExportFile(doc, settings)` and cache it.
    3. On `ExportError` or any render error: `console.error` non-`ExportError`s, `pushToast('Export failed — try a smaller canvas size.')`, clear busy, return. Never call share (FR-114).
    4. `const outcome = await shareFile(file)`.
    5. `'needs-gesture'` → `pushToast('Your image is ready', { label: 'Share', run: () => void shareFile(file).then(o => { if (o === 'needs-gesture' || o === 'failed') pushToast("Couldn't open sharing.", { label: 'Download', run: () => downloadFile(file) }); }) })` (FR-116).
    6. `'failed'` → `pushToast("Couldn't open sharing.", { label: 'Download', run: () => downloadFile(file) })` (FR-115: nothing downloads unless tapped).
    7. `'cancelled'` / `'shared'` → no toast (FR-106).
    8. Clear busy in `finally`.
  - Clear the cache when the key stops matching; the ref is dropped on unmount (research S9).
  - Leave the `prerender` option accepted but unused until T010.
- [X] T008 [US1] Add Share to `src/components/ExportPanel.tsx`: call `const sharing = useShare({ doc, settings, pushToast })`.
  - Wrap the actions in `<div className={styles.actions}>`, with the Share button placed **before** Download in the DOM, so visual order and focus order always match.
  - When `sharing.supported`, render `<button type="button" className={styles.shareButton} onClick={sharing.share} disabled={sharing.busy || busy} aria-busy={sharing.busy} aria-label="Share to Story or other apps"><ShareIcon />{sharing.busy ? 'Preparing…' : 'Share'}</button>`.
  - Also disable Download while `sharing.busy`, and disable Share while Download's `busy`, so only one render runs at a time.
  - Change the meta line from `· saved to your device only` to `· stays on your device until you share it`.
  - When sharing isn't supported, the markup stays the same as today apart from the wrapper (FR-112).
- [X] T009 [US1] Add styles in `src/components/Panel.module.css`:
  - `.actions { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }`, and drop the top margin of `.primary` inside `.actions` (`.actions .primary { margin-top: 0; }`).
  - `.shareButton`: same box as `.primary` (46px tall, 14px radius, 15px/600, flex, centered, 8px gap), secondary look: `background: transparent; color: var(--text); border: 1px solid var(--border, currentColor)`. Check `src/styles/tokens.css` for the right border token name. Include the same `:disabled` opacity rule.
  - Inside the existing `@media (max-width: 767px)` block, make Share primary: `.shareButton { background: var(--text); color: var(--canvas-backdrop); border: 0; }` and `.actions .primary { background: transparent; color: var(--text); border: 1px solid var(--border, currentColor); }` (FR-109, research S7). Keep `.actions` margin at 12px on phones to match the current `.primary` phone margin.

**Checkpoint**: US1 is fully usable from the Export panel on a phone. Run `npm test` (T005 green) and quickstart #1–7, #10–12.

---

## Phase 4: User Story 2 - Share is easy to find at the moment the collage is done (Priority: P2)

**Goal**: Share is also in the Preview bar, and it opens near-instantly there because the image is rendered in advance. On phones, Share is the primary action. A non-blocking 9:16 hint appears for other shapes.

**Independent Test**: Fill all cells, open Preview, tap Share, and the sheet opens almost at once, with the bar showing Close · Share · Export. Switch to 1:1, open Export, and the 9:16 hint shows while Share still works (quickstart #8–9).

### Implementation for User Story 2

- [X] T010 [US2] Add Preview pre-rendering to `src/state/useShare.ts`: when `prerender && supported`, a `useEffect` keyed on `[doc, settings.format, settings.quality, prerender, supported]` renders with `renderExportFile(doc, settings)` if the cache doesn't match. It stores the result only if still current (a `cancelled` flag set in cleanup) and ignores errors silently, since the real `share()` call will report them (research S4). If `share()` runs while that pre-render is still going, await the same pending promise instead of starting a second render: keep it in a `pendingRef`.
  - *Implemented more simply*: `useShare` caches the render **promise** (pending or settled) with its input, so a tap during a pre-render awaits the same promise and a stale result can never be served (the key check replaces the `cancelled` flag). Failed renders are evicted so the next tap retries.
- [X] T011 [US2] Add Share to the Preview bar in `src/components/PreviewDialog.tsx`: `const sharing = useShare({ doc, settings: exportSettings, pushToast, prerender: true })`. Between Close and Export, when `sharing.supported`, render `<button type="button" className={styles.share} onClick={sharing.share} disabled={sharing.busy || busy} aria-busy={sharing.busy} aria-label="Share to Story or other apps"><ShareIcon />{sharing.busy ? 'Preparing…' : 'Share'}</button>`. Disable Export while `sharing.busy` (FR-108, FR-113).
- [X] T012 [US2] Style the Preview Share button in `src/components/PreviewDialog.module.css`. Add `.share` sharing the `.secondary` look: extend the `.primary, .secondary` selector list and the `.secondary` rule to include `.share`, and add `display: inline-flex; align-items: center; gap: 6px`. Add `@media (max-width: 767px) { .share { <.primary colors> } .primary { <.secondary colors> } }`, so Share is primary and Export secondary on phones (research S7). Keep the `:disabled` rule applying to `.share`.
- [X] T013 [US2] Add the 9:16 hint to `src/components/ExportPanel.tsx`: when `sharing.supported && !isStoryShape(doc.canvas)`, render `<p className={styles.meta}>Stories are 9:16 — other shapes get borders.</p>` directly under the actions. It is informational only and never disables Share (FR-111).

**Checkpoint**: US1 and US2 both work. Run quickstart #8–9, then #1 again to make sure the Export panel still behaves.

---

## Phase 5: User Story 3 - Sensible fallback where sharing is not possible (Priority: P3)

**Goal**: Browsers that can't share image files show no Share button, and Download is unchanged. Share is fully accessible where it does appear.

**Independent Test**: In desktop Firefox, neither Export nor Preview shows Share, and Download works as before. In desktop Chrome on Windows, keyboard-only Tab + Enter on Share opens the Windows share panel, and a screen reader announces "Share to Story or other apps" (quickstart #13–15).

### Implementation for User Story 3

- [X] T014 [US3] In `src/state/useShare.ts`, make sure `supported` is re-evaluated when the format changes (PNG ↔ JPG) and that `canShareImages` can't throw during render. In `src/components/ExportPanel.tsx` and `src/components/PreviewDialog.tsx`, verify that when `supported` is false the rendered buttons and their order match the pre-feature markup (Download only / Close · Export). No Share element may be present, not even hidden (FR-112, SC-105).
- [X] T015 [US3] Accessibility pass on both Share buttons in `src/components/ExportPanel.tsx` and `src/components/PreviewDialog.tsx`:
  - Native `<button>`, reachable by Tab in visual order. Share comes before Download in both the DOM and the layout at every width; only the styling swaps at 767 px. No CSS `order` is used, so focus order matches visual order.
  - `aria-label="Share to Story or other apps"`.
  - `aria-busy` while preparing.
  - The toasts from `useShare` use the existing `Toasts` component, which already renders action buttons as native buttons.

  (FR-117)

**Checkpoint**: All three stories work on their own. Run quickstart #13–15.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] Add a short "Share to Story" section to `README.md`. Say that Share uses the device share sheet (Instagram → Story, WhatsApp → My status), that it needs HTTPS, that it's hidden where unsupported, and that nothing is saved or uploaded by SplitFrame.
- [X] T017 Run `npm run typecheck`, `npm run lint` and `npm test` and fix anything they report in the files touched by T002–T015.
- [ ] T018 Run the full manual matrix in `specs/002-share-to-story/quickstart.md` (#1–15) on an iPhone (Safari, iOS 16.4+), an Android phone (Chrome), desktop Firefox and desktop Chrome on Windows, using the Netlify deploy preview (HTTPS). Record results and any deviations at the bottom of `specs/002-share-to-story/quickstart.md` under a new "Results" heading.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: T002 blocks every story (`renderExportFile` and `downloadFile`). T003 and T004 are needed by the UI tasks.
- **US1 (Phase 3)**: after Phase 2. This is the MVP.
- **US2 (Phase 4)**: after US1, because it reuses `useShare` (T007) and the button pattern (T008). T013 edits `ExportPanel.tsx` after T008.
- **US3 (Phase 5)**: after US1 and US2, because it audits the buttons they add.
- **Polish (Phase 6)**: after the stories you plan to ship.

### Task-level dependencies

- T005 → T006 (write the tests first, then make them pass)
- T002, T006 → T007 → T008 → T009
- T007 → T010 → T011 → T012
- T008 → T013
- T008, T011 → T014, T015

### Parallel Opportunities

- Phase 2: T003 and T004 run in parallel with each other (T004 touches both components but only their prop types) and with T002.
- US1: T005 (tests) can be written while T002 is in progress.
- Polish: T016 can be written at any time after the UI text is final.

---

## Parallel Example: Foundational + User Story 1

```text
# In parallel:
Task T002: Refactor src/render/exportCanvas.ts (renderExportFile, downloadFile)
Task T003: Add ShareIcon to src/components/icons.tsx
Task T004: Widen pushToast prop types in ExportPanel.tsx and PreviewDialog.tsx
Task T005: Write src/render/share.test.ts

# Then sequentially:
Task T006 → T007 → T008 → T009
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 baseline check.
2. Phase 2 (T002–T004).
3. Phase 3 (T005–T009).
4. **Stop and validate** on a real phone over HTTPS (quickstart #1–7, #10–12). This already delivers the core ask: from the Export panel straight into an Instagram Story or WhatsApp Status.

### Incremental Delivery

1. MVP (US1), then deploy a preview and try it on phones.
2. Add US2: Share in Preview (pre-rendered, near-instant), phone prominence in Preview, and the 9:16 hint.
3. Add US3: check the fallback and do the accessibility pass.
4. Polish: README, full test matrix.

---

## Notes

- There's no new dependency and no network code. Any `fetch`/XHR appearing in a diff would break FR-001/FR-105.
- `Doc` is immutable, so reference equality is a correct cache key (data-model "ShareFile").
- Don't pass `title`/`text`/`url` to `navigator.share`, because some Android targets then drop the image (research S8).
- Commit after each task or logical group.
