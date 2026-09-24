# Contract: Share module and UI

**Feature**: [../spec.md](../spec.md) · **Data model**: [../data-model.md](../data-model.md)

## Module `src/render/exportCanvas.ts` (changed)

```ts
/** Renders at exactly canvas.width × canvas.height. Throws ExportError('too-large' | 'failed'). */
export function renderExportFile(doc: Doc, settings: ExportSettings): Promise<File>;

/** Unchanged behaviour: renderExportFile, then download. Nothing is downloaded on failure. */
export function exportCollage(doc: Doc, settings: ExportSettings): Promise<void>;

/** Downloads an already-rendered file (used by the "Couldn't open sharing" fallback). */
export function downloadFile(file: File): void;
```

Guarantees:
- `renderExportFile(...).name === exportFilename(now, settings.format)`.
- `.type` is `image/png` or `image/jpeg`.
- `.size > 0`.
- The bytes are the same ones `exportCollage` would download.

## Module `src/render/share.ts` (new)

```ts
export type ShareOutcome = 'shared' | 'cancelled' | 'needs-gesture' | 'failed';

/** True only if this browser can share an image file of this format (research S3). Never throws. */
export function canShareImages(format: ExportFormat): boolean;

/** Opens the system share sheet with only this file (no title/text/url, research S8). Never throws. */
export function shareFile(file: File): Promise<ShareOutcome>;

/** width:height is exactly 9:16. */
export function isStoryShape(canvas: { width: number; height: number }): boolean;
```

`shareFile` mapping (must be unit-tested, one case per row):

| Condition | Returns |
|---|---|
| `navigator.canShare` missing, or `canShare({files:[file]})` false | `'failed'` |
| `share()` resolves | `'shared'` |
| rejects `DOMException` name `AbortError` | `'cancelled'` |
| rejects `DOMException` name `NotAllowedError` | `'needs-gesture'` |
| rejects with anything else | `'failed'` |

## Hook `src/state/useShare.ts` (new)

The logic shared by the Preview bar and the Export panel.

```ts
function useShare(opts: {
  doc: Doc;
  settings: ExportSettings;
  pushToast: (message: string, action?: { label: string; run: () => void }) => void;
  prerender?: boolean;              // true in Preview (research S4)
}): {
  supported: boolean;               // canShareImages(settings.format)
  busy: boolean;                    // preparing or sharing (FR-113)
  share: () => void;                // no-op while busy
};
```

Behavior:
- If `share` is called while `busy`, it does nothing.
- If the cached file's key matches, it calls `shareFile` right away. Otherwise it renders with `renderExportFile` first.
- If rendering throws `ExportError`, the hook shows the toast `Export failed — try a smaller canvas size.` and does not open the share sheet (FR-114).
- `needs-gesture` → toast `Your image is ready` with action `{ label: 'Share', run: () => shareFile(file) }`. That second `shareFile` call maps its outcome the same way, except that a second `needs-gesture` is reported as `failed`.
- `failed` → toast `Couldn't open sharing.` with action `{ label: 'Download', run: () => downloadFile(file) }` when a file exists. If there is no file, the toast has no action. Nothing downloads unless the user taps the action (FR-115).
- `cancelled` / `shared` → no toast.

## UI contract

| Place | When `supported` | When not supported |
|---|---|---|
| Preview bar | `Close · Share · Export`. Below 767 px, Share is primary and Export secondary. | `Close · Export` (unchanged) |
| Export panel | Share button plus Download button. Below 767 px, Share comes first with primary style. At 767 px and above, Download stays primary. | Download only (unchanged) |
| Export panel, not 9:16 | meta line: "Stories are 9:16 — other shapes get borders." | not shown |

- Share button accessible name: **"Share to Story or other apps"**. The visible label is "Share", or "Preparing…" while busy. It uses `aria-busy` while busy (FR-117).
- There's a `ShareIcon` in `icons.tsx` in the same style as `DownloadIcon`.
- The panel meta line changes from "saved to your device only" to "stays on your device until you share it". It is still true, and it no longer contradicts sharing.
