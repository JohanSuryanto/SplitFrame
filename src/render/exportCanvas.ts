// Full-resolution export and download, entirely on the device (FR-031 to FR-035, FR-102).
import type { Doc } from '../model/types';
import type { ExportSettings } from '../state/uiState';
import { exportFilename } from './filename';
import { renderCollage } from './renderCollage';

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
