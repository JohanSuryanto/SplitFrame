# Data Model: Photo Adjust Popup

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## CellImage (changed meaning, same shape)

`src/model/types.ts`. No new stored fields. Saved documents and undo history keep working.

| Field | Type | Before | After |
|---|---|---|---|
| `assetId` | `string` | unchanged | unchanged |
| `zoom` | `number` | `≥ 1` (1 = fills the cell), max `ZOOM_MAX` = 8 | **`> 0`**, max 8. Values below 1 are new: they zoom out toward "fit". When shown, it is clamped to `[zoomMin(cell, asset), 8]` (research P2). |
| `focusX`, `focusY` | `number` 0–1 | image point at the cell center, clamped so the photo covers | same meaning. Clamping follows the per-axis rule in P1: cover when larger than the cell, stay inside when smaller. |

**Validation**:
- `zoom` is snapped to exactly `1` when `|zoom − 1| ≤ 0.05` after a zoom gesture (FR-316).
- The spec's lower limit, "fit" (FR-314), is `zoomMin = min(Lw/aw, Lh/ah) / max(Lw/aw, Lh/ah)`.

## ImagePlacement (new, derived)

The result of `placeImage(cell, asset, img)`, in cell pixels. It's never stored.

| Field | Type | Meaning |
|---|---|---|
| `scale` | `number` | image px → cell px (`cover · effectiveZoom`) |
| `x0`, `y0` | `number` | top-left of the whole displayed image, relative to the cell (can be negative) |
| `src` | `SourceRect` | the visible part of the image, in image px |
| `dest` | `{ x, y, w, h }` | where that part goes, relative to the cell; the whole cell when the image covers it |

## AdjustSession (new, UI state only)

Held by the Editor while the popup is open. It's not in `Doc` or the history.

| Field | Type | Notes |
|---|---|---|
| `mode` | `'new' \| 'replace' \| 'adjust'` | how Done and Cancel behave |
| `cellId` | `string` | target cell |
| `assetId` | `string` | the photo being framed. For new or replace it's **held** in the image store until the popup closes (P7). |
| `framing` | `{ zoom, focusX, focusY }` | draft. It starts at `{1, 0.5, 0.5}` for new or replace, and at the current values for adjust. |

**Transitions**:

| From | Event | Effect |
|---|---|---|
| closed | pick a device photo for a cell (empty cell or Replace) | load the asset, hold it, open with mode `new` or `replace` |
| closed | ⋯ → Adjust… | open with mode `adjust` and the current framing |
| open | drag, pinch, wheel, slider, ± buttons, keys | update the draft only |
| open | Reset or double-tap | draft = `{1, 0.5, 0.5}` |
| open (`new`/`replace`) | Done | commit `setImage { cellId, assetId, framing }` (one Undo step), stop holding the asset, close |
| open (`adjust`) | Done | commit `setFraming { cellId, patch: framing }` (one Undo step), close |
| open (`new`/`replace`) | Cancel or Escape | stop holding the asset, release unreferenced assets, close; the collage is unchanged |
| open (`adjust`) | Cancel or Escape | close; the collage is unchanged |

## DocAction `setImage` (changed)

```
{ type: 'setImage'; cellId: string; assetId: string; framing?: { zoom: number; focusX: number; focusY: number } }
```

When `framing` is left out, the defaults are `{ zoom: 1, focusX: 0.5, focusY: 0.5 }`, as today. That's the path sample images use.
