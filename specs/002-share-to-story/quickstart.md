# Quickstart: validating Share to Story

**Feature**: [spec.md](./spec.md) · **Contract**: [contracts/share.md](./contracts/share.md)

## Prerequisites

- Node and npm as for the base app (`npm install` done).
- An **iPhone** (iOS 16.4+, Safari) and an **Android phone** (Chrome), both with Instagram and WhatsApp installed and logged in.
- A desktop Firefox for the fallback check.
- The Web Share API needs a **secure context**. Test on the Netlify deploy preview, or run `npm run dev -- --host` and open it through an HTTPS tunnel. A plain LAN `http://` address won't expose sharing on phones.

## Automated checks

```sh
npm run typecheck
npm run lint
npm test          # includes src/render/share.test.ts (every row of the shareFile mapping, canShareImages, isStoryShape)
```

Expected: all pass, and the existing `filename.test.ts` is unchanged.

## Manual scenarios

| # | Steps | Expected | Covers |
|---|---|---|---|
| 1 | Phone: 9:16, 3 columns, add 3 photos. Open Export and tap **Share**. | The share sheet opens with one image. Share is the top, primary button. | US1, FR-101, FR-109 |
| 2 | From 1, pick **Instagram → Story** (Android: "Stories" target). | The Story editor shows the collage filling the frame. | US1-AS2, SC-101 |
| 3 | Repeat with **WhatsApp → My status**. | The Status editor shows the collage. | US1-AS3 |
| 4 | After 2–3, check Photos/Gallery and Downloads. | No new SplitFrame file. | FR-103, SC-104 |
| 5 | Tap Share, then dismiss the sheet. | Back in the editor, no toast, collage unchanged. | FR-106 |
| 6 | Return to SplitFrame after posting. Change a photo and share again. | The collage is still there, and the second share shows the change. | FR-107 |
| 7 | Download the same collage and compare it with the shared image (AirDrop or send to yourself as a file). | Same pixel size and look. | FR-102, SC-103 |
| 8 | Fill all cells, open **Preview**, tap Share. | The sheet opens almost instantly (pre-rendered). The bar shows Close · Share · Export. | US2, FR-108, SC-102 |
| 9 | Switch the canvas to 1:1 and open Export. | Hint "Stories are 9:16 — other shapes get borders." Share still works. | FR-111 |
| 10 | Double-tap Share quickly. | Only one sheet opens. The button reads "Preparing…" while busy. | FR-113 |
| 11 | Custom size too large for the device (e.g. 6000×6000 on iPhone). Tap Share. | The "Export failed — try a smaller canvas size." toast appears and no sheet opens. | FR-114 |
| 12 | iPhone, Export panel, 6 × 12 MP photos at 9:16 PNG. Tap Share. | Either the sheet opens, or the toast "Your image is ready" [Share] appears and tapping it opens the sheet. Never a silent failure. | FR-116 |
| 13 | Desktop Firefox: open Export and Preview. | No Share button. Download works as before. | US3, FR-112, SC-105 |
| 14 | Keyboard only (desktop Chrome on Windows): Tab to Share and press Enter. Check with a screen reader. | The Windows share panel opens. The name is announced as "Share to Story or other apps". | FR-117 |
| 15 | Empty collage (no photos): tap Share. | The sheet opens with an image in the background color, same as Download. | FR-110 |

## Results

- **2026-09-24, production (`main` at `f88eaf4`)**: the user tested on production and confirmed that sharing works, including posting to Stories. Per-scenario results for #1–15 were not recorded individually.
