// Core document types. See specs/001-splitframe-collage-editor/data-model.md.

export type CanvasPreset = '9:16' | '1:1' | '4:5' | '16:9' | 'custom';

export interface CanvasSpec {
  preset: CanvasPreset;
  /** Export width in px. Presets: 1080/1080/1080/1920. Custom: 100–8000. */
  width: number;
  /** Export height in px. Presets: 1920/1080/1350/1080. Custom: 100–8000. */
  height: number;
}

/** Direction of the DIVIDER line: 'horizontal' → a = top, b = bottom; 'vertical' → a = left, b = right. */
export type Direction = 'horizontal' | 'vertical';

export interface CellImage {
  /** Must exist in the image store. */
  assetId: string;
  /** > 0: 1 means the photo just covers the cell; below 1 zooms out toward fit (feature 004). Upper limit ZOOM_MAX. */
  zoom: number;
  /** 0–1: the image point shown at the cell's center, clamped when the frame is derived. */
  focusX: number;
  /** 0–1: same as focusX, on the other axis. */
  focusY: number;
}

export interface CellNode {
  type: 'cell';
  id: string;
  image?: CellImage;
}

export interface SplitNode {
  type: 'split';
  id: string;
  direction: Direction;
  /** 0 < ratio < 1, relative to the parent region. */
  ratio: number;
  a: LayoutNode;
  b: LayoutNode;
}

export interface Pt {
  x: number;
  y: number;
}

/** Freehand split (research R19). Only the path is stored; shapes are derived from the tree. */
export interface PathSplitNode {
  type: 'path';
  id: string;
  /** ≥ 2 points, normalized to the PARENT region's bounding box; first and last lie on its boundary. */
  path: Pt[];
  /** Whether `a` is the first piece returned by splitPolygonByChord (keeps the assignment stable). */
  aFirst: boolean;
  /** The larger piece at creation time; keeps the photo (FR-046). */
  a: LayoutNode;
  /** The smaller piece. */
  b: LayoutNode;
}

export type LayoutNode = CellNode | SplitNode | PathSplitNode;

/** A leaf cell's shape in content-area coordinates (0–1). */
export interface Region {
  polygon: Pt[];
  bbox: NRect;
  /** True when every ancestor is a straight split, so the polygon is exactly the bbox. */
  rect: boolean;
}

export interface Style {
  /** Reference px (canvas short side = 1080), 0–40. */
  gap: number;
  /** CSS hex #RRGGBB. */
  color: string;
  /** Reference px, 0–100. */
  radius: number;
  /** Reference px, 0–100. */
  padding: number;
}

/** The user's own text watermark (feature 005). Fractions are of the export canvas. */
export interface Watermark {
  /** '' = no watermark; ≤ 100 chars. */
  text: string;
  /** '#RRGGBB', uppercase. */
  color: string;
  /** 0.1–1. */
  opacity: number;
  /** Text height ÷ canvas short side, 0.02–0.2. */
  size: number;
  /** Degrees, −90–90; |r| ≤ 3 snaps to 0. */
  rotation: number;
  /** Text center ÷ canvas width, 0–1 (Repeat: pattern offset). */
  x: number;
  /** Text center ÷ canvas height, 0–1. */
  y: number;
  /** Tile the text across the whole canvas. */
  repeat: boolean;
}

export interface Doc {
  canvas: CanvasSpec;
  layout: LayoutNode;
  style: Style;
  watermark: Watermark;
}

/** Normalized rectangle, 0–1 in content-area units. */
export interface NRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A cell in pixel space, after padding, gap and radius are applied. x/y/w/h is the bounding box. */
export interface PxCell {
  cellId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  /** Shaped cells only: the outline in px (absolute), corners rounded by r. */
  polygon?: Pt[];
}

export interface Divider {
  splitId: string;
  direction: Direction;
  /** Global normalized position of the line on its split axis. */
  coord: number;
  /** Global normalized extent of the line along the other axis. */
  span: [number, number];
}

/** Normalized minimum cell size per axis, from minSizeNorm(). */
export interface MinSize {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export const DEFAULT_STYLE: Style = { gap: 8, color: '#FFFFFF', radius: 0, padding: 0 };
export const DEFAULT_WATERMARK: Watermark = {
  text: '',
  color: '#FFFFFF',
  opacity: 0.5,
  size: 0.06,
  rotation: 0,
  x: 0.5,
  y: 0.5,
  repeat: false,
};
export const WATERMARK_RANGES = { opacity: [0.1, 1], size: [0.02, 0.2], rotation: [-90, 90] } as const;
export const WATERMARK_MAX_CHARS = 100;
export const ROTATION_SNAP = 3;
export const REPEAT_ROTATION = -30;
export const ZOOM_MAX = 8;
export const REF_SHORT_SIDE = 1080;
export const STYLE_RANGES = { gap: [0, 40], radius: [0, 100], padding: [0, 100] } as const;
export const CUSTOM_SIZE_RANGE = [100, 8000] as const;

let idCounter = 0;
export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  idCounter += 1;
  return `id-${Date.now().toString(36)}-${idCounter}`;
}
