// Full-resolution export and download, entirely on the device (FR-031 to FR-035, FR-102).
import type { Doc, Signature } from '../model/types';
import { getAsset } from '../state/imageStore';
import type { ExportSettings } from '../state/uiState';
import { exportFilename } from './filename';
import { drawSignature, renderCollage } from './renderCollage';

/** iOS Safari refuses canvases larger than this many pixels (research R13). */
const WEBKIT_MAX_AREA = 16_777_216;

export class ExportError extends Error {
  constructor(readonly reason: 'too-large' | 'failed') {
    super(reason === 'too-large' ? 'Canvas too large for this device' : 'Export failed');
    this.name = 'ExportError';
  }
}

function isWebKitOnly(): boolean {
  const ua = navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
}

async function renderToBlob(doc: Doc, type: string, quality: number | undefined, watermark: boolean): Promise<Blob> {
  const { width, height } = doc.canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ExportError('failed');
    renderCollage(ctx, doc, { w: width, h: height }, { watermark });
    return canvas.convertToBlob({ type, quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError('failed');
  renderCollage(ctx, doc, { w: width, h: height }, { watermark });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ExportError('failed'))), type, quality),
  );
}

/** Saves an already-rendered file to the device (also the fallback when sharing fails). */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders the collage at exactly canvas.width × canvas.height as a named file, the same bytes for
 * Download and Share (FR-102, FR-104). Throws ExportError on failure.
 */
export async function renderExportFile(doc: Doc, settings: ExportSettings): Promise<File> {
  const { width, height } = doc.canvas;
  if (isWebKitOnly() && width * height > WEBKIT_MAX_AREA) throw new ExportError('too-large');

  const type = settings.format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = settings.format === 'jpg' ? settings.quality / 100 : undefined;
  let blob: Blob;
  try {
    blob = await renderToBlob(doc, type, quality, settings.watermark);
  } catch (e) {
    throw e instanceof ExportError ? e : new ExportError('failed');
  }
  if (!blob || blob.size === 0) throw new ExportError('failed');
  return new File([blob], exportFilename(new Date(), settings.format), { type });
}

/** Whether two export requests produce the same file, so a rendered file can be reused (research W7). */
export function sameExportInput(
  a: { doc: Doc; settings: ExportSettings },
  b: { doc: Doc; settings: ExportSettings },
): boolean {
  return (
    a.doc === b.doc &&
    a.settings.format === b.settings.format &&
    a.settings.watermark === b.settings.watermark &&
    (a.settings.format === 'png' || a.settings.quality === b.settings.quality)
  );
}

/** Renders the collage and downloads it. Nothing is downloaded on failure. */
export async function exportCollage(doc: Doc, settings: ExportSettings): Promise<void> {
  downloadFile(await renderExportFile(doc, settings));
}

/** Width of a downloaded drawn signature; drawn strokes are vectors, so any size is sharp. */
const SIGNATURE_PX = 1600;

/**
 * The signature alone as a transparent PNG, upright and at full strength, in its ink color (or original
 * colors), for use as a digital signature elsewhere. Uploaded signatures keep their stored resolution.
 */
export async function downloadSignature(sig: Signature): Promise<void> {
  const pic = sig.picture;
  const w = pic.kind === 'image' ? (getAsset(pic.assetId)?.width ?? SIGNATURE_PX) : SIGNATURE_PX;
  const h = Math.max(1, Math.round(w / pic.aspect));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new ExportError('failed');
  // Fill the whole canvas: the signature's width is `size` × the short side.
  drawSignature(ctx, { ...sig, x: 0.5, y: 0.5, rotation: 0, opacity: 1, size: w / Math.min(w, h) }, { width: w, height: h }, { w, h });
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
  if (!blob || blob.size === 0) throw new ExportError('failed');
  downloadFile(new File([blob], exportFilename(new Date(), 'png', 'signature'), { type: 'image/png' }));
}
