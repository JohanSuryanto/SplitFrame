// Full-resolution export and download, entirely on the device (FR-031 to FR-035).
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

async function renderToBlob(doc: Doc, type: string, quality?: number): Promise<Blob> {
  const { width, height } = doc.canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ExportError('failed');
    renderCollage(ctx, doc, { w: width, h: height });
    return canvas.convertToBlob({ type, quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError('failed');
  renderCollage(ctx, doc, { w: width, h: height });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ExportError('failed'))), type, quality),
  );
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Renders the collage at exactly canvas.width × canvas.height and downloads it. Nothing is downloaded on failure. */
export async function exportCollage(doc: Doc, settings: ExportSettings): Promise<void> {
  const { width, height } = doc.canvas;
  if (isWebKitOnly() && width * height > WEBKIT_MAX_AREA) throw new ExportError('too-large');

  const type = settings.format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = settings.format === 'jpg' ? settings.quality / 100 : undefined;
  let blob: Blob;
  try {
    blob = await renderToBlob(doc, type, quality);
  } catch (e) {
    throw e instanceof ExportError ? e : new ExportError('failed');
  }
  if (!blob || blob.size === 0) throw new ExportError('failed');
  download(blob, exportFilename(new Date(), settings.format));
}
