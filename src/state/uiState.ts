// UI-only state. Not part of the undo history.
import { useCallback, useMemo, useReducer } from 'react';
import type { Direction } from '../model/types';
import { newId } from '../model/types';

export type Mode = 'arrange' | 'draw';

export interface SnapGuide {
  kind: 'center' | 'third' | 'edge';
  value: number;
}

export interface Stroke {
  axis: Direction;
  coord: number;
  span: [number, number];
  snapGuide?: SnapGuide;
  invalid: boolean;
}

export interface ExportSettings {
  format: 'png' | 'jpg';
  /** 10–100, default 92. */
  quality: number;
}

export interface Toast {
  id: string;
  message: string;
  action?: { label: string; run: () => void };
}

export interface UiState {
  mode: Mode;
  selectedDividerId?: string;
  focusedCellId?: string;
  stroke?: Stroke;
  previewOpen: boolean;
  exportSettings: ExportSettings;
  toasts: Toast[];
}

type UiAction =
  | { type: 'setMode'; mode: Mode }
  | { type: 'selectDivider'; id?: string }
  | { type: 'focusCell'; id?: string }
  | { type: 'setStroke'; stroke?: Stroke }
  | { type: 'setPreviewOpen'; open: boolean }
  | { type: 'setExportSettings'; patch: Partial<ExportSettings> }
  | { type: 'pushToast'; toast: Toast }
  | { type: 'dismissToast'; id: string };

export const initialUiState: UiState = {
  mode: 'arrange',
  previewOpen: false,
  exportSettings: { format: 'png', quality: 92 },
  toasts: [],
};

function uiReducer(s: UiState, a: UiAction): UiState {
  switch (a.type) {
    case 'setMode':
      return { ...s, mode: a.mode, stroke: undefined };
    case 'selectDivider':
      return { ...s, selectedDividerId: a.id };
    case 'focusCell':
      return { ...s, focusedCellId: a.id };
    case 'setStroke':
      return { ...s, stroke: a.stroke };
    case 'setPreviewOpen':
      return { ...s, previewOpen: a.open };
    case 'setExportSettings': {
      const next = { ...s.exportSettings, ...a.patch };
      next.quality = Math.round(Math.min(Math.max(next.quality, 10), 100));
      return { ...s, exportSettings: next };
    }
    case 'pushToast':
      return { ...s, toasts: [...s.toasts.slice(-3), a.toast] };
    case 'dismissToast':
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
  }
}

export function useUiState() {
  const [ui, dispatch] = useReducer(uiReducer, initialUiState);

  const pushToast = useCallback(
    (message: string, action?: Toast['action']) => dispatch({ type: 'pushToast', toast: { id: newId(), message, action } }),
    [],
  );
  const dismissToast = useCallback((id: string) => dispatch({ type: 'dismissToast', id }), []);

  const actions = useMemo(
    () => ({
      setMode: (mode: Mode) => dispatch({ type: 'setMode', mode }),
      selectDivider: (id?: string) => dispatch({ type: 'selectDivider', id }),
      focusCell: (id?: string) => dispatch({ type: 'focusCell', id }),
      setStroke: (stroke?: Stroke) => dispatch({ type: 'setStroke', stroke }),
      setPreviewOpen: (open: boolean) => dispatch({ type: 'setPreviewOpen', open }),
      setExportSettings: (patch: Partial<ExportSettings>) => dispatch({ type: 'setExportSettings', patch }),
      pushToast,
      dismissToast,
    }),
    [pushToast, dismissToast],
  );

  return { ui, ...actions };
}

export type UiApi = ReturnType<typeof useUiState>;
