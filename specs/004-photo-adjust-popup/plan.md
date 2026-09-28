# Implementation Plan: Photo Adjust Popup

**Branch**: `004-photo-adjust-popup` (not created yet; work is on `main`) | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-photo-adjust-popup/spec.md`

## Summary

Picking a device photo for a cell opens an **Adjust photo** popup first. It shows the photo in the cell's exact shape, with the outside part dimmed, and has drag, pinch/wheel, a zoom slider, ± buttons, Reset, Cancel and Done. Adjust… in the ⋯ menu reopens it later. Zoom may go below "fill" down to "fit", with gaps in the background color, and it snaps back to fill within ±5%.

**Technical approach**:

- **Framing model**: generalize `src/model/frame.ts` from a "crop" to a per-axis offset: the photo covers the cell where it's larger, and stays inside where it's smaller. It exposes `placeImage → { scale, x0, y0, src, dest }`, the single source of truth for the canvas, Preview, export and the popup. Existing zoom ≥ 1 behavior is unchanged (research P1, P2).
- **Consumers**: `planDraw` draws `src` into `dest`. `Cell.tsx` positions its `<img>` from `x0, y0, scale`. Gaps show the background that's already behind the photo (P9).
- **Popup**: `AdjustDialog.tsx`, a modal `<dialog>` with one `<canvas>` drawn from `placeImage`. It reuses `useGestures`, and its slider uses a log scale with a fill mark (P3–P5).
- **Undo**: the popup edits a local draft. Done commits one `setImage` (with the new optional `framing`) or one `setFraming`. Cancel commits nothing (P6).
- **Memory**: `imageStore.holdAsset` protects the popup's not-yet-committed photo, and Cancel releases it (P7).
- **Entry points**: every device-photo path already goes through `Editor.loadInto`, which now opens the popup instead of committing. Sample paths are untouched (P8).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React 19 (unchanged)

**Primary Dependencies**: none added. It uses Canvas 2D, a native `<dialog>`, a native range input, and the existing `useGestures`.

**Storage**: none. The draft framing and the held asset live in memory while the popup is open.

**Testing**: Vitest (node) for the framing math (`frame.test.ts`: 9 existing cases unchanged plus new ones), `planDraw`, `docReducer` and the image store. The popup UX is checked by hand ([quickstart.md](./quickstart.md)).

**Target Platform**: same as the base app. Touch, mouse and keyboard.

**Project Type**: frontend-only single-page web app (unchanged).

**Performance Goals**:
- The popup opens in under 0.5 s after the photo is decoded (SC-304). It redraws one canvas per animation frame while dragging or pinching.
- Canvas, Preview and export stay within 1% of each other (SC-303).

**Constraints**:
- No network use (FR-001).
- Existing framing of placed photos must look identical (FR-319).
- The popup must fit phone screens without scrolling (FR-321).
- Only one decoded copy of the photo is in memory; the popup draws the same `ImageBitmap`.

**Scale/Scope**:
- 1 new component (`AdjustDialog`) with its CSS module.
- 7 changed modules: `frame.ts`, `planDraw.ts`, `Cell.tsx`, `Editor.tsx`, `CellMenu.tsx`, `docReducer.ts`, `imageStore.ts`.
- 1 base-spec amendment (001 FR-023).

No unknowns remain. Everything is settled in [research.md](./research.md) (P1–P10).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template. As in features 001–003, the gates are the hard constraints of the brief and the base spec:

| Gate | Source | Pre-research | Post-design |
|------|--------|--------------|-------------|
| Frontend only; no network for user data | Brief, FR-001 | ✅ Pass | ✅ Pass. Everything is local canvas and state. |
| One renderer and one geometry source for the canvas, Preview and export | FR-007, FR-032, FR-042 | ✅ Pass | ✅ Pass. `placeImage` feeds `Cell.tsx`, `planDraw` and the popup (P1, P4, P9). |
| Undo/redo with one step per gesture | Brief, base history | ✅ Pass | ✅ Pass. Done is one commit; the popup never touches history until then (P6). |
| Photo memory released when unreachable | FR-027 | ✅ Pass | ✅ Pass. Held while in the popup, released on Cancel (P7). |
| Pointer Events for all input; touch and keyboard | FR-039, SC-009 | ✅ Pass | ✅ Pass. Reuses `useGestures`; native slider and buttons; key bindings (P5). |
| No heavy libraries | Brief | ✅ Pass | ✅ Pass. No new dependencies. |
| Unit tests for logic (layout, framing, export rects) | Brief | ✅ Pass | ✅ Pass. `frame.test.ts` regression and new cases, plus `planDraw` and `docReducer` (P10). |

**Result**: PASS. There are no violations, so Complexity Tracking is empty.

**Base spec amendment** (apply in the implementation): in `specs/001-splitframe-collage-editor/spec.md`, FR-023's "The photo MUST always cover its cell, so zoom can never go below cover size" becomes "Photos fill their cell by default. Users may zoom out down to fit (see feature 004 FR-314 to FR-317); gaps show the background color". User Story 2's acceptance scenario 2 ("cannot zoom out past the size where it just covers the cell") is updated the same way.

**Findings from planning**:

1. **Framing assumes "always covers" in four places.** `frameImage` says so in its doc comment, and `planDraw`, `Cell.tsx`, `panBy` and `zoomAt` all rely on it. Generalizing it in one function, `placeImage`, and keeping `frameImage` as a thin wrapper means all four change together and can't drift apart (P1).
2. **The popup's photo could be freed mid-edit.** `releaseUnreferenced` frees anything not in the history, and the popup's new photo isn't in the history until Done. `holdAsset` fixes this (P7).
3. **"Multi-photo drops"**: the base app already uses only the first dropped file, so that path opens the popup like any single photo (spec Assumptions).

## Project Structure

### Documentation (this feature)

```text
specs/004-photo-adjust-popup/
├── spec.md
├── plan.md              # this file
├── research.md          # P1–P10
├── data-model.md        # CellImage meaning, ImagePlacement, AdjustSession, setImage.framing
├── quickstart.md        # 17 manual checks
├── contracts/
│   └── adjust.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created yet)
```

### Source Code (repository root)

```text
src/
├── model/
│   ├── frame.ts              # CHANGED: placeImage, zoomMin, effectiveZoom, snapZoom, zoomTo; per-axis clamp
│   └── frame.test.ts         # CHANGED: new cases; existing 9 unchanged
├── render/
│   ├── planDraw.ts           # CHANGED: image op uses placeImage dest/src
│   └── planDraw.test.ts      # CHANGED: below-fill case
├── state/
│   ├── docReducer.ts         # CHANGED: setImage.framing
│   ├── docReducer.test.ts    # CHANGED
│   └── imageStore.ts         # CHANGED: holdAsset / dropHeld
└── components/
    ├── AdjustDialog.tsx      # NEW
    ├── AdjustDialog.module.css  # NEW
    ├── Cell.tsx              # CHANGED: <img> from placeImage
    ├── CellMenu.tsx          # CHANGED: Adjust… item
    └── Editor.tsx            # CHANGED: adjust session, loadInto opens the popup, Done/Cancel
```

**Structure Decision**: this is the same single-project layout. The framing math stays in `src/model/frame.ts` (pure, tested), the popup is a component next to `PreviewDialog`, and `App.tsx` needs no change because the Editor owns the session and already has `commit`.

## Delivery Phases

1. **Foundation**: the framing model generalization (P1, P2) with tests. `planDraw` and `Cell.tsx` switch to `placeImage`. `setImage.framing` and `holdAsset`. With no UI changes yet, the app must look identical (FR-319).
2. **US1 (P1)**: `AdjustDialog`, and `loadInto` opening it with Done/Cancel. Quickstart #1–5, #10–12, #15–16.
3. **US2 (P1)**: below-fill zoom in the popup and slider (already allowed by the model), the fill mark and snapping. Quickstart #6–9.
4. **US3 (P2)**: Adjust… in the ⋯ menu. Quickstart #8, #13.
5. **US4 (P3)**: in-cell pinch below fill (automatic through the model), then checks. Quickstart #14, #17.
6. **Polish**: base spec amendment, README, full manual pass.

## Complexity Tracking

No violations.
