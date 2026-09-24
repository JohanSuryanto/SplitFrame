// Hands the rendered collage to the system share sheet (Instagram/WhatsApp Stories), entirely on the device (FR-101 to FR-116).
import type { ExportFormat } from './filename';

export type ShareOutcome = 'shared' | 'cancelled' | 'needs-gesture' | 'failed';

const MIME: Record<ExportFormat, string> = { png: 'image/png', jpg: 'image/jpeg' };

/** True only if this browser can share an image file of this format (research S3). Never throws. */
export function canShareImages(format: ExportFormat): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], `probe.${format}`, { type: MIME[format] })] });
  } catch {
    return false;
  }
}

/** Opens the system share sheet with only this file; no title/text/url, which some targets prefer over the image (research S8). Never throws. */
export async function shareFile(file: File): Promise<ShareOutcome> {
  const data: ShareData = { files: [file] };
  try {
    if (typeof navigator.canShare !== 'function' || !navigator.canShare(data)) return 'failed';
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    const name = typeof e === 'object' && e !== null && 'name' in e ? e.name : '';
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'needs-gesture';
    return 'failed';
  }
}

/** width:height is exactly 9:16, the Story frame. */
export function isStoryShape(canvas: { width: number; height: number }): boolean {
  return canvas.width * 16 === canvas.height * 9;
}
