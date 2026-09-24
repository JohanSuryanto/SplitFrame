# Data Model: Export Watermark

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

No persistent data. One field is added to existing session state, plus one new draw instruction.

## ExportSettings (changed)

`src/state/uiState.ts`

| Field | Type | Default | Notes |
|---|---|---|---|
| `format` | `'png' \| 'jpg'` | `'png'` | unchanged |
| `quality` | `number` 10–100 | `92` | unchanged |
| **`watermark`** | `boolean` | **`true`** | New. Session only; not saved and not in undo history (FR-210, FR-212). Applies to Download, Share and Preview (FR-211). |

`setExportSettings({ watermark })` goes through the existing reducer case with no extra validation.

## WatermarkOp (new)

The output of `planWatermark`, in the pixel space of the surface being drawn (the Preview backing store or the export canvas).

| Field | Type | Rule |
|---|---|---|
| `text` | `string` | Always `WATERMARK_TEXT` = `"SplitFrame · splitframe.johansuryanto.dev"` (FR-201) |
| `x` | `number` | `sizePx.w / 2` (centered, FR-202) |
| `y` | `number` | Baseline: `(H − margin − 0.25·f)·k`. The margin is `0.05·H` for 9:16 and `0.03·S` otherwise, in export px; the 0.25·f keeps descenders out of the margin (FR-203, FR-204). |
| `fontPx` | `number` | `f·k`, where `f = min(0.025·S, fitted to 0.90·W)` in export px (FR-206, FR-207) |
| `font` | `string` | `` `600 ${fontPx}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` `` |
| `color` | `string` | `rgb(255 255 255 / 0.92)` |
| `shadow` | `{ color: string; blur: number; offsetY: number }` | `rgb(0 0 0 / 0.55)`, `0.35·fontPx`, `0.06·fontPx` (FR-205) |

Where `W, H` = `doc.canvas.width/height`, `S = min(W, H)`, and `k = sizePx.w / W`, the Preview-to-export scale.

**Validation**: the result is `null`, meaning nothing is drawn, when the fitted `f < 10` export px (FR-208). `watermarkFits(canvas)` returns the same answer for the UI note.

## Export input identity (changed)

`sameExportInput(a, b)` decides whether a rendered share file can be reused (research W7):

```
a.doc === b.doc
&& a.settings.format === b.settings.format
&& a.settings.watermark === b.settings.watermark
&& (format === 'png' || a.settings.quality === b.settings.quality)
```
