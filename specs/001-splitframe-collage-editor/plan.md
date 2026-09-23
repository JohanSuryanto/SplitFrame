# Implementation Plan: SplitFrame — Custom-Grid Photo Collage Editor

**Branch**: `001-splitframe-collage-editor` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-splitframe-collage-editor/spec.md`

## Summary

SplitFrame is a static web app that runs only in the browser. Users split a canvas into rectangular cells, using presets or by drawing lines that snap into place, put a photo in each cell, adjust how each photo is framed, see a preview that matches the export, and download one merged PNG or JPG at full resolution. Photos never leave the device.

**Technical approach**:

- **Layout**: an immutable **split tree** with two kinds of splits: straight splits with ratios relative to each parent region, and freehand path splits whose smoothed path is stored relative to the parent region's bounding box (research R19). It is the only source of geometry.
- **Drawing**: nearly straight horizontal/vertical strokes become exact snapped lines; every other stroke keeps its smoothed shape, overshoot is trimmed at cell edges, and each crossed cell is split along the stroke (research R20–R21).
- **Geometry**: pure functions in `src/model` (`computeRects`, `splitAt`, `removeDivider`, `snap`, `layoutPixels`, `frameImage`).
- **Editor**: built with DOM elements, which gives accessibility and cheap per-frame updates.
- **Preview and Export**: share **one canvas renderer** (`planDraw` → `renderCollage`), so Preview matches the export by construction.
- **Undo/redo**: `useReducer` plus a snapshot-based history hook that merges each gesture into one step.
- **Photos**: they are scaled down when loaded and kept in a reference-counted image store outside the history.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React 19

**Primary Dependencies**:

- `react`, `react-dom`
- Build and dev tools: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `eslint`
- No canvas, gesture or state libraries

**Storage**: none. Everything is in memory. Photos are object URLs and `ImageBitmap`s created from local files. Nothing is sent over the network or saved between sessions.

**Testing**: Vitest. Pure model, geometry and render-plan functions run in the `node` environment. The history hook runs in `jsdom`. The rest is checked manually through [quickstart.md](./quickstart.md).

**Target Platform**: the latest two versions of Chrome, Edge, Firefox and Safari, plus iOS/iPadOS Safari 16.4 or newer. The app is deployed as static files.

**Project Type**: a frontend-only single-page web app, as one project.

**Performance Goals**:

- Lines, dividers and photos follow the pointer at the display's refresh rate on a mid-range phone (SC-007).
- Preview opens in under 1 s (SC-010).
- A 1080×1920 export with 6 photos finishes in under 5 s (SC-006).

**Constraints**:

- No network calls with user data and no analytics (FR-001).
- Memory stays safe on phones: sources are scaled down to at most `max(canvas side, 2048)`, and exports are capped at the iOS canvas area limit of 16.7 MP with a clear error.
- Must work fully with touch and fully with the keyboard.

**Scale/Scope**: one screen with a Preview dialog. About 20 source modules, about 6 components and 7 user stories. Typical documents have 1–20 cells, with a practical limit of about 50.

No unknowns are left. All open design questions are settled in [research.md](./research.md) (R1–R18).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template, so no project principles have been ratified. Instead, we used the **hard constraints from the brief and spec** as gates:

| Gate | Source | Pre-research | Post-design |
|------|--------|--------------|-------------|
| Frontend only, no backend, DB, analytics or network for user data | Brief, FR-001 | ✅ Pass | ✅ Pass: static Vite build, no fetch/XHR in app code |
| Images stay on the device, with object URLs revoked | Brief, FR-027 | ✅ Pass | ✅ Pass with a refinement: an asset is revoked once no undo state can reach it (R10) |
| Export rendered in the browser on a canvas | Brief, FR-032 | ✅ Pass | ✅ Pass: `renderCollage` on an offscreen canvas (R11, R13) |
| React + TS + Vite; one styling approach; `useReducer` with undo/redo | Brief | ✅ Pass | ✅ Pass: CSS Modules (R2), `useHistory` (R3) |
| Pointer Events for all input | Brief, FR-039 | ✅ Pass | ✅ Pass (R12) |
| No heavy canvas libraries | Brief | ✅ Pass | ✅ Pass: zero runtime dependencies beyond React |
| Split tree with 0–1 coordinates as the only geometry source | Brief, FR-007 | ✅ Pass | ✅ Pass: `computeRects` feeds the editor, Preview and Export (R4, R11) |
| Required unit tests (layout, snapping, export rectangles) | Brief | ✅ Pass | ✅ Pass: listed in [contracts/layout-model.md](./contracts/layout-model.md) |

**Result**: PASS. No violations, so Complexity Tracking is empty.

**Changes to the spec and brief that we decided on in research** (items 1 and 2 were applied to spec.md on 2026-09-23):

1. **FR-027 (memory release)**: memory is released once no undo or redo state refers to the photo, because releasing it right away would break undo (R10). The spec now says this.
2. **Style reference size**: style values scale against a 1080 px **short side**, not width, so 16:9 styling matches the other presets (R14). The spec now says this.
3. **The brief's `CellImage` type**: `src/scale/offsetX/offsetY` is replaced by `assetId/zoom/focusX/focusY`, so framing survives resizes and export scaling (R9).
4. **Delivery order**: a **Preview phase** is added after Export, because it reuses the export renderer. See Delivery Phases below.
5. **Freehand lines (clarification 2026-09-24)**: the brief listed diagonal and curved lines as out of scope. The user asked for freehand drawing, so the spec now includes it (FR-006–013, FR-046, SC-011) and the design is in research R19–R25.

## Project Structure

### Documentation (this feature)

```text
specs/001-splitframe-collage-editor/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R18
├── data-model.md        # Phase 1: Doc, LayoutNode, CellImage, Style, History, UI state
├── quickstart.md        # Phase 1: run commands + per-phase validation
├── contracts/
│   ├── layout-model.md    # Pure model/geometry API + required tests
│   └── ui-interactions.md # Gestures, keyboard, toolbar, Preview, export output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
index.html                    # <title>SplitFrame</title>
package.json                  # "name": "splitframe"
vite.config.ts                # includes Vitest config
tsconfig.json
src/
├── main.tsx
├── App.tsx                   # wires history, image store, UI state
├── styles/
│   └── tokens.css            # colors, spacing, focus ring
├── model/                    # PURE — no DOM, fully unit-tested
│   ├── types.ts              # Doc, LayoutNode, CellImage, Style, CanvasSpec
│   ├── layout.ts             # computeRects, dividers, splitAt, resizeDivider, removeDivider, clear, image ops
│   ├── layout.test.ts
│   ├── presets.ts            # buildPreset, applyPreset; canvas presets
│   ├── presets.test.ts
│   ├── snap.ts               # snapCandidates, snap, strokeToLine
│   ├── snap.test.ts
│   ├── stroke.ts             # isStraightStroke, smoothStroke, extendEnds, selfIntersects
│   ├── stroke.test.ts
│   ├── polygon.ts            # area, bbox, containment, chords, splitPolygonByChord, roundPolygon
│   ├── polygon.test.ts
│   ├── fixtures/referenceSketch.ts # the 7-stroke clarification sketch (SC-011)
│   ├── geometry.ts           # minSizeNorm, layoutPixels (padding/gap/radius)
│   ├── geometry.test.ts
│   ├── frame.ts              # frameImage, panBy, zoomAt, reset
│   └── frame.test.ts
├── state/
│   ├── docReducer.ts         # Doc actions → model functions
│   ├── useHistory.ts         # commit / preview / endGesture / undo / redo, cap 100
│   ├── useHistory.test.ts
│   ├── imageStore.ts         # load + validate + downscale, refcount GC (revoke/close)
│   └── uiState.ts            # mode, selection, stroke, previewOpen, exportSettings, toasts
├── render/
│   ├── planDraw.ts           # pure DrawOp[] builder
│   ├── planDraw.test.ts      # "known layout → expected rects" test
│   ├── renderCollage.ts      # executes DrawOp[] on a 2D context (roundRect clip)
│   ├── exportCanvas.ts       # full-res render, toBlob, size guard, download
│   └── filename.ts (+ .test.ts) # splitframe-YYYYMMDD-HHmm.ext
├── input/
│   └── useGestures.ts        # pointer capture, tap/double-tap, pan, pinch, wheel
└── components/
    ├── Toolbar.tsx (+ .module.css)      # aspect, presets, Custom/Clear, undo/redo, Preview, Export
    ├── Editor.tsx (+ .module.css)       # canvas surface, mode indicator, stroke preview, snap guides
    ├── Cell.tsx (+ .module.css)         # <img> with transform, drop target, keyboard, action menu
    ├── Divider.tsx (+ .module.css)      # hit target, resize cursor, × handle, arrow keys
    ├── StylePanel.tsx (+ .module.css)   # side panel / mobile bottom sheet
    ├── PreviewDialog.tsx (+ .module.css)# canvas via renderCollage, Close / Export
    └── Toasts.tsx (+ .module.css)
```

**Structure Decision**: a single frontend project at the repository root, following the brief's suggested structure, with the brief's `hooks/useHistory.ts` moved to `state/`. Tests sit next to the files they test (`*.test.ts`). Code is split into:

- `model/` and `render/planDraw`: pure functions.
- `state/`: history and resources.
- `input/`: gestures.
- `components/`: the view.

This keeps everything that affects correctness testable without a browser.

## Delivery Phases (stop after each for review)

| # | Phase | Stories / FRs | Done when |
|---|-------|---------------|-----------|
| 1 | Scaffold, layout model and tests, presets shown as empty cells, aspect ratios | US1 (partly); FR-003–008 | `npm test` passes the layout, preset and geometry tests. Presets render. |
| 2 | Photo upload and drop, image store with downscaling, cover fit, pan/zoom/reset, cell actions, optional photo swap | US2; FR-020–028 | Quickstart phase 2 passes. |
| 3 | Custom mode: straight and freehand lines, stroke preview, snapping, overshoot trimming, shaped cells, min size, live photo crop, Clear | US3; FR-006–015, FR-045, FR-046 | Quickstart phase 3 passes, and the snap tests pass. |
| 4 | Divider drag, delete/merge (option A), toasts, undo/redo with gesture merging | US4; FR-016–019, FR-036–037 | Quickstart phase 4 passes, and the history tests pass. |
| 5 | Style panel (gap, color, radius, padding) | US6; FR-029–030 | Quickstart phase 5 passes. |
| 6 | `planDraw` and `renderCollage`, full-resolution PNG/JPG export, file naming, failure handling | US1; FR-031–035 | Quickstart phase 6 passes, and the `planDraw` test passes. |
| 7 | Preview dialog and the "all cells filled" shortcut | US5; FR-041–044 | Quickstart phase 7 passes. |
| 8 | Mobile bottom sheet, touch polish, keyboard and accessibility pass | US7; FR-038–040 | Quickstart phase 8 passes. |

## Complexity Tracking

No constitution violations, so there's nothing to justify.
