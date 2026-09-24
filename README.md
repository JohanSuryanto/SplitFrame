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
- Sample photos: six built-in generated artworks (drawn on your device) to try layouts without your own photos.
- Style: gap, corner radius, padding and color.
- Preview, then download as PNG or JPG at full resolution: `splitframe-YYYYMMDD-HHmm.png`.
- **Share to Story**: send the finished image straight to Instagram (Story) or WhatsApp (My status) through your device's share menu, without saving it first. See [Share to Story](#share-to-story).
- **Watermark**: a small “SplitFrame · splitframe.johansuryanto.dev” credit at the bottom of exported and shared images, on by default; switch it off in Export.
- Undo and redo everything (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z), last 100 changes.
- Works with mouse, touch and pen; keyboard reachable.

## Share to Story

**Share** (in Preview and the Export panel) opens your device's share menu with the finished image, exactly the file Download would give. Pick Instagram and choose Story, or WhatsApp and choose My status. SplitFrame itself uploads nothing and saves nothing: the image only leaves your device when you post it from the other app.

- It uses the browser's Web Share API, so it needs HTTPS (the Netlify site is; a plain `http://` LAN address is not).
- It shows up where the browser can share image files: iOS/iPadOS Safari, Android Chrome, Chrome/Edge on Windows and ChromeOS, and macOS Safari. Elsewhere (for example Firefox on desktop) the button is hidden and Download works as usual.
- A 9:16 canvas fills the Story frame; other shapes get borders added by Instagram or WhatsApp.
- On 9:16 the watermark sits 5% above the bottom edge, leaving a little room for Instagram's and WhatsApp's reply controls.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5175 (add -- --host to open it from a phone)
npm test           # Vitest unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # static files in dist/
npm run preview    # serve the production build
```

The layout model, geometry and draw plan are pure functions under `src/model` and `src/render/planDraw.ts`, covered by the unit tests. Design documents are in `specs/001-splitframe-collage-editor/`.

## Supported browsers

The latest two versions of Chrome, Edge, Firefox and Safari, plus iOS/iPadOS Safari 16.4 or newer.
