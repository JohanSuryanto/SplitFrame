# Quickstart & Validation Guide: SplitFrame

This guide explains how to run the app and how to check that each user story works. For expected behaviors, see [contracts/ui-interactions.md](./contracts/ui-interactions.md). For function-level cases, see [contracts/layout-model.md](./contracts/layout-model.md).

## Prerequisites

- Node.js 22 LTS (or 20 LTS or newer) and npm
- A desktop browser (Chrome, Edge, Firefox or Safari) and, for the touch checks, a phone on the same network
- A few test photos, including at least one camera photo of 12 MP or more, one PNG with transparency, and one file that isn't an image

## Setup and run

```bash
npm install
npm run dev          # Vite dev server → http://localhost:5173
npm run dev -- --host  # to open it from a phone on the LAN
npm test             # Vitest unit tests (run once)
npm run test:watch   # Vitest watch mode
npm run build && npm run preview   # production build check
npm run typecheck    # tsc --noEmit
```

**Expected**: all unit tests pass, including the 8 required cases in the layout contract. The build output in `dist/` is static files only.

## Validation scenarios

These follow the delivery phases in the brief, with a Preview phase added after Export because Preview reuses the export renderer. Stop and review after each phase.

### Phase 1: Model and presets (User Story 1, partly)

1. Open the app. The title and header say "SplitFrame", and the canvas is 9:16 with one empty cell.
2. Click each preset (2, 3 and 4 columns, 2 and 3 rows, 2×2). The expected number of equal empty cells appears each time.
3. Switch between 1:1, 4:5, 16:9 and Custom 800×600. The layout keeps its proportions. Custom 0×600 is rejected with a message.

### Phase 2: Photos (User Stories 1 and 2)

1. Click an empty cell and pick a photo. It fills the cell with no empty space and no distortion.
2. Drag a photo file onto another cell. It gets placed there.
3. Drag inside a filled cell. It pans, but no empty space can ever appear. Scroll or pinch to zoom. Zooming out stops at cover size. Double-click to reset.
4. Try Replace, Remove and Reset position on a cell.
5. Drop the non-image file. A friendly error appears and the cell doesn't change.

### Phase 3: Drawing lines, straight and freehand (User Story 3)

1. Turn on Custom (Draw lines). The mode indicator changes.
2. Draw a slightly wobbly vertical stroke near the center. A guide appears, and on release the line snaps exactly to 50% and runs the full height.
3. Draw a horizontal stroke across only the right half. Only the right cell is split.
4. Draw a horizontal stroke across both columns. Both are split at the same height.
5. Draw a stroke very close to an edge. It turns red with "Too small", and on release nothing changes.
6. Draw a line across a cell that has a photo. While dragging, the photo shows its new crop. After release, the photo is in the top or left part.
7. Tap in Draw mode. Nothing happens.
8. Draw a diagonal across the top-left corner. It keeps its drawn (smoothed) shape and cuts off a triangle-like corner cell.
9. Draw an L: start at the left edge, go right, turn and go down past the bottom. One stroke carves out a rectangle-like cell.
10. Draw a horizontal line that starts a little to the left of an existing vertical line. Only the cell to the right of the vertical line is split.
11. Draw a figure-8. It's rejected with "Lines can't cross themselves".
12. Draw the reference sketch from the spec's clarifications (7 strokes). You get exactly 8 cells (SC-011).

### Phase 4: Dividers and undo (User Story 4)

1. Hover over a divider to see the resize cursor. Drag it: it's clamped at the minimum size and snaps to edges.
2. Select a divider between two photo cells and press Delete. The cells merge, the top/left photo is kept, and a toast appears.
3. Build a nested grid (split the right column into 3 rows), then delete the main vertical divider. You get one cell with the first left-side photo, and the toast gives the counts.
4. Press Ctrl/Cmd+Z. Everything from step 3 comes back in one step. Ctrl/Cmd+Shift+Z redoes it.
5. Drag a divider a long way, then undo once. The whole drag is reversed.

### Phase 5: Style (User Story 6)

1. Set gap 20, radius 16, padding 30 and color black. The preview updates live.
2. Push gap and padding to their limits on a crowded grid. Every cell stays visible.

### Phase 6: Export (User Story 1)

1. Export as PNG at 9:16. The file is named `splitframe-YYYYMMDD-HHmm.png` and is exactly 1080×1920 (check it in an image viewer).
2. Export as JPG at quality 60. The file is smaller and has the `.jpg` extension.
3. Compare the export with the editor side by side. Crops, gaps and corners match (SC-003).
4. Leave one cell empty and export. That cell shows the background color.
5. **Privacy check**: in DevTools → Network, clear the log, do a full session (upload, edit, preview, export), and confirm there are no requests other than dev-server assets (SC-005).

### Phase 7: Preview (User Story 5)

1. Fill every cell of a custom grid with differently shaped cells. A toast appears with a Preview action, and it doesn't open by itself.
2. Open Preview. No dividers or handles are shown, and each photo is cropped only to its own cell shape.
3. Close it with Escape. The editor is unchanged.
4. Export from Preview and compare the file with the preview. They match (SC-010).

### Phase 8: Mobile and accessibility (User Story 7)

1. On a phone: the style panel is a bottom sheet. Draw lines, drag dividers, and pan and pinch photos without the page scrolling or zooming. Export 6 camera photos in under 5 s without a crash (SC-006).
2. Using the keyboard only: Tab through the controls and cells, press Enter on an empty cell to open the picker, move a focused divider with the arrow keys, and undo and redo.
3. Run an axe or Lighthouse accessibility check. There should be no unlabeled buttons, and focus must be visible everywhere.
