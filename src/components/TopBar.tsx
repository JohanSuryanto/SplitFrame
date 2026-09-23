import { DownloadIcon, EyeIcon, LogoMark, RedoIcon, UndoIcon } from './icons';
import { SHEET_IGNORE_ATTR } from './Sheet';
import styles from './TopBar.module.css';

interface TopBarProps {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onPreview: () => void;
  exportOpen: boolean;
  onToggleExport: () => void;
}

/** Wordmark on the left; history, Preview and Export on the right. */
export function TopBar({ canUndo, canRedo, undo, redo, onPreview, exportOpen, onToggleExport }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <LogoMark />
        <h1 className={styles.name}>SplitFrame</h1>
      </div>
      <nav className={styles.actions} aria-label="Collage actions">
        <button type="button" className={styles.icon} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={undo}>
          <UndoIcon />
        </button>
        <button type="button" className={styles.icon} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <RedoIcon />
        </button>
        <span className={styles.sep} aria-hidden="true" />
        <button type="button" className={styles.ghost} aria-label="Preview collage" onClick={onPreview}>
          <EyeIcon />
          <span className={styles.label}>Preview</span>
        </button>
        <button
          type="button"
          {...{ [SHEET_IGNORE_ATTR]: '' }}
          className={styles.primary}
          aria-label="Export"
          aria-expanded={exportOpen}
          aria-controls="export-sheet"
          onClick={onToggleExport}
        >
          <DownloadIcon />
          <span className={styles.label}>Export</span>
        </button>
      </nav>
    </header>
  );
}
