# Implementation Plan: Share to Story

**Branch**: `002-share-to-story` (not created yet; work is on `main`) | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-share-to-story/spec.md`

## Summary

Add a **Share** action that gives the finished collage to the device's share sheet, where the user picks Instagram (Story) or WhatsApp (Status). Nothing is saved to the gallery first.

**Technical approach**:

- **Share mechanism**: the Web Share API with a single `File` (research S1). It is shown only where `navigator.canShare({ files })` confirms support for the current format (S3).
- **Same image as Download**: `exportCanvas.ts` gets a new `renderExportFile`, and both Download and Share use it, so the shared image is byte-identical to the download (S6).
- **Share logic**: a small pure module, `src/render/share.ts`, maps share results to four outcomes (S5), and a `useShare` hook turns those outcomes into button state and toasts.
- **Beating Safari's user-activation timeout**: Preview renders the image in advance, and if the browser still refuses, a "Your image is ready" toast offers a **Share** button that opens the sheet with a fresh tap (S4).
- **Placement**: Share sits in the Preview bar and the Export panel. Below the 767 px phone breakpoint it is the primary button, and a non-blocking hint appears when the canvas isn't 9:16 (S7).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React 19 (unchanged)

**Primary Dependencies**: none added. The Web Share API is built into the browser.

**Storage**: none. The shared `File` lives only in memory, for as long as Preview is open or a toast holds it (S9).

**Testing**: Vitest in the `node` environment for `share.ts`, with a stubbed `navigator`. The share sheet itself is checked by hand on real phones ([quickstart.md](./quickstart.md)).

**Target Platform**: as in the base app. Sharing lights up on iOS/iPadOS Safari 16.4+, Android Chrome, Chrome/Edge on Windows and ChromeOS, and macOS Safari. Elsewhere it is hidden (S2). A secure context is required, and Netlify already serves over HTTPS.

**Project Type**: frontend-only single-page web app (unchanged).

**Performance Goals**: the share sheet opens within 3 s for a 1080×1920 collage with 6 photos on a mid-range phone (SC-102). From Preview it is near-instant because the image is rendered in advance.

**Constraints**:

- No network calls and no analytics (FR-001/FR-105).
- Nothing is written to user-visible storage (FR-103).
- Only one full-size image copy is held in memory at a time.

**Scale/Scope**: 2 new modules (`share.ts`, `useShare.ts`), 1 refactored module (`exportCanvas.ts`), 2 components touched (`ExportPanel`, `PreviewDialog`), 1 icon and small CSS changes.

No unknowns remain. Everything is settled in [research.md](./research.md) (S1–S10).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template. As in feature 001, the gates are the hard constraints of the brief and the base spec:

| Gate | Source | Pre-research | Post-design |
|------|--------|--------------|-------------|
| Frontend only; no backend, analytics, or network for user data | Brief, FR-001 | ✅ Pass | ✅ Pass. `navigator.share` hands the file to the OS; there is no fetch or XHR (S1). |
| Images stay on the device unless the user acts | Brief, FR-001, FR-105 | ✅ Pass | ✅ Pass. Sharing only happens on the user's tap, and nothing is saved (S9). |
| Export rendered in the browser; export matches preview | FR-032, FR-042 | ✅ Pass | ✅ Pass. Share uses the same `renderExportFile` (S6). |
| No heavy libraries | Brief | ✅ Pass | ✅ Pass. No new dependencies. |
| Works with touch and keyboard; accessible | FR-039, SC-009 | ✅ Pass | ✅ Pass. Native `<button>` with an accessible name and `aria-busy` (contract). |
| Required unit tests for logic | Brief | ✅ Pass | ✅ Pass. `share.test.ts` covers the outcome mapping and detection (S10). |

**Result**: PASS. There are no violations, so Complexity Tracking is empty.

**Spec corrections made during planning** (applied to spec.md on 2026-09-24):

1. **FR-110 and the "Empty cells" edge case**: the spec said Share is disabled when there are no photos, "like Download". Download is never disabled for an empty collage; empty cells export in the background color. Both now say Share is available whenever Download is.

**Notes for later**:

- The spec's assumption that most desktop browsers only fall back to Download is partly wrong. Chrome/Edge on Windows and macOS Safari support sharing files, so Share will appear there too, but as a secondary button (S2, S7). This fits FR-109 and FR-112, so no spec change is needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-share-to-story/
├── spec.md
├── plan.md              # this file
├── research.md          # S1–S10
├── data-model.md        # ShareFile, ShareOutcome, button states
├── quickstart.md        # device test matrix
├── contracts/
│   └── share.md         # module, hook and UI contract
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created yet)
```

### Source Code (repository root)

```text
src/
├── render/
│   ├── exportCanvas.ts      # CHANGED: add renderExportFile + downloadFile; exportCollage uses them
│   ├── share.ts             # NEW: canShareImages, shareFile, isStoryShape
│   └── share.test.ts        # NEW: outcome mapping, detection, 9:16 check
├── state/
│   └── useShare.ts          # NEW: busy state, pre-render cache, toasts for each outcome
└── components/
    ├── ExportPanel.tsx      # CHANGED: Share button, phone prominence, 9:16 hint, meta text
    ├── PreviewDialog.tsx    # CHANGED: Share in bar, prerender: true
    ├── PreviewDialog.module.css  # CHANGED: Share primary below 767px
    ├── Panel.module.css     # CHANGED: secondary button style / phone ordering
    └── icons.tsx            # CHANGED: ShareIcon
```

**Structure Decision**: this is the same single-project layout as feature 001. Pure browser logic goes in `src/render` (next to export), hooks go in `src/state` (next to `useHistory`), and the UI goes in `src/components`. `App.tsx` needs no change because both components already receive `doc`, the export settings and `pushToast`.

## Delivery Phases

1. **Foundation**: split out `renderExportFile` and `downloadFile` in `exportCanvas.ts`, then check that Download works as before.
2. **US1 (P1)**: `share.ts` and its tests, the `useShare` hook, and the Share button in the Export panel. Test on phones with quickstart #1–7 and #10–12.
3. **US2 (P2)**: Share in Preview with the image rendered in advance, the phone prominence rules, and the 9:16 hint. Quickstart #8–9.
4. **US3 (P3)**: check that Share is hidden where it isn't supported, plus keyboard and screen-reader access. Quickstart #13–15.

## Complexity Tracking

No violations.
