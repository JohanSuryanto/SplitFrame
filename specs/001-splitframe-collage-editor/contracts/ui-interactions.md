# Contract: User Interface and Export Output

SplitFrame's only external interfaces are what the user can do with the app and the file it produces. This contract lists both so they can be tested.

## Gestures (Pointer Events: mouse, touch and pen behave the same)

| Target | Mode | Gesture | Result | Undo step |
|--------|------|---------|--------|-----------|
| Canvas | Draw | Drag ≥ 6 px | A live preview line. Nearly straight horizontal/vertical strokes show a straight line with snap guides; other strokes show the smoothed freehand path, trimmed at cell edges and extended up to 16 px to reach an edge. The line turns red with "Too small", "Lines can't cross themselves" or "Draw from edge to edge" when the split isn't allowed. Photos in cells under the line show their new crop (FR-045). On release the split is made, or rejected with no change. | 1 per accepted stroke |
| Canvas | Draw | Tap | Nothing happens (no file picker). | — |
| Empty cell | Arrange | Click or tap | Opens the file picker (`accept="image/*"`). | 1 when the image is set |
| Any cell | Any | Drop an image file | Sets that cell's photo. With several files, the first one is used. | 1 |
| Filled cell | Arrange | Drag | Pans the photo, clamped so it always covers the cell. | 1 per drag |
| Filled cell | Arrange | Wheel or pinch | Zooms around the pointer or pinch center, from 1× (cover) to 8×. | 1 per gesture (wheel: per 300 ms burst) |
| Filled cell | Arrange | Double-click or double-tap | Resets the framing. | 1 |
| Filled cell | Arrange | Drag onto another cell (hold for 350 ms first) | Swaps the two photos (optional FR-028). | 1 |
| Straight divider | Any | Hover | `row-resize` or `col-resize` cursor. | — |
| Straight divider | Any | Drag | Live resize, snapping to parallel edges and clamped to the minimum cell size (shaped cells inside stretch with it). | 1 per drag |
| Freehand divider | Any | Hover | Highlight; default cursor (not draggable). | — |
| Divider | Any | Click or tap | Selects the divider and shows the × handle. | — |
| × handle | Any | Click or tap | Removes the divider and shows the merge toast with Undo. | 1 |

## Keyboard

| Keys | Action |
|------|--------|
| Tab / Shift+Tab | Moves focus through the toolbar, then the cells in reading order, then the dividers, then the style panel. The focus ring is always visible. |
| Enter / Space on a cell | Empty cell: opens the file picker. Filled cell: opens the cell action menu (Replace, Remove, Reset position). |
| Arrow keys on a focused divider | Moves the divider by 1% (10% with Shift), with the same clamping as dragging. |
| Delete / Backspace | Removes the selected divider. On a focused filled cell, removes its photo. |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z, and Ctrl+Y | Redo |
| Escape | Cancels the current gesture, or closes Preview, the menu or the bottom sheet. |
| D / A | Switches to Draw lines mode / Arrange mode. |

## Screen layout (FR-038, UI refresh 2026-09-24)

- **Top bar**: SplitFrame wordmark · New collage (disabled when there's nothing to clear; asks "Start a new collage?" when there are photos or lines) · Undo · Redo · Preview · Export. With unsaved work, reloading or closing the tab shows the browser's leave-page warning. On phones the Preview and Export buttons are icon-only (with accessible names).
- **Dock** (floating, bottom center, thumb reach): **Layout** (opens a panel with canvas shape chips, Custom W×H, grid presets and Clear all lines) · **Draw** (toggles Draw mode) · **Style** (gap, corners, border, color swatches plus a custom color).
- **Export** (from the top bar) opens a panel: PNG/JPG, JPG quality, Download, output size.
- **Panels**: on wide screens (≥ 1024 px) a floating card on the right; below that, a bottom sheet with a grab handle. Escape, ×, the handle (tap or swipe down) or a press outside closes them. The canvas shrinks to stay fully visible.
- **Draw mode** shows a pill at the top of the canvas: "Drag across the canvas to split · Done".
- **Photo options**: the "⋯" button sits inside each photo and only shows on the hovered, focused or last-tapped photo.
- **Toasts** appear above the dock (at the top on phones).

Every control has an accessible name. The Draw-mode pill is announced through `aria-live="polite"`.

## Preview dialog (User Story 5)

- It's a modal dialog (`role="dialog"`, `aria-modal`) that traps focus and closes with Escape, the Close button, or tapping the backdrop.
- It shows a canvas made by `renderCollage` at screen size × `devicePixelRatio`. There are no dividers, handles, prompts or selection.
- Its actions are Close and Export (which uses the current export settings).
- After an upload fills the last empty cell, a toast appears saying "All cells filled — Preview". It doesn't open by itself.

## Toasts

| Trigger | Message (example) | Action |
|---------|-------------------|--------|
| Merge dropped content | "Merged — 2 dividers and 1 photo removed" | Undo |
| Preset dropped photos | "2 photos didn't fit the new layout" | Undo |
| File can't be read | "That file couldn't be opened as an image." | — |
| Export failed | "Export failed — try a smaller canvas size." | — |
| Last cell filled | "All cells filled" | Preview |

## Export output

| Property | Value |
|----------|-------|
| Pixel size | Exactly `canvas.width × canvas.height` |
| Formats | `image/png`, or `image/jpeg` at quality 0.10–1.00 (default 0.92) |
| Filename | `splitframe-YYYYMMDD-HHmm.png` or `.jpg`, in local time, with zero-padded 24-hour clock |
| Content | Background color, then each cell clipped to a rounded rectangle, then the photo cropped by `frameImage`. Empty cells are just background. |
| Match with Preview | The same `planDraw` output, scaled; edges within 1% (SC-003, SC-010) |
| Failure | Error toast, no download (FR-035) |
| Network | None. Output goes only to the browser's download (FR-001). |
