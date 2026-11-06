# Implementation Plan: Signature

**Branch**: `006-signature` (not created yet; work is on `main`) | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-signature/spec.md`

## Summary

Users add one signature on top of the image, either **drawn** in a pad popup or **uploaded** as a photo of a pen signature. For uploads, the paper is removed automatically and a Sensitivity slider adjusts how much. The signature is placed like the feature 005 watermark (drag, size, rotation, opacity, ink color, Center). It lives in a **Signature** tab of the Watermark panel and is drawn above the text watermark and below the SplitFrame credit. It's undoable, matches Preview, Download and Share, and stays on the device for the session only.

**Technical approach**:

- **Data**: `Doc.signature: Signature | null` (S1). The picture is either:
  - **vector strokes**, normalized to the signature's own box, so a drawn signature is sharp at any export size (FR-605) and costs a few KB per undo snapshot; or
  - an **image asset** in the existing `imageStore`, so uploads reuse the photo memory management. `historyAssets` also counts the signature's asset (S6).
- **Reducer**: three actions:
  - `setSignaturePicture`: create the signature with the FR-613 defaults, or replace the picture and keep its placement.
  - `setSignature`: a clamped patch, sharing the clamping rules with `setWatermark`.
  - `removeSignature`.
  
  (S2)
- **Geometry**: a pure `planSignature(sig, canvas, sizePx)` returns center, box size and angle (S3). Pure `normalizeStrokes` crops pad strokes to their bounding box (S4). A pure `removeBackground(rgba, w, h, sensitivity)` makes paper transparent and finds the ink's bounding box (S5). All three are unit-tested.
- **Drawing**:
  - `drawSignature` in `renderCollage.ts` strokes quadratic curves for vector signatures, or draws the image asset. Recoloring uses a cached tinted copy (`source-in`) unless `keepColors` is on (S7).
  - `MarkLayer` draws it on the editor overlay, and the drag/keyboard handling now targets either the text mark or the signature (S8).
- **UI**:
  - **Text | Signature** tabs in `WatermarkPanel`, with the selected tab lifted to `App` so the overlay knows what to move (S8).
  - A `SignaturePadDialog` and a `SignatureUploadDialog`, both native `<dialog>` like the existing `AdjustDialog`/`ConfirmDialog` (S9, S10).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on React 19 (unchanged)

**Primary Dependencies**: none added. It uses Canvas 2D (`quadraticCurveTo`, `getImageData`, `globalCompositeOperation`), Pointer Events (`getCoalescedEvents` where available), `<dialog>`, and the existing `smoothStroke` (`src/model/stroke.ts`) and `loadImage`/`imageStore`.

**Storage**: none. The signature lives in the in-memory `Doc` and `imageStore`, and is gone after a reload (FR-620).

**Testing**: Vitest (`node` environment) for `planSignature`, `normalizeStrokes`, `removeBackground` (on synthetic RGBA arrays), the three reducer actions, and `historyAssets` including the signature asset. The pad feel, real-photo background removal (SC-602) and the canvas/file match are checked by hand ([quickstart.md](./quickstart.md)).

**Target Platform**: same as the base app (current iOS Safari, Android Chrome and desktop browsers).

**Project Type**: frontend-only single-page web app (unchanged).

**Performance Goals**:

- **Pad drawing**: incremental, appending a segment per pointer move and redrawing the whole pad only on Undo stroke, Clear or resize, so it keeps up with a finger (SC-605).
- **Sensitivity slider**: reprocesses a preview copy reduced to at most 512 px on the long side, in under 100 ms on a mid-range phone (FR-608). Done reprocesses once at up to 2048 px.
- **Dragging a recolored upload**: no per-frame pixel work, because the tinted copy is cached per asset and color (S7).

**Constraints**:

- No network and no new dependency (FR-619, FR-621).
- Canvas, Preview and file must match within 1% (SC-604). This is met because every surface draws from `planSignature`.
- A signature is never written to storage (FR-620).

**Scale/Scope**:

- New modules:
  - `src/model/signature.ts` (`normalizeStrokes`, `planSignature`) + tests
  - `src/render/removeBackground.ts` + tests
  - `src/components/SignaturePadDialog.tsx` (+ CSS)
  - `src/components/SignatureUploadDialog.tsx` (+ CSS)
- Changed:
  - `types.ts`, `docReducer.ts` (+ tests), `useHistory.ts` (+ test)
  - `imageStore.ts` (an `addAsset` from canvas)
  - `renderCollage.ts`, `MarkLayer.tsx`, `WatermarkPanel.tsx`, `Editor.tsx`, `App.tsx`
  - `README.md`

No unknowns remain. Everything is settled in [research.md](./research.md) (S1–S11).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template. As in features 001 to 005, the gates are the hard constraints of the brief and the base spec:

| Gate | Source | Pre-research | Post-design |
|------|--------|--------------|-------------|
| Frontend only; no network for user data; no analytics | Brief, FR-001, FR-619 | ✅ Pass | ✅ Pass. Pad, background removal and export run on device canvases only (S5, S9). |
| Nothing saved between sessions | Base spec, FR-620 | ✅ Pass | ✅ Pass. Strokes live in the in-memory `Doc`; uploads live in `imageStore` (memory, revoked object URLs) (S1, S6). |
| One renderer for Preview and export | FR-032, FR-042, FR-616 | ✅ Pass | ✅ Pass. Overlay, Preview and export all use `planSignature` + `drawSignature` (S3, S7). |
| Every document change undoable; a gesture is one step | FR-036, FR-037, FR-618 | ✅ Pass | ✅ Pass. Signature actions go through `useHistory`; pad strokes stay local until Done (FR-606, S9). |
| Works fully on phones; mouse, touch, pen and keyboard | Brief, FR-604, FR-614 | ✅ Pass | ✅ Pass. Pointer Events pad, the shared drag/arrow-key layer, and dialogs sized to the viewport (S8–S10). |
| Lightweight; no new dependencies | FR-621 | ✅ Pass | ✅ Pass. Platform APIs plus existing modules. |
| Photo memory is released when no undo step refers to it | Base FR-027 | ✅ Pass | ✅ Pass. `historyAssets` includes signature assets; the upload dialog holds its asset until Done or Cancel (S6). |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-signature/
├── spec.md
├── plan.md              # This file
├── research.md          # S1–S11
├── data-model.md        # Signature type, actions, plans
├── quickstart.md        # Manual and automated checks
├── contracts/
│   └── signature-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
src/
├── model/
│   ├── types.ts                 # + Signature, SignaturePicture, defaults, ranges; Doc.signature
│   ├── signature.ts             # NEW: normalizeStrokes, planSignature (pure)
│   └── signature.test.ts        # NEW
├── state/
│   ├── docReducer.ts            # + setSignaturePicture, setSignature, removeSignature; shared clamps
│   ├── docReducer.test.ts       # + signature cases
│   ├── useHistory.ts            # historyAssets counts doc.signature's asset
│   ├── useHistory.test.ts       # + that case
│   └── imageStore.ts            # + addAssetFromCanvas
├── render/
│   ├── removeBackground.ts      # NEW: luminance → alpha, Otsu cutoff, ink bbox (pure)
│   ├── removeBackground.test.ts # NEW
│   └── renderCollage.ts         # + drawSignature (strokes or tinted image); draw order
└── components/
    ├── MarkLayer.tsx            # draws the signature; drag target 'text' | 'signature'
    ├── WatermarkPanel.tsx       # Text | Signature tabs; signature controls
    ├── SignaturePadDialog.tsx   # NEW (+ .module.css)
    ├── SignatureUploadDialog.tsx# NEW (+ .module.css)
    └── Editor.tsx               # passes the drag target
App.tsx                          # markTab state; passes it to panel and editor
README.md                        # Features list
```

**Structure Decision**: same single-project layout. Pure geometry goes in `model/`, pixel processing and drawing in `render/`, document changes in `state/docReducer.ts`, and UI in `components/`.

## Complexity Tracking

No violations.
