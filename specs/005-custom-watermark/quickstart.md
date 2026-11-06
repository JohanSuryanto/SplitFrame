# Quickstart: Custom Watermark

## Automated

```bash
npm test          # includes textMark.test.ts and the setWatermark cases in docReducer.test.ts
npm run typecheck
npm run lint
```

Unit tests must cover:

- `planTextMark` returns `null` for empty text, and puts a single point at `(x·w, y·h)`.
- `fontPx` scales with the surface: the same mark at 540 px and 1080 px wide gives proportional font size and points (SC-502).
- Repeat: for a 1080×1920 canvas at size 0.06 and −30°, every quarter of the canvas contains at least one point whose copy fits fully inside that quarter (SC-503).
- Reducer: clamping of every field, the rotation snap, the Repeat −30° rule, a no-op patch returning the same `doc`, and `newCollage` keeping the watermark.

## Manual (`npm run dev`, then also on a phone with `-- --host`)

1. **ID stamp (US1)**: Layout → 1 cell, 16:9. Add a photo. Watermark → type "For verification by Bank X only". The text appears centered, white, at 50%. Drag it to the top-left with a finger; set size, rotation, red, 70%. Download PNG and JPG: both match the canvas. Undo steps back through the color, rotation, size, move and text, one at a time.
2. **Repeat (US2)**: switch Repeat on. Text tiles at −30° to all corners. Drag: the pattern shifts. Crop each quarter of the downloaded file: each shows the text. Switch Repeat off: the single mark is back where it was.
3. **Date (US3)**: tap Add date with text, then with an empty box. Check the format matches the device locale. Undo removes it.
4. **Credit separate (US4)**: Export → **SplitFrame credit** off → download: custom mark only. On: both, with the credit on top.
5. **No interference**: close the panel. Pan and zoom photos, drag lines, and draw lines. The mark never reacts. Reopen the panel: dragging moves the mark and doesn't close the sheet.
6. **Shape change**: switch 16:9 → 9:16 → custom 3000×2000. The mark stays in the same relative spot and size.
7. **Keyboard**: Tab to the canvas mark and press arrow keys and Shift+arrow; Center button. Screen reader announces the panel controls and the Repeat switch state.
8. **Privacy**: DevTools → Network while doing all of the above: no requests (SC-505).
