# Data Model: Signature

This adds to [001 data-model.md](../001-splitframe-collage-editor/data-model.md) and [005 data-model.md](../005-custom-watermark/data-model.md). Only the changes are listed.

## 1. `Signature` (new, on `Doc`)

```ts
type SignaturePicture =
  | { kind: 'strokes'; strokes: Pt[][]; aspect: number; lineWidth: number }
  //   strokes: points 0–1 in the signature box; ≥ 1 stroke, ≥ 1 point each
  //   aspect: box width ÷ height, > 0
  //   lineWidth: pen width ÷ box width, > 0
  | { kind: 'image'; assetId: string; aspect: number };
  //   assetId: must exist in imageStore; cleaned PNG with transparent paper

interface Signature {
  picture: SignaturePicture;
  keepColors: boolean; // image only: draw original colors instead of ink color
  color: string;       // ink, '#RRGGBB', uppercase
  opacity: number;     // 0.1–1
  size: number;        // signature WIDTH ÷ canvas short side, 0.1–0.8
  rotation: number;    // degrees, −90–90; |r| ≤ 3 snaps to 0
  x: number;           // center ÷ canvas width, 0–1
  y: number;           // center ÷ canvas height, 0–1
}

interface Doc { canvas; layout; style; watermark; signature: Signature | null }

const DEFAULT_SIGNATURE_PLACEMENT = {
  keepColors: false, color: '#111111', opacity: 1, size: 0.35, rotation: 0, x: 0.75, y: 0.85,
};
const SIGNATURE_RANGES = { opacity: [0.1, 1], size: [0.1, 0.8], rotation: [-90, 90] } as const;
```

**Lifecycle**:

- `initialDoc()` has `signature: null`.
- `newCollage` keeps it, like the watermark (spec assumption).
- It's never saved.
- Image assets stay in memory while any undo, present or redo state refers to them (§4).

## 2. Actions

```ts
| { type: 'setSignaturePicture'; picture: SignaturePicture; keepColors?: boolean }
| { type: 'setSignature'; patch: Partial<Omit<Signature, 'picture'>> }
| { type: 'removeSignature' }
```

| Action | Rule |
|--------|------|
| `setSignaturePicture` with no signature | new `{ picture, ...DEFAULT_SIGNATURE_PLACEMENT, keepColors: keepColors ?? false }` |
| `setSignaturePicture` with a signature | replace `picture` (and `keepColors` if given); placement, color and opacity kept |
| `setSignature` with no signature | returns the same `doc` |
| `setSignature` | clamp as in `SIGNATURE_RANGES`; rotation snap ±3; x, y 0–1; color must match `#RRGGBB` and is uppercased; same `doc` if nothing changes |
| `removeSignature` | `signature: null`; same `doc` if already null |

Clamping helper shared with `setWatermark`: `clampPlacement(cur, patch, ranges)` handles opacity, size, rotation (with snap), x, y and color.

## 3. Pure plans (not stored)

```ts
normalizeStrokes(strokes: Pt[][], penPx: number): Extract<SignaturePicture, { kind: 'strokes' }>
//   bbox of all points, padded by penPx/2 + 4% of max(bboxW, bboxH); a lone point gets a penPx box
//   points → 0–1 in the padded box; aspect = boxW / boxH; lineWidth = penPx / boxW

planSignature(sig: Signature, canvas: {width; height}, sizePx: Size)
  → { cx, cy, w, h, angle }
//   w = size · min(W, H) · sizePx.w / W;  h = w / picture.aspect
//   cx = x · sizePx.w;  cy = y · sizePx.h;  angle = rotation · π / 180

removeBackground(img: { data: Uint8ClampedArray; width; height }, sensitivity: number /* 0–100 */)
  → { data: Uint8ClampedArray; box: { x; y; w; h } | null }
//   cutoff = clamp(otsu(L), 60, 220) + (sensitivity − 50) · 1.2
//   alpha' = alpha · clamp((cutoff − L) / 24 + 0.5, 0, 1); RGB unchanged
//   box = bbox of alpha' ≥ 0.5 · 255, plus 3% of its larger side, clipped to the image;
//         null if fewer than 0.05% of pixels qualify
```

## 4. Store and history

- `imageStore.addAssetFromCanvas(canvas): Promise<ImageAsset>`: encodes PNG (keeps alpha), decodes to an `ImageBitmap`, registers it. It's used only for cleaned signatures.
- `historyAssets(h)` also adds `d.signature.picture.assetId` for every doc whose picture is an image.

## 5. UI state (not undoable)

- `App`: `markTab: 'text' | 'signature'`, default `'text'`, kept while the session lasts.
- Pad dialog: `strokes: Pt[][]` in pad-width units. Upload dialog: `sourceAssetId`, `sensitivity` (default 50), `keepColors` (default false).
