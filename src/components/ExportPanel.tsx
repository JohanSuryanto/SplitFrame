import { useState } from 'react';
import type { Doc } from '../model/types';
import { ExportError, exportCollage } from '../render/exportCanvas';
import type { ExportSettings, Toast } from '../state/uiState';
import { isStoryShape } from '../render/share';
import { useShare } from '../state/useShare';
import { DownloadIcon, ShareIcon } from './icons';
import styles from './Panel.module.css';

interface ExportPanelProps {
  doc: Doc;
  settings: ExportSettings;
  onChange: (patch: Partial<ExportSettings>) => void;
  pushToast: (message: string, action?: Toast['action']) => void;
}

/** Format (PNG/JPG), JPG quality, Share and Download (FR-031 to FR-035, FR-108 to FR-111). */
export function ExportPanel({ doc, settings, onChange, pushToast }: ExportPanelProps) {
  const [busy, setBusy] = useState(false);
  const sharing = useShare({ doc, settings, pushToast });

  const download = async () => {
    setBusy(true);
    try {
      await exportCollage(doc, settings);
    } catch (e) {
      if (!(e instanceof ExportError)) console.error(e);
      pushToast('Export failed — try a smaller canvas size.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Format</h3>
        <div className={styles.segmented} role="group" aria-label="File format">
          {(['png', 'jpg'] as const).map((f) => (
            <button key={f} type="button" className={styles.segment} aria-pressed={settings.format === f} onClick={() => onChange({ format: f })}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {settings.format === 'jpg' && (
        <div className={styles.section}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Quality
              <output className={styles.fieldValue}>{settings.quality}%</output>
            </span>
            <input
              className={styles.range}
              type="range"
              min={10}
              max={100}
              value={settings.quality}
              onChange={(e) => onChange({ quality: Number(e.target.value) })}
              aria-valuetext={`${settings.quality}%`}
            />
          </label>
        </div>
      )}
      <div className={styles.actions}>
        {sharing.supported && (
          <button
            type="button"
            className={styles.shareButton}
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
          <DownloadIcon />
          {busy ? 'Exporting…' : 'Download'}
        </button>
      </div>
      {sharing.supported && !isStoryShape(doc.canvas) && <p className={styles.meta}>Stories are 9:16 — other shapes get borders.</p>}
      <p className={styles.meta}>
        {doc.canvas.width} × {doc.canvas.height} px · stays on your device until you share it
      </p>
    </>
  );
}
