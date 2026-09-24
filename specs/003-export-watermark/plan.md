# Implementation Plan: Export Watermark

**Branch**: `003-export-watermark` (not created yet; work is on `main`) | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-export-watermark/spec.md`

## Summary

Downloaded and shared images get a small "SplitFrame · splitframe.johansuryanto.dev" credit at the bottom center, sized relative to the canvas and kept clear of Instagram/WhatsApp controls on 9:16. It is on by default, and one switch in the Export panel turns it off for Download, Share and Preview together.

**Technical approach**:

- **Geometry**: a pure `planWatermark` in `src/render/watermark.ts` computes font size, fit and placement against the export canvas, then scales to the surface being drawn. It measures text through an injected function, so it can be unit-tested without a canvas (research W1, W2, W5).
- **Drawing**: `renderCollage` draws that op after the collage when `{ watermark: true }` is passed. Only Preview and export call it, so the editor never shows the credit and Preview always matches the file (W1).
- **Setting**: `ExportSettings.watermark` defaults to `true`. It sits in session UI state, so it's never undone or saved (W6).
- **Fix to feature 002's share cache**: the cache check moves into a tested `sameExportInput` helper that includes `watermark`, so a pre-rendered Preview image is never shared after the switch changes (W7).
- **Switch**: `role="switch"` in the Export panel, with a "Too small for a watermark" note when it can't fit (W8).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React 19 (unchanged)

**Primary Dependencies**: none added. It uses Canvas 2D `fillText`/`measureText` and the system font stack (W4).

**Storage**: none. The setting is session UI state only.

**Testing**: Vitest in the `node` environment for `watermark.ts` (with a fake `measure`) and for `sameExportInput`. Readability and Story safe areas are checked by hand ([quickstart.md](./quickstart.md)).

**Target Platform**: same as the base app.

**Project Type**: frontend-only single-page web app (unchanged).

**Performance Goals**: the watermark is one `fillText` with a shadow per render, which adds nothing noticeable to Preview (under 1 s, SC-010) or export (under 5 s, SC-006).

**Constraints**:

- No network or font loading (FR-214; CSP `default-src 'self'`).
- Preview and export must match within 1% of the canvas size (SC-202).
- The credit text must be at least 10 export px, or it's left out (FR-208).

**Scale/Scope**:

- 1 new module plus its tests (`watermark.ts`).
- 4 changed modules: `renderCollage.ts`, `exportCanvas.ts`, `uiState.ts`, `useShare.ts`.
- 2 changed components: `ExportPanel`, `PreviewDialog`.
- Switch styles in `Panel.module.css`.

No unknowns remain. Everything is settled in [research.md](./research.md) (W1–W9).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template. As in features 001 and 002, the gates are the hard constraints of the brief and the base spec:

| Gate | Source | Pre-research | Post-design |
|------|--------|--------------|-------------|
| Frontend only; no network for user data; no analytics | Brief, FR-001 | ✅ Pass | ✅ Pass. Drawn on the canvas on the device; no web font fetch (W4). |
| Nothing saved between sessions | Base spec, README | ✅ Pass | ✅ Pass. The setting lives only in `useReducer` UI state (W6). |
| One renderer for Preview and export | FR-032, FR-042, 002 FR-102 | ✅ Pass | ✅ Pass. The watermark is drawn inside `renderCollage` from a pure plan (W1). |
| Undo/redo covers collage edits only | Base FR (history) | ✅ Pass | ✅ Pass. The setting is in `ExportSettings`, not `Doc` (W6). |
| No heavy libraries | Brief | ✅ Pass | ✅ Pass. No new dependencies. |
| Touch and keyboard, accessible | FR-039, SC-009 | ✅ Pass | ✅ Pass. Native button with `role="switch"` and `aria-checked` (W8). |
| Unit tests for logic | Brief | ✅ Pass | ✅ Pass. `watermark.test.ts` and `sameExportInput` tests (W9). |

**Result**: PASS. There are no violations, so Complexity Tracking is empty.

**Findings from planning**:

1. **A bug the watermark would have introduced in feature 002.** `useShare` reuses a pre-rendered file keyed on doc, format and quality only. Without a change, toggling Watermark would share the old image. The fix is part of this plan (W7), with quickstart #11 as the check.
2. **FR-203 precision.** The spec's "bottom edge 5% above the bottom" (originally 12%) is measured to the lowest pixel of the text, descenders included. The baseline is raised by 0.25 × the font size to guarantee it (W2).
3. **Editor hint (added 2026-09-24).** After implementation, the user asked for the credit to be visible while editing too, so people know it will be added. FR-215 was changed: the editor draws a faint, non-interactive copy using the same `drawWatermark` code (see T016).

## Project Structure

### Documentation (this feature)

```text
specs/003-export-watermark/
├── spec.md
├── plan.md              # this file
├── research.md          # W1–W9
├── data-model.md        # ExportSettings.watermark, WatermarkOp, sameExportInput
├── quickstart.md        # manual checks
├── contracts/
│   └── watermark.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created yet)
```

### Source Code (repository root)

```text
src/
├── render/
│   ├── watermark.ts          # NEW: WATERMARK_TEXT, planWatermark, watermarkFits
│   ├── watermark.test.ts     # NEW
│   ├── renderCollage.ts      # CHANGED: opts.watermark → draw the planned op
│   ├── exportCanvas.ts       # CHANGED: pass settings.watermark; add sameExportInput
│   └── exportCanvas.test.ts  # NEW: sameExportInput cases (pure, no canvas)
├── state/
│   ├── uiState.ts            # CHANGED: ExportSettings.watermark, default true
│   └── useShare.ts           # CHANGED: use sameExportInput
└── components/
    ├── ExportPanel.tsx       # CHANGED: Watermark switch and note
    ├── PreviewDialog.tsx     # CHANGED: pass watermark to renderCollage; effect dependency
    └── Panel.module.css      # CHANGED: switch row, track and thumb styles
```

**Structure Decision**: this is the same single-project layout. Drawing logic goes in `src/render` next to `planDraw` and `share`, the setting in `src/state/uiState.ts`, and the UI in `src/components`. `App.tsx` doesn't change, because `ExportSettings` already reaches both components.

## Delivery Phases

1. **Foundation**: add `ExportSettings.watermark` (default `true`) and `sameExportInput` with its tests, and switch `useShare` to it.
2. **US1 (P1)**: `watermark.ts` and its tests, `renderCollage` opts, and export and Preview passing the setting. Quickstart #2–9.
3. **US2 (P1)**: the switch and the "too small" note in the Export panel. Quickstart #1, #10–14.

## Complexity Tracking

No violations.
