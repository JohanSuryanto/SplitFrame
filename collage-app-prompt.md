# Build: SplitFrame — Custom-Grid Photo Collage Web App (Frontend Only)

App name: **SplitFrame**. Use it for the page title, header/logo text, `package.json` name (`splitframe`), and export filenames.

## Goal
Build a browser-only web app where users split a canvas into cells (using presets or by drawing their own lines), put a photo in each cell, and export the result as one merged image. Think Instagram Story "Layout", except users can draw their own grid.

## Hard constraints
- **Frontend only.** No backend, no database, no analytics, no network calls for user data. Images never leave the user's device.
- Load images with `URL.createObjectURL` (revoke them when replaced or removed) or `FileReader`.
- Export is rendered client-side with `<canvas>` and downloaded directly.
- No persistence required. (Optional later: localStorage for the layout only, never the images.)

## Tech stack
- React + TypeScript + Vite
- Plain CSS modules or Tailwind (pick one and stay consistent)
- State: React state + `useReducer` (or Zustand if it gets complex). Must support undo/redo.
- Use Pointer Events so mouse, touch and pen all work.
- No heavy canvas libraries unless clearly justified.

## Core concepts

### Canvas
- Aspect ratio presets: **9:16 (Story)**, **1:1**, **4:5**, **16:9**, plus **Custom** (width × height in px).
- The editor shows a scaled-down preview. Export happens at full target resolution (e.g. 1080×1920 for 9:16).

### Layout model
- Lines are **horizontal or vertical only**, so every cell is a rectangle.
- Store the layout as a **split tree** with normalized coordinates (0–1):
  ```ts
  type Node =
    | { type: 'cell'; id: string; image?: CellImage }
    | { type: 'split'; id: string; direction: 'horizontal' | 'vertical';
        ratio: number; // 0–1, position of the divider
        a: Node; b: Node };
  type CellImage = { src: string; naturalW: number; naturalH: number;
                     scale: number; offsetX: number; offsetY: number };
  ```
- Compute cell rectangles by walking the tree. This is the single source of truth for the editor view and for export.

### Layout modes
1. **Presets:** 2 columns, 3 columns, 4 columns (and ideally 2 rows, 3 rows, 2×2 grid). Each preset simply generates a split tree.
2. **Custom (special mode):** the user draws their own lines.
   - Choosing Custom starts from the current layout (so a preset can be refined) or from a blank single cell. Include a "Clear" action.

### Drawing rules (Custom mode)
- The user drags on the canvas. The dominant drag axis decides the orientation (mostly horizontal drag → horizontal line).
- Lines must run **end to end**. A line always spans the full width or height of the cell it splits, from boundary to boundary. The user doesn't need to be precise: on release, the stroke snaps to a full-span line.
- If a stroke crosses several cells in its direction, split each crossed cell at the same coordinate.
- Snapping: snap to the canvas center, to thirds, and to existing parallel edges within ~8px (show a guide while dragging).
- Reject splits that would make a cell smaller than a minimum size (e.g. 5% of canvas or 40px), and show a visual hint when that happens.
- Show a live preview line while the user drags.

### Editing lines
- Hovering a divider shows a resize cursor. Dragging it changes `ratio`, clamped by the minimum cell size.
- Select a divider and press Delete/Backspace (or tap an × handle) to remove it. This merges the two sides. Keep the image from side `a` if both sides have one, and note that in the UI.

### Cells & images
- Clicking an empty cell opens a file picker (`accept="image/*"`). Drag-and-drop a file onto a cell also works.
- Images fill the cell with object-fit **cover** by default.
- Inside a filled cell: drag to pan, and scroll-wheel or pinch to zoom (never zoom below cover). Double-click resets.
- Per-cell actions: Replace, Remove, Reset position.
- Optional: drag an image from one cell to another to swap them.

### Styling options
- Gap / border width (0–40px, scaled for export)
- Border / background color
- Corner radius for cells
- Canvas outer padding

### Export
- Format: PNG or JPG (with a JPG quality slider).
- Render on an offscreen canvas at full resolution using the same cell rectangles, the same gap/radius, and each image's pan/zoom.
- Empty cells render as the background color.
- Trigger a download (`canvas.toBlob` + anchor download). Filename: `splitframe-YYYYMMDD-HHmm.png`.
- Handle large images safely (downscale sources larger than the export size to avoid memory issues on mobile).

### UX
- Layout: toolbar at the top (aspect ratio, layout presets, Custom toggle, undo/redo, export). Canvas in the center. Style panel on the side (a bottom sheet on mobile).
- Mode indicator: in "Draw lines" mode, dragging creates lines. In "Arrange" mode, dragging pans images.
- Undo/redo: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
- Fully usable on mobile (touch drawing, pinch zoom in cells).
- Accessible: buttons have labels, focus states are visible, and cells can be reached by keyboard (Enter opens the file picker).

## Project structure (suggested)
```
src/
  model/layout.ts       // tree types, split/merge/resize, computeRects
  model/presets.ts      // 2/3/4 columns etc.
  model/snap.ts         // snapping logic
  render/exportCanvas.ts
  components/Editor.tsx, Cell.tsx, Divider.tsx, Toolbar.tsx, StylePanel.tsx
  hooks/useHistory.ts   // undo/redo
```

## Testing
- Unit tests (Vitest) for `layout.ts`: split, multi-cell split, merge on delete, resize clamping, `computeRects`, presets.
- Unit tests for snapping.
- One test checking that the export renders expected cell rectangles for a known layout.

## Delivery plan (implement in this order and stop after each phase for review)
1. Scaffold the project, the layout model + tests, and presets rendered as empty cells.
2. Image upload, cover fit, pan/zoom inside cells.
3. Custom mode: draw lines with preview + snapping, min-size rule.
4. Drag to resize dividers, delete to merge, undo/redo.
5. Style options (gap, color, radius, padding).
6. Full-resolution export (PNG/JPG).
7. Mobile/touch polish and accessibility pass.

## Out of scope (for now)
- Diagonal or curved lines, non-rectangular cells
- Text, stickers, filters
- Accounts, cloud saving, sharing links

Before writing code, restate your understanding of the drawing rules and the data model, and list any assumptions you're making.
