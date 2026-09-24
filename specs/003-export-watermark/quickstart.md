# Quickstart: validating the Export Watermark

**Feature**: [spec.md](./spec.md) · **Contract**: [contracts/watermark.md](./contracts/watermark.md)

## Prerequisites

- `npm install` done. `npm run dev` is enough for everything except the phone Story checks, which need the HTTPS production site or a deploy preview (see feature 002 quickstart).
- For #8–9: an iPhone and an Android phone with Instagram and WhatsApp.

## Automated checks

```sh
npm run typecheck
npm run lint
npm test   # includes src/render/watermark.test.ts and the sameExportInput cases
```

## Manual scenarios

| # | Steps | Expected | Covers |
|---|---|---|---|
| 1 | Fresh load. Open Export. | The Watermark switch is **on**, with the description showing the credit text. | FR-209, FR-210 |
| 2 | 9:16, 3 photos, Download. Open the file. | "SplitFrame · splitframe.johansuryanto.dev" at the bottom center, about 5% up from the bottom edge. | US1, FR-201–203 |
| 3 | Look at the editing canvas, then open the Export panel, then open Preview. | While editing: **no** credit. With Export open: the credit appears on the canvas exactly as in the file, and dragging photos under it still works. Preview shows it in the same place and at the same relative size. | FR-211, FR-215, SC-202 |
| 4 | Put a pure white photo, then a pure black photo, then a busy photo at the bottom center. Export each. | The credit is readable on all three. | FR-205 |
| 5 | Switch to 1:1 and export. | The credit sits near the bottom (about 3% of the side) and is centered. | FR-204 |
| 6 | Custom 2160×3840 vs 1080×1920: export both and compare. | The credit covers the same proportion of the image. | SC-204 |
| 7 | Custom 300×300. Open Export. | The note says "Too small for a watermark", and the export has no credit. | FR-208 |
| 8 | Phone: share the 9:16 collage to an Instagram Story. | The credit is fully visible and not under the reply bar or profile header. | FR-203, SC-203 |
| 9 | Phone: share it to WhatsApp My status. | Same as #8. | SC-203 |
| 10 | With Export open, switch Watermark **off**, then on, then off. Download, open Preview, Share. | The canvas credit disappears and reappears with each flip. With it off, no credit anywhere. | US2, FR-211, FR-215, SC-201 |
| 10a | Open Preview and use its **Watermark** switch. On a phone-width screen, check that the bar wraps neatly onto two rows. | The credit disappears and reappears in Preview straight away. The Export panel switch shows the same state, and Share or Export from Preview follows it. | FR-209a, FR-211 |
| 11 | Open Preview (it renders the share image in advance), close it, switch Watermark off in Export, reopen Preview and Share. | The shared image has **no** credit, so the stale pre-render wasn't used. | Edge case, research W7 |
| 12 | With Watermark off, press Undo. | The switch stays off, and only collage edits are undone. | FR-212 |
| 13 | Reload the page. | Watermark is on again. | FR-210 |
| 14 | Keyboard: Tab to the switch and press Space. Check with a screen reader. | It toggles, and the reader announces "Watermark, switch, on/off". | FR-213 |

## Results

- **2026-09-24, local dev server**: the user checked the watermark and confirmed it works: the Export panel and Preview switches, the credit on the canvas only while Export is open, and the 9:16 position at 5%. The phone Story/Status checks (#8–9) are to be done on production after deploy. If WhatsApp's Reply button covers the credit, raise `STORY_MARGIN` in `src/render/watermark.ts`.
