// In-memory image store, outside React state and history.
// Photos are decoded, scaled down to what the export needs, and released once no undo step refers to them.
import { newId, type CanvasSpec } from '../model/types';

export interface ImageAsset {
  id: string;
  /** Object URL of the downscaled blob, for the editor <img>. */
  url: string;
  /** Decoded, orientation-corrected bitmap, for Preview and Export. */
  bitmap: ImageBitmap;
  /** Size after downscaling. */
  width: number;
  height: number;
  /** The long-side limit used, set only if the photo was actually scaled down. */
  downscaledTo?: number;
}

export class ImageLoadError extends Error {
  constructor(message = "That file couldn't be opened as an image.") {
    super(message);
    this.name = 'ImageLoadError';
  }
}

const assets = new Map<string, ImageAsset>();

export function maxSideFor(canvas: Pick<CanvasSpec, 'width' | 'height'>): number {
  return Math.max(canvas.width, canvas.height, 2048);
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageLoadError())), type, quality),
  );
}

const KEEPS_ALPHA = /^image\/(png|webp|gif)$/;

export async function loadImage(file: File, maxSide: number): Promise<ImageAsset> {
  if (!file.type.startsWith('image/')) throw new ImageLoadError();

  let decoded: ImageBitmap;
  try {
    decoded = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageLoadError();
  }

  try {
    const longSide = Math.max(decoded.width, decoded.height);
    const k = longSide > maxSide ? maxSide / longSide : 1;
    const w = Math.max(1, Math.round(decoded.width * k));
    const h = Math.max(1, Math.round(decoded.height * k));

    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new ImageLoadError();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded, 0, 0, w, h);

    const alpha = KEEPS_ALPHA.test(file.type);
    const blob = await toBlob(canvas, alpha ? 'image/png' : 'image/jpeg', alpha ? undefined : 0.92);
    const bitmap = await createImageBitmap(blob);
    const asset: ImageAsset = { id: newId(), url: URL.createObjectURL(blob), bitmap, width: w, height: h };
    if (k < 1) asset.downscaledTo = maxSide;
    assets.set(asset.id, asset);
    return asset;
  } catch (e) {
    throw e instanceof ImageLoadError ? e : new ImageLoadError();
  } finally {
    decoded.close();
  }
}

export function getAsset(id: string): ImageAsset | undefined {
  return assets.get(id);
}

/** Frees every asset that no undo, present or redo state refers to. */
export function releaseUnreferenced(referenced: Set<string>): void {
  for (const [id, asset] of assets) {
    if (referenced.has(id)) continue;
    URL.revokeObjectURL(asset.url);
    asset.bitmap.close();
    assets.delete(id);
  }
  if (import.meta.env.DEV) console.debug(`[imageStore] ${assets.size} photo(s) in memory`);
}

export function assetCount(): number {
  return assets.size;
}
