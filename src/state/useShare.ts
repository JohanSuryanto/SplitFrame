// Share button state for the Export panel and Preview: render once, open the share sheet, and turn
// every outcome into the right message (FR-106, FR-113 to FR-116; research S4, S5).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Doc } from '../model/types';
import { ExportError, downloadFile, renderExportFile } from '../render/exportCanvas';
import { canShareImages, shareFile } from '../render/share';
import type { ExportSettings, Toast } from './uiState';

interface UseShareOptions {
  doc: Doc;
  settings: ExportSettings;
  pushToast: (message: string, action?: Toast['action']) => void;
  /** Render as soon as possible so Share opens inside the tap's activation window (Preview only). */
  prerender?: boolean;
}

interface Rendered {
  doc: Doc;
  settings: ExportSettings;
  file: Promise<File>;
}

/** Doc is immutable, so reference equality identifies the collage; quality only matters for JPG. */
function sameInput(r: Rendered, doc: Doc, settings: ExportSettings): boolean {
  return (
    r.doc === doc &&
    r.settings.format === settings.format &&
    (settings.format === 'png' || r.settings.quality === settings.quality)
  );
}

export function useShare({ doc, settings, pushToast, prerender = false }: UseShareOptions) {
  const supported = useMemo(() => canShareImages(settings.format), [settings.format]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // The latest render, pending or done. Only one full-size file is kept at a time (research S9).
  const renderedRef = useRef<Rendered | null>(null);

  const getFile = useCallback((): Promise<File> => {
    const r = renderedRef.current;
    if (r && sameInput(r, doc, settings)) return r.file;
    const file = renderExportFile(doc, settings);
    const entry: Rendered = { doc, settings, file };
    renderedRef.current = entry;
    // A failed render is not cached, so the next tap tries again.
    file.catch(() => {
      if (renderedRef.current === entry) renderedRef.current = null;
    });
    return file;
  }, [doc, settings]);

  useEffect(() => {
    // Errors are reported by the real tap, not by the background render.
    if (prerender && supported) getFile().catch(() => {});
  }, [prerender, supported, getFile]);

  const offerDownload = useCallback(
    (file: File) => pushToast("Couldn't open sharing.", { label: 'Download', run: () => downloadFile(file) }),
    [pushToast],
  );

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let file: File;
      try {
        file = await getFile();
      } catch (e) {
        if (!(e instanceof ExportError)) console.error(e);
        pushToast('Export failed — try a smaller canvas size.');
        return;
      }
      const outcome = await shareFile(file);
      if (outcome === 'needs-gesture') {
        // The render outlived the tap's activation; the toast button is a fresh tap (FR-116).
        pushToast('Your image is ready', {
          label: 'Share',
          run: () => {
            void shareFile(file).then((o) => {
              if (o === 'needs-gesture' || o === 'failed') offerDownload(file);
            });
          },
        });
      } else if (outcome === 'failed') {
        offerDownload(file);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [getFile, pushToast, offerDownload]);

  const share = useCallback(() => void run(), [run]);

  return { supported, busy, share };
}
