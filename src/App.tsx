import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Dock, type PanelName } from './components/Dock';
import { Editor } from './components/Editor';
import { ExportPanel } from './components/ExportPanel';
import { LayoutPanel } from './components/LayoutPanel';
import { PreviewDialog } from './components/PreviewDialog';
import { Sheet } from './components/Sheet';
import { StylePanel } from './components/StylePanel';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { docReducer, hasWork, initialDoc } from './state/docReducer';
import { releaseUnreferenced } from './state/imageStore';
import { useHistory } from './state/useHistory';
import { useUiState } from './state/uiState';
import styles from './App.module.css';

const firstDoc = initialDoc();

const TITLES: Record<PanelName, string> = { layout: 'Layout', style: 'Style', export: 'Export' };

export default function App() {
  const history = useHistory(firstDoc, docReducer);
  const ui = useUiState();
  const { referencedAssetsInHistory } = history;
  const [panel, setPanel] = useState<PanelName | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const togglePanel = (p: PanelName) => setPanel((cur) => (cur === p ? null : p));

  // D / A switch between Draw lines and Arrange, except while typing in a field.
  const { setMode } = ui;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'd' || e.key === 'D') setMode('draw');
      else if (e.key === 'a' || e.key === 'A') setMode('arrange');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode]);

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes (FR-036); not while typing or mid-gesture.
  const { undo, redo, inGesture } = history;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const key = e.key.toLowerCase();
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.shiftKey);
      const isUndo = key === 'z' && !e.shiftKey;
      if (!isRedo && !isUndo) return;
      e.preventDefault();
      if (inGesture) return;
      if (isRedo) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, inGesture]);

  // Free photos that no undo, present or redo state can reach any more (FR-027).
  useEffect(() => {
    releaseUnreferenced(referencedAssetsInHistory());
  }, [referencedAssetsInHistory]);

  const openPreview = () => {
    setPanel(null);
    ui.setPreviewOpen(true);
  };

  const drawing = ui.ui.mode === 'draw';
  const dirty = hasWork(history.doc);

  // Start again (keeps canvas shape and style). Asks first, and can still be undone.
  const [confirmNew, setConfirmNew] = useState(false);
  const startNew = () => {
    setConfirmNew(false);
    setPanel(null);
    ui.setMode('arrange');
    ui.selectDivider(undefined);
    history.commit({ type: 'newCollage' });
    ui.pushToast('Started a new collage', { label: 'Undo', run: history.undo });
  };

  // Refreshing or closing the tab would lose everything: let the browser ask first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <div className={styles.app}>
      <TopBar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        undo={history.undo}
        redo={history.redo}
        onPreview={openPreview}
        exportOpen={panel === 'export'}
        onToggleExport={() => togglePanel('export')}
        canStartNew={dirty}
        onNew={() => (dirty ? setConfirmNew(true) : undefined)}
      />
      <main className={styles.main}>
        <Editor
          doc={history.doc}
          mode={ui.ui.mode}
          setMode={ui.setMode}
          commit={history.commit}
          preview={history.preview}
          endGesture={history.endGesture}
          cancelGesture={history.cancelGesture}
          undo={history.undo}
          selectedDividerId={ui.ui.selectedDividerId}
          selectDivider={ui.selectDivider}
          pushToast={ui.pushToast}
          onPreview={openPreview}
        />
      </main>

      {panel && (
        <Sheet title={TITLES[panel]} onClose={closePanel}>
          <div id={`${panel}-sheet`}>
            {panel === 'layout' && <LayoutPanel doc={history.doc} commit={history.commit} undo={history.undo} pushToast={ui.pushToast} />}
            {panel === 'style' && (
              <StylePanel doc={history.doc} commit={history.commit} preview={history.preview} endGesture={history.endGesture} />
            )}
            {panel === 'export' && (
              <ExportPanel doc={history.doc} settings={ui.ui.exportSettings} onChange={ui.setExportSettings} pushToast={ui.pushToast} />
            )}
          </div>
        </Sheet>
      )}

      <Dock
        panel={panel}
        drawing={drawing}
        onTogglePanel={togglePanel}
        onToggleDraw={() => {
          setPanel(null);
          ui.setMode(drawing ? 'arrange' : 'draw');
        }}
      />

      {ui.ui.previewOpen && (
        <PreviewDialog
          doc={history.doc}
          exportSettings={ui.ui.exportSettings}
          onClose={() => ui.setPreviewOpen(false)}
          pushToast={ui.pushToast}
        />
      )}
      {confirmNew && (
        <ConfirmDialog
          title="Start a new collage?"
          message="Your photos and lines will be cleared. The canvas size and style stay the same, and you can undo this."
          confirmLabel="Start new"
          onConfirm={startNew}
          onCancel={() => setConfirmNew(false)}
        />
      )}
      <Toasts toasts={ui.ui.toasts} onDismiss={ui.dismissToast} />
    </div>
  );
}
