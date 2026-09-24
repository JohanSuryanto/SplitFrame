# Data Model: Share to Story

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

This feature adds no persistent data and nothing to the document or undo history. Everything below is short-lived UI state.

## ShareFile

The rendered collage, ready to hand to the share sheet (spec entity "Shared image").

| Field | Type | Notes |
|---|---|---|
| `file` | `File` | Bytes from `renderExportFile`, identical to Download (FR-102). Named `splitframe-YYYYMMDD-HHmm.{png,jpg}` (FR-104), with MIME `image/png` or `image/jpeg`. |
| `key` | `{ doc: Doc; format: 'png' \| 'jpg'; quality: number }` | Identifies which collage and settings the file was made from. It matches when `doc` is reference-equal (Doc is immutable) and the format matches; quality only counts when the format is JPG. |

**Lifetime**: one per open Preview (the pre-render, S4), or one held by the "Your image is ready" toast. It is dropped when Preview closes, the toast is dismissed or times out, or the key stops matching. It is never written to storage or the image store (FR-103).

## ShareOutcome

The result of one `shareFile` call (research S5).

```
'shared' | 'cancelled' | 'needs-gesture' | 'failed'
```

| Outcome | Next UI state |
|---|---|
| `shared` | idle |
| `cancelled` | idle, no message (FR-106) |
| `needs-gesture` | idle, plus toast "Your image is ready" [Share] holding the ShareFile (FR-116) |
| `failed` | idle, plus toast "Couldn't open sharing." [Download] (FR-115) |

## Share button state

Kept inside the component, per placement (Preview bar, Export panel).

```
hidden ── (canShareImages(format) true) ──▶ idle
idle ── tap ──▶ preparing ── render ok ──▶ sharing ── outcome ──▶ idle
                   │                                   
                   └── ExportError ──▶ idle + "Export failed — try a smaller canvas size." (FR-114)
```

- **hidden**: the browser can't share files of the current format (FR-112). Download works unchanged.
- **preparing / sharing**: the button is `disabled` and `aria-busy`, and further taps are ignored (FR-113). The label reads "Preparing…".
- In Preview with a matching pre-rendered ShareFile, `preparing` is skipped.

## Derived values

| Name | Rule | Used by |
|---|---|---|
| `isStoryShape(canvas)` | `canvas.width * 16 === canvas.height * 9` | 9:16 hint (FR-111) |
| `canShareImages(format)` | `navigator.canShare?.({ files: [emptyFile(mime)] }) === true` | Show or hide Share (FR-112) |
