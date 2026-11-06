# Quickstart: Signature

## Automated

```bash
npm test          # signature.test.ts, removeBackground.test.ts, signature cases in docReducer/useHistory tests
npm run typecheck
npm run lint
```

Unit tests must cover:

- **`normalizeStrokes`**:
  - points end up in 0–1
  - aspect and lineWidth match a hand-computed box
  - a single point gives a square box of one pen width
- **`planSignature`**:
  - center and width on 1080×1920
  - half of everything at a 540×960 surface (SC-604)
  - `h = w / aspect`
  - the angle in radians
- **`removeBackground`** on synthetic images:
  - white (245) with a dark (30) bar: the bar gets alpha 255, the paper gets 0, and the box hugs the bar plus margin
  - a warm-light page (paper 185, ink 60): same outcome without changing sensitivity (Otsu)
  - sensitivity 0 vs 100 changes how much of a mid-grey (140) area is kept
  - an all-white image gives `box: null`
  - existing alpha 0 pixels stay 0
  - RGB is unchanged
- **Reducer**:
  - create applies the defaults
  - replace keeps placement
  - clamping (size 0.05 → 0.1 and 0.9 → 0.8, opacity, rotation snap, color)
  - `setSignature` with no signature and no-op patches return the same `doc`
  - `removeSignature`
  - `newCollage` keeps the signature
- **`historyAssets`**: includes a signature image asset found in past, present or future docs.

## Manual (`npm run dev`, then also on a phone with `-- --host`)

1. **Draw (US1)**:
   1. Make a 1-cell 16:9 canvas with a photo. Open Watermark → Signature → Draw signature, and sign with a finger.
   2. The line keeps up and looks smooth. Undo stroke, Clear, then sign again and tap Done.
   3. The signature shows at the bottom-right in dark ink. Drag it, then change size, rotation, opacity and color.
   4. Download PNG and JPG; both match the canvas.
   5. Set a custom canvas of 8000×4500 and download. Zoomed to 100%, the lines are smooth (SC-603).
2. **Upload (US2)**:
   1. Sign blue-pen and black-pen signatures on white paper and photograph them under indoor light. Upload each.
   2. The paper is gone without touching the slider (SC-602, 8/10 photos). Move the slider both ways.
   3. Tap Done. The result is cropped to the ink, and choosing black ink recolors it.
   4. Upload a logo PNG with Keep original colors on: its colors are kept.
   5. Upload a blank-page photo: "No signature found …", and Done is disabled.
   6. Upload a non-image file: the usual error toast appears.
3. **Change (US3)**: move and resize the signature, then Redraw: the new one keeps the place and size. Remove, then Undo: it's back.
4. **Together (US4)**:
   1. Set a Repeat text watermark and a signature. In the Text tab a drag moves the pattern; in the Signature tab it moves the signature.
   2. Export with the SplitFrame credit on: the order is pattern < signature < credit.
5. **No interference**: close the panel. Photos, lines and Draw work as before, and the marks never react.
6. **Memory**: in DEV, the console shows `[imageStore] N photo(s)`. Replace an uploaded signature 3 times, then make 100 other edits so undo can no longer reach the old ones: N drops back.
7. **Privacy**: DevTools → Network while doing all of the above: no requests. Reload: the signature is gone (SC-606).
8. **Keyboard**: Tab to the tabs, the pad buttons (Escape cancels the pad) and the canvas layer, and use the arrow keys.
