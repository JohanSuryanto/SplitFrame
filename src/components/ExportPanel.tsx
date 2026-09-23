import { useState } from 'react';
import type { Doc } from '../model/types';
import { ExportError, exportCollage } from '../render/exportCanvas';
import type { ExportSettings } from '../state/uiState';
import { DownloadIcon } from './icons';
import styles from './Panel.module.css';

interface ExportPanelProps {
  doc: Doc;
  settings: ExportSettings;
  onChange: (patch: Partial<ExportSettings>) => void;
  pushToast: (message: string) => void;
}

/** Format (PNG/JPG), JPG quality and Download (FR-031 to FR-035). */
export function ExportPanel({ doc, settings, onChange, pushToast }: ExportPanelProps) {
  const [busy, setBusy] = useState(false);

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
      <button type="button" className={styles.primary} onClick={download} disabled={busy} aria-busy={busy}>
        <DownloadIcon />
        {busy ? 'Exporting…' : 'Download'}
      </button>
      <p className={styles.meta}>
        {doc.canvas.width} × {doc.canvas.height} px · saved to your device only
      </p>
    </>
  );
}
