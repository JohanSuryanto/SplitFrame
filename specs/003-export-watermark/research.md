# Research: Export Watermark

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-24

Numbered W1–W9. The base feature uses R1–R25 and Share to Story uses S1–S10.

---

## W1. Where the watermark is drawn

**Decision**: Add a pure `planWatermark(canvas, sizePx, measure)` in `src/render/watermark.ts`. It returns one `text` draw op, or `null`. `renderCollage` gets an options argument `{ watermark: boolean }` and draws the op after the collage.

**Rationale**:
- `renderCollage` is called only by Preview (`PreviewDialog.tsx`) and export (`exportCanvas.ts`). The editor canvas is built from DOM elements, so the watermark can't appear while editing (FR-215). Preview matches export by construction (FR-211, SC-202).
- The existing pattern is: plan as pure data, then execute on a canvas (`planDraw` → `renderCollage`, research R11). Following it lets the geometry be unit-tested without a canvas.

**Alternatives considered**:
- *Add the watermark op inside `planDraw`*: it would mix an export setting into a function that today depends only on the document. That would change the signature of a well-tested function for a single overlay. Rejected.
- *Draw it as a DOM overlay in Preview*: this could drift from the export. Rejected.

## W2. Geometry: size, placement, fit

All values are computed against the **export** canvas (`doc.canvas.width/height`), then scaled by `sizePx.w / canvas.width` to whatever is being drawn. Preview and the file therefore differ only in scale (SC-202), and the "readable minimum" is judged at export resolution (FR-208).

Let `S = min(W, H)` (the export short side).

| Quantity | Rule | Source |
|---|---|---|
| Nominal font size `f₀` | `0.025 · S` | FR-206 |
| Max text width | `0.90 · W` | FR-207 |
| Fitted font size `f` | `f₀`, scaled down by `0.90·W / measure(text, f₀)` if the text is wider than the max | FR-207 |
| Omit | if `f < 10` (export px) | FR-208 |
| Bottom margin, 9:16 | `0.05 · H` (was 0.12, changed at the user's request) from the bottom edge to the **bottom of the text** (descenders included) | FR-203 |
| Bottom margin, other shapes | `0.03 · S` | FR-204 |
| Horizontal | centered: `textAlign = 'center'` at `x = W / 2` | FR-202 |
| Vertical | `textBaseline = 'alphabetic'`, baseline at `H − margin − 0.25·f`, reserving 0.25·f for descenders (the "p" in "splitframe") so no pixel dips into the margin | FR-202, FR-203 |

With a text height of 0.025·S, the credit's top on a 9:16 canvas is at about 93% of H.

`isStoryShape` from `src/render/share.ts` (feature 002) decides the 9:16 case, so both features agree on what counts as a Story.

**Worked example, 1080×1920**: S = 1080, f₀ = 27 px. Measured at 27 px, the text is about 560 px wide, under the 972 px cap, so f = 27. The baseline is at 1920 − 96 − 6.75 = 1817.25.

**Omit threshold**: f₀ < 10 when S < 400. The width cap almost never applies: the 41-character credit is about 0.56·S wide at f₀, and S ≤ W, so it stays under 0.9·W. It is a safety net for an unusually wide system font. So in practice the rule is simply **short side ≥ 400 px**.

## W3. Readability on any background (FR-205)

**Decision**: white text (`rgb(255 255 255 / 0.92)`), weight 600, with a soft dark shadow: `shadowColor = rgb(0 0 0 / 0.55)`, `shadowBlur = 0.35·f`, `shadowOffsetY = 0.06·f`. There's no box behind it.

**Rationale**:
- A shadow keeps white text readable on white photos and on white padding.
- It looks lighter than a box ("not distracting", SC-205) and matches how Instagram's own text reads.
- The shadow values scale with `f`, so Preview and export look the same at any size.

**Alternatives considered**:
- *Translucent rounded pill behind the text*: stronger contrast but heavier-looking. Keep it as a fallback if testing on a pure white background shows the shadow isn't enough (quickstart #4).
- *Pick black or white text from the average brightness underneath*: this needs pixel reads (`getImageData`) at full size, which is slow on phones, and the result would change as photos move. Rejected.

## W4. Font

**Decision**: the app's own system stack, `600 {f}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, matching `--font` in `tokens.css`.

**Rationale**:
- No web font to load. The CSP only allows fonts from `'self'`, and a bundled font would add weight and a loading race before the first export.
- On the same device, Preview and export use the same font, so FR-211 holds. Across devices the credit may use a slightly different system font, which is acceptable for a credit line.

## W5. Measuring text in a pure function

**Decision**: `planWatermark` takes `measure: (text: string, fontPx: number) => number`. `renderCollage` passes a function built on `ctx.font` and `ctx.measureText(text).width`. Tests pass a fake: `chars × 0.55 × fontPx`.

**Rationale**: the planner stays pure and testable in the `node` environment, where there is no canvas. Text width is the only thing it needs from the canvas.

## W6. The setting: where it lives, default, persistence

**Decision**: add `watermark: boolean` to `ExportSettings` in `src/state/uiState.ts`. The default is `true` in `initialUiState`.

**Rationale**:
- `ExportSettings` already holds format and quality, which aren't in the undo history and aren't persisted. Watermark gets the same behavior for free (FR-210, FR-212).
- It already flows to `ExportPanel`, `PreviewDialog`, `renderExportFile` and `useShare`, so no new plumbing is needed.

**Alternatives considered**: storing it on the `Doc` would put it in undo/redo, which breaks FR-212. Rejected.

## W7. Share cache must include the watermark (edge case "Sharing from Preview")

**Finding**: `useShare`'s `sameInput` compares only `doc`, `format` and `quality`. After this feature, toggling Watermark would keep the same key and **share a stale image**.

**Decision**: compare `watermark` too. Move `sameInput` out of the hook into an exported pure helper, `sameExportInput(a, b)` in `src/render/exportCanvas.ts`, so it can be unit-tested and future export settings are harder to forget. It compares `doc` by reference and `format` and `watermark` by value, and `quality` only when the format is JPG.

## W8. The switch UI (FR-209, FR-213)

**Decision**: a native `<button role="switch" aria-checked={on}>` row in the Export panel, placed after Format and Quality and before the actions:
- Label "Watermark".
- Description "Adds “SplitFrame · splitframe.johansuryanto.dev” at the bottom".
- A visual track and thumb, drawn in CSS.

When `!watermarkFits(doc.canvas)`, the description reads "Too small for a watermark" instead. The switch keeps working, but its setting has no effect at that size.

**Rationale**:
- A button with `role="switch"` gets Enter/Space for free, announces on/off, and works with touch and mouse.
- The existing panel uses segmented `aria-pressed` buttons for Format. A single on/off setting is clearer as a switch.

## W9. Testing approach

- **Unit tests (node)** in `src/render/watermark.test.ts`, using a fake `measure`:
  - 9:16 baseline at `H − 0.05H − 0.25f`; 1:1 and 16:9 baseline at `H − 0.03S`.
  - `f = 0.025S` at 1080×1920. At 2160×3840, `f` and the margin are exactly doubled (SC-204).
  - Width cap: with a fake `measure` that returns 2× the width, a 1080×1080 canvas gets `measure(text, fontPx) ≤ 0.9·W` and a smaller `f`.
  - Canvas with short side 300: `null`.
  - Preview scale: for `sizePx` at half size, every value is exactly half of the export value (SC-202).
  - `watermarkFits` matches the `null` result.
- **Unit tests** for `sameExportInput`: a different watermark value → false; the same → true; quality ignored for PNG.
- **Manual testing**: readability on white, black and busy photos, and Story safe areas on real phones ([quickstart.md](./quickstart.md)).
