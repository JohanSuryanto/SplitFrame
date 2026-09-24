import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Doc } from '../model/types';
import { ExportError, exportCollage } from '../render/exportCanvas';
import { renderCollage } from '../render/renderCollage';
import type { ExportSettings, Toast } from '../state/uiState';
import { useShare } from '../state/useShare';
import { ShareIcon } from './icons';
import styles from './PreviewDialog.module.css';

interface PreviewDialogProps {
  doc: Doc;
  exportSettings: ExportSettings;
  onExportSettingsChange: (patch: Partial<ExportSettings>) => void;
  onClose: () => void;
  pushToast: (message: string, action?: Toast['action']) => void;
}

/** Room for the action bar; on phones it wraps onto two rows. */
const barHeight = () => (window.innerWidth < 768 ? 112 : 64);

function fit(canvas: { width: number; height: number }) {
  const w = window.innerWidth * 0.9;
  const h = window.innerHeight * 0.9 - barHeight();
  const k = Math.min(w / canvas.width, h / canvas.height);
  return { w: Math.max(1, Math.floor(canvas.width * k)), h: Math.max(1, Math.floor(canvas.height * k)) };
}

/**
 * The finished collage without any editing controls, drawn by the export renderer so it matches
 * the downloaded file (FR-041 to FR-043). Share is offered next to Export (FR-108), and the
 * Watermark switch mirrors the one in the Export panel (FR-209).
 */
export function PreviewDialog({ doc, exportSettings, onExportSettingsChange, onClose, pushToast }: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [display, setDisplay] = useState(() => fit(doc.canvas));
  const [busy, setBusy] = useState(false);
  const sharing = useShare({ doc, settings: exportSettings, pushToast, prerender: true });

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    const onResize = () => setDisplay(fit(doc.canvas));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [doc.canvas]);

  useLayoutEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const backing = { w: Math.round(display.w * dpr), h: Math.round(display.h * dpr) };
    c.width = backing.w;
    c.height = backing.h;
    renderCollage(ctx, doc, backing, { watermark: exportSettings.watermark });
  }, [doc, display, exportSettings.watermark]);

  const download = async () => {
    setBusy(true);
    try {
      await exportCollage(doc, exportSettings);
    } catch (e) {
      if (!(e instanceof ExportError)) console.error(e);
      pushToast('Export failed — try a smaller canvas size.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Collage preview"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.body}>
        <canvas ref={canvasRef} className={styles.canvas} style={{ width: display.w, height: display.h }} />
        <div className={styles.bar}>
          <span className={styles.size}>
            {doc.canvas.width} × {doc.canvas.height} · {exportSettings.format.toUpperCase()}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={exportSettings.watermark}
            className={styles.toggle}
            onClick={() => onExportSettingsChange({ watermark: !exportSettings.watermark })}
          >
            <span className={styles.track} aria-hidden="true">
              <span className={styles.thumb} />
            </span>
            Watermark
          </button>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Close
          </button>
          {sharing.supported && (
            <button
              type="button"
              className={styles.share}
              onClick={sharing.share}
              disabled={sharing.busy || busy}
              aria-busy={sharing.busy}
              aria-label="Share to Story or other apps"
            >
              <ShareIcon />
              {sharing.busy ? 'Preparing…' : 'Share'}
            </button>
          )}
          <button type="button" className={styles.primary} onClick={download} disabled={busy || sharing.busy} aria-busy={busy}>
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
