import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Doc } from '../model/types';
import { ExportError, exportCollage } from '../render/exportCanvas';
import { renderCollage } from '../render/renderCollage';
import type { ExportSettings } from '../state/uiState';
import styles from './PreviewDialog.module.css';

interface PreviewDialogProps {
  doc: Doc;
  exportSettings: ExportSettings;
  onClose: () => void;
  pushToast: (message: string) => void;
}

const BAR = 64;

function fit(canvas: { width: number; height: number }) {
  const w = window.innerWidth * 0.9;
  const h = window.innerHeight * 0.9 - BAR;
  const k = Math.min(w / canvas.width, h / canvas.height);
  return { w: Math.max(1, Math.floor(canvas.width * k)), h: Math.max(1, Math.floor(canvas.height * k)) };
}

/**
 * The finished collage without any editing controls, drawn by the export renderer so it matches
 * the downloaded file (FR-041 to FR-043).
 */
export function PreviewDialog({ doc, exportSettings, onClose, pushToast }: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [display, setDisplay] = useState(() => fit(doc.canvas));
  const [busy, setBusy] = useState(false);

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
    renderCollage(ctx, doc, backing);
  }, [doc, display]);

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
          <button type="button" className={styles.secondary} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.primary} onClick={download} disabled={busy} aria-busy={busy}>
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
