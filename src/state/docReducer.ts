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
  STYLE_RANGES,
  type CanvasPreset,
  type CellImage,
  type Direction,
  type Doc,
  type LayoutNode,
  type Pt,
  type Style,
} from '../model/types';

export type DocAction =
  | { type: 'setImage'; cellId: string; assetId: string }
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
  | { type: 'clearLayout' }
  | { type: 'newCollage' };

export function initialDoc(): Doc {
  return {
    canvas: { preset: '9:16', width: 1080, height: 1920 },
    layout: singleCell(),
    style: DEFAULT_STYLE,
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

export function docReducer(doc: Doc, action: DocAction): Doc {
  switch (action.type) {
    case 'setImage':
      return { ...doc, layout: setCellImage(doc.layout, action.cellId, defaultFraming(action.assetId)) };
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
    case 'newCollage':
      // Start again: one empty cell; the canvas shape and style are kept for the next collage.
      return hasWork(doc) ? { ...doc, layout: singleCell() } : doc;
    case 'clearLayout':
      return doc.layout.type === 'cell' ? doc : { ...doc, layout: clear(doc.layout) };
  }
}
