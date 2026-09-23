// Snapshot-based undo/redo. See data-model.md §3.
import { useCallback, useReducer } from 'react';
import { referencedAssets } from '../model/layout';
import type { Doc } from '../model/types';

export const HISTORY_CAP = 100;

export interface History {
  past: Doc[];
  present: Doc;
  future: Doc[];
  /** The doc as it was when the current gesture started. Set only during a gesture. */
  gestureBase?: Doc;
}

type Op<A> =
  | { kind: 'commit'; action: A }
  | { kind: 'preview'; action: A }
  | { kind: 'endGesture' }
  | { kind: 'cancelGesture' }
  | { kind: 'undo' }
  | { kind: 'redo' };

const pushPast = (past: Doc[], doc: Doc) => [...past, doc].slice(-HISTORY_CAP);

export function historyReducer<A>(reducer: (doc: Doc, action: A) => Doc) {
  return (h: History, op: Op<A>): History => {
    switch (op.kind) {
      case 'commit': {
        // A commit during a gesture first closes the gesture so nothing is lost.
        const base = h.gestureBase ?? h.present;
        const next = reducer(h.present, op.action);
        if (next === h.present && !h.gestureBase) return h;
        return { past: pushPast(h.past, base), present: next, future: [] };
      }
      case 'preview': {
        const next = reducer(h.present, op.action);
        return { ...h, present: next, gestureBase: h.gestureBase ?? h.present };
      }
      case 'endGesture': {
        if (!h.gestureBase) return h;
        if (h.present === h.gestureBase) return { past: h.past, present: h.present, future: h.future };
        return { past: pushPast(h.past, h.gestureBase), present: h.present, future: [] };
      }
      case 'cancelGesture': {
        if (!h.gestureBase) return h;
        return { past: h.past, present: h.gestureBase, future: h.future };
      }
      case 'undo': {
        const prev = h.past[h.past.length - 1];
        if (h.gestureBase || !prev) return h;
        return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
      }
      case 'redo': {
        const next = h.future[0];
        if (h.gestureBase || !next) return h;
        return { past: pushPast(h.past, h.present), present: next, future: h.future.slice(1) };
      }
    }
  };
}

export function historyAssets(h: History): Set<string> {
  const out = new Set<string>();
  const docs = [...h.past, h.present, ...h.future];
  if (h.gestureBase) docs.push(h.gestureBase);
  for (const d of docs) for (const id of referencedAssets(d.layout)) out.add(id);
  return out;
}

export function useHistory<A>(initial: Doc, reducer: (doc: Doc, action: A) => Doc) {
  // The reducer function is created once per hook instance; callers pass a module-level reducer.
  const [h, dispatch] = useReducer(historyReducer(reducer), { past: [], present: initial, future: [] });

  const commit = useCallback((action: A) => dispatch({ kind: 'commit', action }), []);
  const preview = useCallback((action: A) => dispatch({ kind: 'preview', action }), []);
  const endGesture = useCallback(() => dispatch({ kind: 'endGesture' }), []);
  const cancelGesture = useCallback(() => dispatch({ kind: 'cancelGesture' }), []);
  const undo = useCallback(() => dispatch({ kind: 'undo' }), []);
  const redo = useCallback(() => dispatch({ kind: 'redo' }), []);
  const referencedAssetsInHistory = useCallback(() => historyAssets(h), [h]);

  return {
    doc: h.present,
    history: h,
    commit,
    preview,
    endGesture,
    cancelGesture,
    undo,
    redo,
    canUndo: h.past.length > 0 && !h.gestureBase,
    canRedo: h.future.length > 0 && !h.gestureBase,
    inGesture: h.gestureBase !== undefined,
    referencedAssetsInHistory,
  };
}

export type HistoryApi<A> = ReturnType<typeof useHistory<A>>;
