# Data Model: Custom Watermark

This adds to [001 data-model.md](../001-splitframe-collage-editor/data-model.md). Only the changes are listed.

## 1. `Watermark` (new, on `Doc`)

```ts
interface Watermark {
  text: string;      // '' = no watermark; ≤ 100 chars
  color: string;     // '#RRGGBB', uppercase
  opacity: number;   // 0.1–1
  size: number;      // text height ÷ canvas short side, 0.02–0.2
  rotation: number;  // degrees, −90–90; |r| ≤ 3 snaps to 0
  x: number;         // text center ÷ canvas width, 0–1 (Repeat: pattern offset)
  y: number;         // text center ÷ canvas height, 0–1
  repeat: boolean;   // tile across the canvas
}

interface Doc { canvas; layout; style; watermark: Watermark }

const DEFAULT_WATERMARK: Watermark = {
  text: '', color: '#FFFFFF', opacity: 0.5, size: 0.06, rotation: 0, x: 0.5, y: 0.5, repeat: false,
};
```

**Validation** (in the reducer, never in components): every number is clamped to its range. A color that isn't `#RRGGBB` is ignored. Text longer than 100 characters is cut.

**Lifecycle**: `initialDoc()` starts with `DEFAULT_WATERMARK`. `newCollage` keeps the watermark, just as it keeps the canvas and style, because it's a document-wide setting and not content. It's never saved.

## 2. Action

```ts
| { type: 'setWatermark'; patch: Partial<Watermark> }
```

| Rule | Effect |
|------|--------|
| No field changes after clamping | returns the same `doc` (no history entry) |
| `repeat` false → true and current rotation is 0 | rotation becomes −30 |
| `repeat` true → false | rotation and position unchanged (the single mark comes back where it was) |

## 3. Draw plan (render only, not stored)

```ts
interface TextMarkOp {
  text: string;
  font: string;          // watermarkFont(fontPx)
  fontPx: number;
  color: string;         // mark.color
  alpha: number;         // mark.opacity
  angle: number;         // radians
  points: Pt[];          // centers in surface px; 1 for single, lattice for repeat
}

planTextMark(mark: Watermark, canvas: {width; height}, sizePx: Size, measure): TextMarkOp | null
```

- `fontPx = mark.size · min(W, H) · (sizePx.w / W)`
- Single: `points = [{ x: mark.x · sizePx.w, y: mark.y · sizePx.h }]`
- Repeat: row step `dx = textWidth + 2·fontPx`, row spacing `dy = 2·fontPx`. Points sit on the lattice rotated by `angle`, shifted by `((x−0.5)·w, (y−0.5)·h)`, and are kept only within `diagonal/2 + max(dx, dy)` of the surface center.

## 4. UI state changes

- `PanelName` gains `'watermark'`.
- `ExportSettings.watermark` (the 003 credit) is unchanged in data; only its visible label becomes "SplitFrame credit".
