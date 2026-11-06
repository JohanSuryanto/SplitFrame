// Document actions. Every change to the document goes through here and through useHistory.
import { minAreaNorm, minSizeNorm, styleLimits } from '../model/geometry';
import {
  clear,
  defaultFraming,
  removeDivider,
  resizeDivider,
  setCellImage,
  setFraming,
  singleCell,
  splitAt,
  splitByPath,
  swapCellImages,
  type MakeId,
  type RemoveResult,
} from '../model/layout';
import { applyPreset, CANVAS_PRESETS, type LayoutPresetKind } from '../model/presets';
import {
  CUSTOM_SIZE_RANGE,
  DEFAULT_STYLE,
  DEFAULT_WATERMARK,
  DEFAULT_SIGNATURE_PLACEMENT,
  REPEAT_ROTATION,
  ROTATION_SNAP,
  SIGNATURE_RANGES,
  WATERMARK_MAX_CHARS,
  WATERMARK_RANGES,
  STYLE_RANGES,
  type CanvasPreset,
  type CellImage,
  type Direction,
  type Doc,
  type LayoutNode,
  type Pt,
  type Signature,
  type SignaturePicture,
  type Style,
  type Watermark,
} from '../model/types';

export type DocAction =
  /** framing: chosen in the Adjust popup (feature 004); the default fill when left out. */
  | { type: 'setImage'; cellId: string; assetId: string; framing?: Pick<CellImage, 'zoom' | 'focusX' | 'focusY'> }
  /** Several photos in one undo step (used to fill cells with samples). */
  | { type: 'setImages'; entries: { cellId: string; assetId: string }[] }
  | { type: 'setFraming'; cellId: string; patch: Partial<Pick<CellImage, 'zoom' | 'focusX' | 'focusY'>> }
  | { type: 'resetFraming'; cellId: string }
  | { type: 'removeImage'; cellId: string }
  | { type: 'swapImages'; a: string; b: string }
  | { type: 'setLayout'; layout: LayoutNode }
  | { type: 'setCanvasPreset'; preset: Exclude<CanvasPreset, 'custom'> }
  | { type: 'setCustomSize'; width: number; height: number }
  | { type: 'applyPreset'; kind: LayoutPresetKind }
  | { type: 'splitAt'; axis: Direction; coord: number; span: [number, number]; makeId?: MakeId }
  | { type: 'splitByPath'; path: Pt[]; makeId?: MakeId }
  | { type: 'resizeDivider'; splitId: string; coord: number }
  | { type: 'removeDivider'; splitId: string }
  | { type: 'setStyle'; patch: Partial<Style> }
  /** The user's own watermark (feature 005); every field is clamped here. */
  | { type: 'setWatermark'; patch: Partial<Watermark> }
  /** The signature (feature 006): create it with the default placement, or swap its picture and keep the rest. */
  | { type: 'setSignaturePicture'; picture: SignaturePicture; keepColors?: boolean }
  | { type: 'setSignature'; patch: Partial<Omit<Signature, 'picture'>> }
  | { type: 'removeSignature' }
  | { type: 'clearLayout' }
  | { type: 'newCollage' };

export function initialDoc(): Doc {
  return {
    canvas: { preset: '9:16', width: 1080, height: 1920 },
    layout: singleCell(),
    style: DEFAULT_STYLE,
    watermark: DEFAULT_WATERMARK,
    signature: null,
  };
}

/** Custom: 100–8000, whole numbers only. */
export function isValidCustomSize(width: number, height: number): boolean {
  const [lo, hi] = CUSTOM_SIZE_RANGE;
  const ok = (v: number) => Number.isInteger(v) && v >= lo && v <= hi;
  return ok(width) && ok(height);
}

/** What removing a divider would do, so the caller can report it in a toast. */
export function removeDividerWithReport(doc: Doc, splitId: string): RemoveResult {
  return removeDivider(doc.layout, splitId);
}

/** True when there is something to lose: any photo or any line. */
export function hasWork(doc: Doc): boolean {
  return doc.layout.type !== 'cell' || doc.layout.image !== undefined;
}

interface Placement {
  color: string;
  opacity: number;
  size: number;
  rotation: number;
  x: number;
  y: number;
}

type Range = readonly [number, number];
const clamp = (v: number, [lo, hi]: Range) => Math.min(Math.max(v, lo), hi);

/** Color, opacity, size, rotation (with the ±3° snap) and position, shared by the watermark and signature. */
function clampPlacement<T extends Placement>(cur: T, p: Partial<T>, ranges: { opacity: Range; size: Range; rotation: Range }): T {
  const next: T = { ...cur };
  if (p.color !== undefined && /^#[0-9A-Fa-f]{6}$/.test(p.color)) next.color = p.color.toUpperCase();
  if (p.opacity !== undefined) next.opacity = clamp(p.opacity, ranges.opacity);
  if (p.size !== undefined) next.size = clamp(p.size, ranges.size);
  if (p.rotation !== undefined) {
    const r = clamp(p.rotation, ranges.rotation);
    next.rotation = Math.abs(r) <= ROTATION_SNAP ? 0 : r;
  }
  if (p.x !== undefined) next.x = clamp(p.x, [0, 1]);
  if (p.y !== undefined) next.y = clamp(p.y, [0, 1]);
  return next;
}

const sameFields = <T extends object>(a: T, b: T) => (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k]);

export function docReducer(doc: Doc, action: DocAction): Doc {
  switch (action.type) {
    case 'setImage':
      return { ...doc, layout: setCellImage(doc.layout, action.cellId, { ...defaultFraming(action.assetId), ...action.framing }) };
    case 'setImages': {
      if (action.entries.length === 0) return doc;
      let layout = doc.layout;
      for (const e of action.entries) layout = setCellImage(layout, e.cellId, defaultFraming(e.assetId));
      return { ...doc, layout };
    }
    case 'setFraming':
      return { ...doc, layout: setFraming(doc.layout, action.cellId, action.patch) };
    case 'resetFraming':
      return { ...doc, layout: setFraming(doc.layout, action.cellId, { zoom: 1, focusX: 0.5, focusY: 0.5 }) };
    case 'removeImage':
      return { ...doc, layout: setCellImage(doc.layout, action.cellId, undefined) };
    case 'swapImages':
      return { ...doc, layout: swapCellImages(doc.layout, action.a, action.b) };
    case 'setLayout':
      return { ...doc, layout: action.layout };
    case 'setCanvasPreset': {
      const [width, height] = CANVAS_PRESETS[action.preset];
      const c = doc.canvas;
      if (c.preset === action.preset && c.width === width && c.height === height) return doc;
      return { ...doc, canvas: { preset: action.preset, width, height } };
    }
    case 'setCustomSize': {
      if (!isValidCustomSize(action.width, action.height)) return doc;
      const c = doc.canvas;
      if (c.preset === 'custom' && c.width === action.width && c.height === action.height) return doc;
      return { ...doc, canvas: { preset: 'custom', width: action.width, height: action.height } };
    }
    case 'applyPreset':
      return { ...doc, layout: applyPreset(doc.layout, action.kind).tree };
    case 'splitAt': {
      const min = minSizeNorm(doc.canvas, doc.style);
      const res = splitAt(doc.layout, action.axis, action.coord, action.span, min, action.makeId);
      return 'tree' in res ? { ...doc, layout: res.tree } : doc;
    }
    case 'splitByPath': {
      const res = splitByPath(doc.layout, action.path, minAreaNorm(doc.canvas, doc.style), action.makeId);
      return 'tree' in res ? { ...doc, layout: res.tree } : doc;
    }
    case 'resizeDivider': {
      const layout = resizeDivider(
        doc.layout,
        action.splitId,
        action.coord,
        minSizeNorm(doc.canvas, doc.style),
        minAreaNorm(doc.canvas, doc.style),
      );
      return layout === doc.layout ? doc : { ...doc, layout };
    }
    case 'removeDivider': {
      const res = removeDivider(doc.layout, action.splitId);
      return res.tree === doc.layout ? doc : { ...doc, layout: res.tree };
    }
    case 'setStyle': {
      const next = { ...doc.style };
      const { patch } = action;
      if (patch.color !== undefined && /^#[0-9A-Fa-f]{6}$/.test(patch.color)) next.color = patch.color.toUpperCase();
      const limits = styleLimits({ ...doc, style: { ...doc.style, ...patch, color: next.color } });
      const clampTo = (v: number, lo: number, hi: number) => Math.round(Math.min(Math.max(v, lo), hi));
      if (patch.gap !== undefined) next.gap = clampTo(patch.gap, STYLE_RANGES.gap[0], Math.min(STYLE_RANGES.gap[1], limits.maxGap));
      if (patch.radius !== undefined) next.radius = clampTo(patch.radius, ...STYLE_RANGES.radius);
      if (patch.padding !== undefined) {
        next.padding = clampTo(patch.padding, STYLE_RANGES.padding[0], Math.min(STYLE_RANGES.padding[1], limits.maxPadding));
      }
      const same = (Object.keys(next) as (keyof Style)[]).every((k) => next[k] === doc.style[k]);
      return same ? doc : { ...doc, style: next };
    }
    case 'setWatermark': {
      const cur = doc.watermark;
      const p = action.patch;
      const next = clampPlacement(cur, p, WATERMARK_RANGES);
      if (p.text !== undefined) next.text = p.text.slice(0, WATERMARK_MAX_CHARS);
      if (p.repeat !== undefined) {
        // Turning Repeat on with an upright mark tilts it, the usual look for an ID-copy stamp.
        if (p.repeat && !cur.repeat && next.rotation === 0) next.rotation = REPEAT_ROTATION;
        next.repeat = p.repeat;
      }
      return sameFields(next, cur) ? doc : { ...doc, watermark: next };
    }
    case 'setSignaturePicture': {
      const cur = doc.signature;
      const keepColors = action.keepColors ?? cur?.keepColors ?? false;
      if (cur && cur.picture === action.picture && cur.keepColors === keepColors) return doc;
      const base = cur ?? { ...DEFAULT_SIGNATURE_PLACEMENT, picture: action.picture };
      return { ...doc, signature: { ...base, picture: action.picture, keepColors } };
    }
    case 'setSignature': {
      const cur = doc.signature;
      if (!cur) return doc;
      const next = clampPlacement<Signature>(cur, action.patch, SIGNATURE_RANGES);
      if (action.patch.keepColors !== undefined) next.keepColors = action.patch.keepColors;
      return sameFields(next, cur) ? doc : { ...doc, signature: next };
    }
    case 'removeSignature':
      return doc.signature ? { ...doc, signature: null } : doc;
    case 'newCollage':
      // Start again: one empty cell; the canvas shape and style are kept for the next collage.
      return hasWork(doc) ? { ...doc, layout: singleCell() } : doc;
    case 'clearLayout':
      return doc.layout.type === 'cell' ? doc : { ...doc, layout: clear(doc.layout) };
  }
}
