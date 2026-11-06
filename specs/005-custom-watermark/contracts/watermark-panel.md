# UI Contract: Watermark panel and canvas mark

## Dock

- New item **Watermark** (between Style and the end), `aria-expanded`, `aria-controls="watermark-sheet"`. Opening it closes any other panel and leaves Draw mode, like Layout and Style do.

## Watermark panel (sheet titled "Watermark")

| Control | Element | Behaviour | Undo |
|---------|---------|-----------|------|
| Text | `<input type="text" maxLength=100>`, label "Watermark text" | Live on the canvas while typing; empty removes the mark | One step per focus session (preview, endGesture on blur) |
| Add date | button | Appends `" · " + local short date`, or the date alone if empty | One step |
| Repeat | `role="switch"`, `aria-checked` | Tiles across the canvas; turning it on with rotation 0 sets −30° | One step |
| Size | range 2–20 (% of short side) | Live | One step per drag; keyboard step commits |
| Rotation | range −90–90 (°), output shows value | Snaps to 0 within ±3 | Same |
| Opacity | range 10–100 (%) | Live | Same |
| Color | 4 swatches (`aria-pressed`) + `<input type="color">` | Live | Swatch: one step; picker: one step per open/close |
| Center | button | x = y = 0.5 | One step |

All controls except Text and Add date are disabled while the text is empty.

## Canvas mark

- Always drawn when the text is non-empty, in every mode, above photos and lines and below divider handles and menus.
- **Panel closed**: `pointer-events: none`, `aria-hidden`. It never interferes with cells, lines or Draw.
- **Panel open (text non-empty)**: the layer catches pointer input (`touch-action: none`), is focusable (`aria-label="Watermark position. Drag or use arrow keys to move."`), and is excluded from sheet outside-press closing.
  - Drag anywhere: the mark (or pattern) moves by the pointer's delta. One drag is one undo step. Pointer cancel restores the start.
  - Arrow keys: 1% move; with Shift, 10%. Each press is one step.
  - The center is clamped to the canvas.

## Export / Preview

- `renderCollage` draws: collage → custom mark → SplitFrame credit (if on).
- Export panel and Preview switch label: **SplitFrame credit**; description unchanged otherwise.
