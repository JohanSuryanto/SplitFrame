# Implementation Plan: Custom Watermark

**Branch**: `005-custom-watermark` (not created yet; work is on `main`) | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-custom-watermark/spec.md`

## Summary

Users type their own watermark text and set its color, opacity, size and rotation. They drag it anywhere on the image, or switch on **Repeat** to tile it diagonally across the whole image. The main use is stamping ID-card photos before sending them. It appears in the editor, Preview, Download and Share, and every change is undoable. The feature 003 credit is relabelled **SplitFrame credit** and stays a separate switch.

**Technical approach**:

- **Data**: a `watermark` field on `Doc` (C1). Being part of the document gives undo/redo, the Preview/Download/Share match and the export cache for free (`sameExportInput` already compares `doc` by identity).
- **Reducer**: one `setWatermark` patch action that clamps every value, like `setStyle` (C2).
- **Geometry**: a pure `planTextMark(mark, canvas, sizePx, measure)` in `src/render/textMark.ts`. It returns draw positions for one copy, or for a tiled grid, and is unit-tested with a fake `measure`, the same pattern as `planWatermark` (C3, C4).
- **Drawing**: `renderCollage` draws the mark after the collage and before the credit (FR-513). The editor draws it on an overlay canvas, generalizing today's `WatermarkLayer` (C5).
- **Dragging**: while the Watermark panel is open, the overlay catches pointer input. A drag anywhere moves the mark by the pointer's delta (C6), using the existing `preview`/`endGesture`, so one drag is one undo step. The overlay carries `SHEET_IGNORE_ATTR`, so dragging doesn't close the sheet.
- **Panel**: `WatermarkPanel` built from the `StylePanel` patterns (sliders, swatches, color input), plus a text box, an Add date button, a Repeat switch and a Center button (C7, C8).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React 19 (unchanged)

**Primary Dependencies**: none added. Canvas 2D `fillText`/`measureText`/`rotate`, native `<input type="color">` and `<input type="range">`, and `Intl.DateTimeFormat` for the date.

**Storage**: none. The watermark is part of the in-memory document and is gone after a reload (FR-515).

**Testing**: Vitest (`node` environment) for `textMark.ts` and the `setWatermark` reducer case. Dragging, phone gestures and the match between export and canvas are checked by hand ([quickstart.md](./quickstart.md)).

**Target Platform**: same as the base app (current iOS Safari, Android Chrome and desktop browsers).

**Project Type**: frontend-only single-page web app (unchanged).

**Performance Goals**:

- Dragging redraws one overlay canvas per pointer move: one `fillText`, or about 50 to 200 for Repeat. This stays well under a 16 ms frame on a mid-range phone (SC-504).
- No noticeable cost to export.

**Constraints**:

- No network and no web font (FR-517; CSP unchanged).
- Canvas, Preview and file must match within 1% (SC-502). This is met because both draw from the same `planTextMark`.
- No new dependency (FR-518).

**Scale/Scope**:

- 2 new modules: `textMark.ts` with its tests, and `WatermarkPanel.tsx`.
- 1 new icon.
- Changed: `types.ts`, `docReducer.ts` (with tests), `renderCollage.ts`, `WatermarkLayer.tsx` (renamed `MarkLayer.tsx`), `Editor.tsx`, `Dock.tsx`, `App.tsx`, `ExportPanel.tsx`, `PreviewDialog.tsx`, `README.md`.

No unknowns remain. Everything is settled in [research.md](./research.md) (C1–C9).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template. As in features 001 to 004, the gates are the hard constraints of the brief and the base spec:

| Gate | Source | Pre-research | Post-design |
|------|--------|--------------|-------------|
| Frontend only; no network for user data; no analytics | Brief, FR-001, FR-517 | ✅ Pass | ✅ Pass. Text is drawn on device canvases only; no web font (C4). |
| Nothing saved between sessions | Base spec, FR-515 | ✅ Pass | ✅ Pass. The watermark lives in the in-memory `Doc` (C1). |
| One renderer for Preview and export | FR-032, FR-042, FR-512 | ✅ Pass | ✅ Pass. Editor overlay, Preview and export all draw from `planTextMark` (C3, C5). |
| Every document change undoable; a gesture is one step | FR-036, FR-037, FR-514 | ✅ Pass | ✅ Pass. `setWatermark` goes through `useHistory`; drags, sliders and typing use `preview` + `endGesture` (C6, C8). |
| Works fully on phones; mouse, touch, pen and keyboard | Brief, FR-510 | ✅ Pass | ✅ Pass. Pointer Events delta-drag, arrow keys and a Center button (C6). |
| Lightweight; no new dependencies | FR-518 | ✅ Pass | ✅ Pass. Platform APIs only. |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-custom-watermark/
├── spec.md
├── plan.md              # This file
├── research.md          # C1–C9
├── data-model.md        # Watermark type, action, draw plan
├── quickstart.md        # Manual and automated checks
├── contracts/
│   └── watermark-panel.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
src/
├── model/
│   └── types.ts                 # + Watermark, DEFAULT_WATERMARK, WATERMARK_RANGES; Doc.watermark
├── state/
│   ├── docReducer.ts            # + setWatermark (clamping, Repeat −30° rule); initialDoc
│   └── docReducer.test.ts       # + setWatermark cases
├── render/
│   ├── textMark.ts              # NEW: planTextMark (single and tiled), pure
│   ├── textMark.test.ts         # NEW
│   └── renderCollage.ts         # draws the mark before the credit
└── components/
    ├── MarkLayer.tsx            # was WatermarkLayer: mark + optional credit, drag when interactive
    ├── MarkLayer.module.css     # was WatermarkLayer.module.css
    ├── WatermarkPanel.tsx       # NEW
    ├── Editor.tsx               # always renders MarkLayer; passes interactive + credit flags
    ├── Dock.tsx                 # + Watermark item
    ├── icons.tsx                # + WatermarkIcon
    ├── ExportPanel.tsx          # label "SplitFrame credit"
    └── PreviewDialog.tsx        # label "SplitFrame credit"
App.tsx                          # 'watermark' panel; wires WatermarkPanel
README.md                        # Features list
```

**Structure Decision**: same single-project layout as before. New logic goes where its kind already lives: pure geometry in `render/`, document changes in `state/docReducer.ts`, and UI in `components/`.

## Complexity Tracking

No violations.
