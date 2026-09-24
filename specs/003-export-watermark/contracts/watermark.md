# Contract: Watermark module and UI

**Feature**: [../spec.md](../spec.md) · **Data model**: [../data-model.md](../data-model.md)

## Module `src/render/watermark.ts` (new)

```ts
export const WATERMARK_TEXT = 'SplitFrame · splitframe.johansuryanto.dev';

export interface WatermarkOp {
  text: string;
  x: number;
  y: number;              // alphabetic baseline
  fontPx: number;
  font: string;
  color: string;
  shadow: { color: string; blur: number; offsetY: number };
}

/**
 * Pure. Geometry comes from the export canvas and is scaled to sizePx.
 * Returns null when the credit would be under 10 export px (FR-208).
 */
export function planWatermark(
  canvas: { width: number; height: number },
  sizePx: Size,
  measure: (text: string, fontPx: number) => number,
): WatermarkOp | null;

/** For the Export panel note: short side ≥ 400 px (0.025·S ≥ 10). */
export function watermarkFits(canvas: { width: number; height: number }): boolean;
```

Guarantees (each one is unit-tested):

| Case | Expectation |
|---|---|
| 1080×1920, `sizePx` = export | `fontPx = 27`, `x = 540`, `y = 1920 − 96 − 6.75 = 1817.25` |
| 1080×1080 | `y = 1080 − 32.4 − 6.75 = 1040.85` |
| 2160×3840 vs 1080×1920 | every length is exactly ×2 |
| `sizePx` = half the export size | every length is exactly ×0.5 compared with the export plan |
| 8000×400 | `fontPx = 10`, the smallest that is still drawn |
| 1080×1080 with a fake `measure` that is 2× too wide | `measure(text, fontPx) ≤ 0.9 · sizePx.w`, and `fontPx < 27` |
| 300×300 | `null` |
| any non-null result | `watermarkFits(canvas) === true`; for null, `false` |

`watermarkFits` gives the same answer as `planWatermark` unless the device's font is so wide that the width cap pushes it under 10 px. That can't happen for the realistic 0.55 em/char measure used in tests.

## Module `src/render/renderCollage.ts` (changed)

```ts
export function renderCollage(ctx: Ctx, doc: Doc, sizePx: Size, opts?: { watermark?: boolean }): void;
```

- It draws the collage exactly as today.
- Then, if `opts?.watermark`, it calls `planWatermark(doc.canvas, sizePx, measure)`, where `measure` sets `ctx.font` and returns `ctx.measureText(text).width`.
- It draws the op in `ctx.save()`/`restore()` with `textAlign = 'center'`, `textBaseline = 'alphabetic'`, the shadow settings and `fillText`.
- If `opts` is left out, there is no watermark, so existing callers behave the same until they opt in.

## Module `src/render/exportCanvas.ts` (changed)

- `renderToBlob` passes `{ watermark: settings.watermark }` to `renderCollage`.
- New export: `sameExportInput(a: { doc: Doc; settings: ExportSettings }, b: same): boolean`, following the rule in [data-model.md](../data-model.md).

## Hook `src/state/useShare.ts` (changed)

- Replace the local `sameInput` with `sameExportInput`. Toggling Watermark must invalidate a pre-rendered share file.

## UI contract

**Export panel** (`ExportPanel.tsx`): new section after Format and Quality, before the actions.

```
Watermark                                   [●━━]  ← role="switch", aria-checked
Adds “SplitFrame · splitframe.johansuryanto.dev” at the bottom
```

- The whole row is the `<button type="button" role="switch" aria-checked={on}>`. Its accessible name is "Watermark", and the description is linked with `aria-describedby`.
- When `!watermarkFits(doc.canvas)`, the description reads **"Too small for a watermark"**.
- Toggling it calls `onChange({ watermark: !on })`.

**Preview** (`PreviewDialog.tsx`): pass `{ watermark: exportSettings.watermark }` to `renderCollage`, and add `exportSettings.watermark` to the layout effect's dependencies so toggling re-renders.

**Editor** (`Editor.tsx`, new `WatermarkHint.tsx`): when `watermark` is on, a `<canvas aria-hidden>` covers the surface (`inset: 0`, `z-index: 3`, above cells and lines at 1–2, below dividers and menus at 4–6). It has `pointer-events: none` and `opacity: 0.55`. It is drawn with the exported `drawWatermark(ctx, doc.canvas, sizePx)` from `renderCollage.ts` at device pixel ratio, so it lines up with Preview and the file (FR-215, as changed 2026-09-24).
