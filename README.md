# SplitFrame

Split a canvas into your own grid, put a photo in each cell, and download one merged image. Think Instagram Story "Layout", except you draw the grid yourself: straight lines, diagonals, L shapes or curves.

## Privacy

SplitFrame runs entirely in your browser. There is no backend, no account, no analytics and no network call with your data: photos are decoded, edited and exported on your device, and never leave it. The production build adds a Content Security Policy with `connect-src 'none'`, so the page cannot send anything anywhere even by accident. Nothing is saved between sessions.

## Features

- Canvas shapes: 9:16 (Story), 1:1, 4:5, 16:9, or a custom size from 100 to 8000 px.
- Layout presets: 2, 3 or 4 columns, 2 or 3 rows, 2×2.
- **Draw lines** (press **D**): nearly straight strokes snap to exact horizontal or vertical lines (and to the center, thirds and other lines); any other stroke keeps its drawn shape. Overshoot past an edge or line is ignored.
- Drag straight lines to resize; select any line and press **×** or **Delete** to merge the cells beside it.
- Photos: click or drop to add, drag to pan, scroll or pinch to zoom, double-click to reset, hold and drag to swap. The **⋯** menu offers Replace, Reset position and Remove.
- Style: gap, corner radius, padding and color.
- Preview, then download as PNG or JPG at full resolution: `splitframe-YYYYMMDD-HHmm.png`.
- Undo and redo everything (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), last 100 changes.
- Works with mouse, touch and pen; keyboard reachable.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173 (add -- --host to open it from a phone)
npm test           # Vitest unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # static files in dist/
npm run preview    # serve the production build
```

The layout model, geometry and draw plan are pure functions under `src/model` and `src/render/planDraw.ts`, covered by the unit tests. Design documents are in `specs/001-splitframe-collage-editor/`.

## Supported browsers

The latest two versions of Chrome, Edge, Firefox and Safari, plus iOS/iPadOS Safari 16.4 or newer.
