# UI Contract: Signature

## Watermark panel tabs

- At the top of the Watermark sheet: a segmented control with **Text** and **Signature** (`aria-pressed`). The selection is remembered while the page is open.
- Text tab: unchanged from feature 005.
- The selected tab decides what the canvas layer moves (drag and arrow keys).

## Signature tab

| State | Controls |
|-------|----------|
| No signature | **Draw signature** (primary), **Upload signature**; note "Stays on your device and is forgotten when you close the page." |
| Has signature | Thumbnail · **Redraw** · **Upload** · **Remove** · Size slider 10–80 % · Rotation −90–90 ° · Opacity 10–100 % · Ink color swatches (`#111111`, `#FFFFFF`, `#1E3A8A`, `#E53935`) + picker (hidden if Keep original colors) · **Center** |

| Control | Undo |
|---------|------|
| Done in pad / upload dialog | one step (create or replace picture) |
| Remove | one step |
| Slider drag, color picker session | one step each; keyboard steps commit |
| Swatch, Center | one step |
| Drag on canvas | one step; pointer cancel restores |
| Arrow key (Signature tab, layer focused) | one step per press; 1 %, Shift 10 % |

## Signature pad dialog

- Title "Draw your signature". Canvas: 2:1 on phones (full width, at most 60% of the viewport height), 3:1 on desktop (up to 720 px wide). Faint baseline at 75% height with an "×". Placeholder "Sign here" until the first stroke.
- Buttons: **Undo stroke** (disabled when empty), **Clear** (disabled when empty), **Cancel**, **Done** (primary, disabled when empty).
- Escape or the backdrop = Cancel. Nothing changes the document until Done.
- Labelled for screen readers: "Signature pad. Draw with your finger, mouse or pen."

## Upload dialog

- Opens after a file is chosen through the hidden `accept="image/*"` picker. Load errors show the existing photo error toast and no dialog.
- Title "Use a photo of your signature". Preview of the cleaned result on a checkerboard, cropped to the ink.
- **Sensitivity** range 0–100, default 50, labelled "Sensitivity". Higher keeps more.
- **Keep original colors** switch, default off. Hint: "On for a logo; off to recolor the ink."
- With no ink found: "No signature found — try a higher sensitivity or a clearer photo", and Done disabled.
- **Cancel**, **Done**. Escape = Cancel.

## Canvas and export

- Draw order: collage → text watermark → signature → SplitFrame credit.
- The signature is always visible when present. It's interactive only while the Watermark panel is open on the Signature tab.
