# Quickstart: validating the Photo Adjust Popup

**Feature**: [spec.md](./spec.md) · **Contract**: [contracts/adjust.md](./contracts/adjust.md)

## Prerequisites

`npm install`, then `npm run dev`. The phone checks can use `npm run dev -- --host` over a LAN; no HTTPS is needed for this feature. Have a few real photos: landscape, portrait and square.

## Automated checks

```sh
npm run typecheck
npm run lint
npm test   # frame.test.ts (old cases unchanged + new), planDraw, docReducer and image store cases
```

## Manual scenarios

| # | Steps | Expected | Covers |
|---|---|---|---|
| 1 | 9:16, 3 columns. Tap the left cell → "Choose from your photos" → pick a landscape photo. | The popup opens with a tall, narrow frame, with the outside part dimmed. The canvas hasn't changed yet. | US1, FR-301, FR-304, FR-305 |
| 2 | In the popup, drag left and right, then up and down. | The photo follows the drag where the rules allow. | FR-308, FR-315 |
| 3 | Use −, +, the slider, pinch (phone) and the scroll wheel (desktop). | Zoom changes smoothly. The slider has a "fill" mark. | FR-309, FR-310 |
| 4 | Tap Done. Then press Undo once. | The cell shows exactly the popup framing. One Undo removes the photo. | FR-312, SC-303 |
| 5 | Pick a photo again and tap **Cancel**. Repeat with Escape. Tap outside the popup. | Cancel and Escape close it with the cell still empty and nothing in Undo. An outside tap does nothing. | FR-313, SC-305 |
| 6 | Portrait photo in a 1:1 cell: zoom all the way out. | The whole photo is visible and centered, with background color on the left and right. It can be dragged sideways but never leaves the frame. | US2, FR-314, FR-315 |
| 7 | Done, then open Preview and Download. | The same gaps show in the background color in Preview and in the file. | FR-317 |
| 8 | Reopen via ⋯ → **Adjust…** and zoom in slowly past fill. | The zoom settles exactly at fill, with no hairline gap. | US3, FR-302, FR-316, SC-306 |
| 9 | Double-tap the photo in the popup, then press **Reset**. | Back to fill, centered. | FR-311 |
| 10 | Filled cell → ⋯ → Replace → pick a photo → Cancel. | The old photo is unchanged. Replace → Done swaps it in as one Undo step. | FR-301, FR-312, FR-313 |
| 11 | "Try sample photos", a sample from the chooser, and Layout → "Fill empty cells with samples". | Samples go straight in, with no popup. | FR-303 |
| 12 | Freehand (curved) cell → add a photo. | The popup frame has the curved shape. | FR-304 |
| 13 | Drag a divider so a photo's cell gets much narrower, then ⋯ → Adjust…. | The popup shows the new shape. A below-fill photo is pulled back inside if needed. | Edge case |
| 14 | Drag and pinch a photo directly in its cell below fill; double-tap it. | Gaps and snapping behave as in the popup. Double-tap resets to fill. | US4, FR-318 |
| 15 | Keyboard only: open Adjust…, then use the arrows, +, −, 0 and Enter. With a screen reader, check the labels. | Everything works, and focus returns to the cell after closing. | FR-320 |
| 16 | Phone portrait and landscape: open the popup. | The frame and all controls are visible without scrolling. Rotating keeps the framing. | FR-321 |
| 17 | Existing collage from before the update (open and undo through old edits). | Old photos look exactly as before. | FR-319 |

## Results

- **2026-09-28, local dev server**: the user tried the popup, including the UI polish (T022), and said it looks good. Individual results for #1–17 were not recorded. After that review, a fix was made so drag and pinch steps in the popup build on the latest framing, and none are dropped between renders.
