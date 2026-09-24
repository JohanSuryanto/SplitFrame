# Research: Share to Story

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-24

Numbered S1–S10 so they don't collide with the base feature's R1–R25 ([../001-splitframe-collage-editor/research.md](../001-splitframe-collage-editor/research.md)).

---

## S1. How a browser app gets an image into an Instagram Story or WhatsApp Status

**Decision**: Use the Web Share API with files (`navigator.share({ files: [file] })`). It opens the operating system's share sheet with the collage attached. The user picks Instagram or WhatsApp there, and that app's own screen offers Story or Status.

**Rationale**:
- It is the only way a web page can pass an image into another installed app without saving it first (FR-101, FR-103).
- The share sheet is where Story targets appear. On Android, Instagram registers a separate "Stories" target. On iOS, the Instagram share extension offers Story. In WhatsApp, "My status" is listed at the top of the recipient list.
- The file goes from the browser to the other app on the device. SplitFrame makes no network request, so FR-001 and FR-105 hold.

**Alternatives considered**:
- *Instagram's `instagram-stories://share` URL scheme*: it only works from native apps that pass the image through the pasteboard and a Facebook App ID. Pages can't do that. Rejected.
- *`whatsapp://send` / `wa.me` links*: these carry text only, not images. Rejected.
- *Download, then tell the user to open the app*: that is the current flow the feature replaces.
- *Wrap the app as a PWA or native shell*: far too large a change for this feature, and it would not beat the share sheet for this use.

## S2. Where it works (support matrix)

**Decision**: Feature-detect at runtime (S3) and never sniff the browser. Expected results:

| Environment | File share | Result |
|---|---|---|
| iOS / iPadOS Safari 15+ (our minimum is 16.4) | ✅ | Share shown |
| Android Chrome / Samsung Internet (current) | ✅ | Share shown |
| Chrome / Edge on Windows 10+ and ChromeOS | ✅ | Share shown (Windows share panel) |
| macOS Safari | ✅ | Share shown (macOS share menu) |
| Firefox desktop, Chrome on Linux/macOS | ❌ | Share hidden; Download only |
| Firefox Android | ⚠️ varies | Whatever detection reports |

**Rationale**: The spec assumed "desktop mostly falls back". In practice some desktop browsers support sharing files too. Detection lets them offer it with no extra code. Prominence (FR-109) is still tuned for phones (S7).

## S3. Detecting support without false positives (FR-112, SC-105)

**Decision**: `canShareImages(format)` returns true only when `navigator.canShare` exists **and** `navigator.canShare({ files: [probe] })` is true, where `probe` is an empty `File` with the MIME type of the current format (`image/png` or `image/jpeg`). The check runs again when the format changes. Right before sharing, the real file is checked with `canShare` too, and a `false` there counts as a failure (S5).

**Rationale**: `navigator.share` alone exists on browsers that share only text or URLs, and the button would do nothing there. `canShare` with files is the documented way to check file support, and it is synchronous and cheap.

**Alternatives considered**: checking only `'share' in navigator` gives false positives on desktop Chrome for Linux and older Android WebViews.

## S4. User activation: rendering takes time, and share must come from a tap (FR-113, FR-116)

`navigator.share` needs *transient user activation*. Chrome allows about 5 s after the tap. Safari is stricter and may reject a share that follows a long `await` with `NotAllowedError`. A full-size render of a 1080×1920 collage with 6 photos can take 1–3 s on a phone.

**Decision**: use two layers.

1. **Pre-render when possible.** While Preview is open, the document can't change because the dialog is modal. So Preview starts rendering the share file as soon as it opens and caches it, keyed by `(doc, format, quality)`. `Doc` is immutable, so a reference check is enough. Share in Preview usually has the file ready and calls `navigator.share` right away inside the tap. The Export panel renders when Share is tapped, because the doc may still change while it is open.
2. **Tap-again fallback.** If `share()` rejects with `NotAllowedError` after a render, keep the rendered `File` and show a toast: "Your image is ready" with a **Share** action. That tap is a fresh activation, and the action shares the kept file (FR-116). The kept file is dropped when the toast is dismissed or the doc or settings change.

**Rationale**: the fast path covers the common case, and the fallback means Safari never fails silently. Nothing is downloaded or saved, so FR-103 holds either way.

**Alternatives considered**:
- *Always pre-render in the background after each edit*: this wastes battery and memory on phones for a feature that isn't used every session. Rejected.
- *Render a smaller image to beat the timeout*: this breaks FR-102 (the share must be identical to Download). Rejected.

## S5. Mapping share results to UI (FR-106, FR-114, FR-115)

**Decision**: `shareFile(file)` resolves to one of these outcomes and never throws:

| Cause | Outcome | UI |
|---|---|---|
| `share()` resolves | `shared` | nothing (the user is in the other app) |
| `AbortError` (user closed the sheet) | `cancelled` | nothing, no toast (FR-106) |
| `NotAllowedError` | `needs-gesture` | "Your image is ready" toast with a **Share** action (S4) |
| `canShare(file)` false, `TypeError`, `DataError`, anything else | `failed` | "Couldn't open sharing." toast with a **Download** action (FR-115) |

Render failures (`ExportError`) happen before `shareFile` runs. They show the existing "Export failed — try a smaller canvas size." toast, and the share sheet never opens (FR-114).

**Rationale**: a pure mapping from error to outcome is easy to unit-test with a stubbed `navigator`, and it keeps the components simple.

## S6. Sharing exactly the Download file (FR-102, FR-104, SC-103)

**Decision**: split `exportCanvas.ts` into:
- `renderExportFile(doc, settings): Promise<File>`, which holds the existing size guard, `renderToBlob`, the empty-blob check and `exportFilename`. It returns a `File` with the right name and MIME type.
- `exportCollage(doc, settings)`, which becomes `renderExportFile` followed by the existing `download`. Its behavior doesn't change.

Share uses `renderExportFile` too, so both paths produce the same bytes by construction.

**Rationale**: one render path for both. Wrapping the blob in a `File` also gives the share sheet the `splitframe-YYYYMMDD-HHmm.ext` name (FR-104).

## S7. Placement and prominence (FR-108, FR-109, FR-111)

**Decision**:
- **Preview bar**: `Close · Share · Export`, where Share appears only if supported. Export stays the primary button on wide screens. Below 767 px, the same phone breakpoint as `Panel.module.css`, Share becomes primary and Export secondary.
- **Export panel**: Share and Download are stacked. On phone widths with Share supported, Share gets the `primary` style and comes first, and Download becomes secondary. On wide screens, Download stays primary.
- **9:16 hint**: when `width * 16 !== height * 9`, show a one-line meta note under Share: "Stories are 9:16 — other shapes get borders." It is informational only and never blocks sharing.

**Rationale**: the breakpoint matches existing CSS, so layout and prominence agree. CSS decides which button is primary, so there's no JS resize logic.

## S8. What to pass besides the file

**Decision**: pass **only** `files`, with no `title`, `text` or `url`.

**Rationale**: on Android some targets, WhatsApp included, prefer the text part and may drop the image or open a chat with only the caption. Instagram's Stories target ignores text anyway. A bare image gives the most consistent Story or Status editor.

## S9. Memory and cleanup

**Decision**: the cached share `File` lives in a component-local ref (Preview) or in the fallback toast's closure (S4). It is released when Preview closes, the toast goes away, or the key changes. There's no object URL to revoke because `navigator.share` takes the `File` directly.

**Rationale**: one full-size PNG is 3–8 MB, which is fine for one short-lived copy. It never goes into the history or the image store.

## S10. Testing approach

**Decision**:
- **Unit tests (Vitest, node)**: `canShareImages` and `shareFile` with a stubbed `navigator` cover every row in S5, plus the probe MIME per format. `isStoryShape` covers 1080×1920, 720×1280, 1080×1080 and 1920×1080.
- **The export refactor** has no new tests; `filename.test.ts` still covers naming. Render parity with Download comes from sharing one function.
- **Manual testing** on a real iPhone and Android phone with Instagram and WhatsApp installed, following [quickstart.md](./quickstart.md). The share sheet can't be automated from a test runner.
