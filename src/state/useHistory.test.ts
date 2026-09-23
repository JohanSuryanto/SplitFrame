// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { HISTORY_CAP, useHistory } from './useHistory';
import type { Doc } from '../model/types';
import { DEFAULT_STYLE } from '../model/types';

type Action = { type: 'gap'; value: number } | { type: 'image'; assetId: string | null };

function reducer(doc: Doc, action: Action): Doc {
  switch (action.type) {
    case 'gap':
      return { ...doc, style: { ...doc.style, gap: action.value } };
    case 'image':
      return {
        ...doc,
        layout:
          action.assetId === null
            ? { type: 'cell', id: 'c' }
            : { type: 'cell', id: 'c', image: { assetId: action.assetId, zoom: 1, focusX: 0.5, focusY: 0.5 } },
      };
  }
}

const initial: Doc = {
  canvas: { preset: '9:16', width: 1080, height: 1920 },
  layout: { type: 'cell', id: 'c' },
  style: DEFAULT_STYLE,
};

const setup = () => renderHook(() => useHistory(initial, reducer));

describe('useHistory', () => {
  it('commit pushes to past and clears future', () => {
    const { result } = setup();
    act(() => result.current.commit({ type: 'gap', value: 1 }));
    act(() => result.current.commit({ type: 'gap', value: 2 }));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.commit({ type: 'gap', value: 3 }));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.doc.style.gap).toBe(3);
  });

  it('undo and redo round-trip', () => {
    const { result } = setup();
    act(() => result.current.commit({ type: 'gap', value: 1 }));
    act(() => result.current.undo());
    expect(result.current.doc).toBe(initial);
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.redo());
    expect(result.current.doc.style.gap).toBe(1);
  });

  it('a gesture of many previews becomes exactly one history entry', () => {
    const { result } = setup();
    act(() => {
      for (let i = 1; i <= 10; i++) result.current.preview({ type: 'gap', value: i });
    });
    expect(result.current.inGesture).toBe(true);
    expect(result.current.doc.style.gap).toBe(10);
    act(() => result.current.endGesture());
    expect(result.current.inGesture).toBe(false);
    act(() => result.current.undo());
    expect(result.current.doc).toBe(initial);
    expect(result.current.canUndo).toBe(false);
  });

  it('endGesture with no net change pushes nothing', () => {
    const { result } = setup();
    act(() => result.current.endGesture());
    expect(result.current.canUndo).toBe(false);
    // A gesture that previews but leaves present at the same reference also pushes nothing.
    act(() => result.current.cancelGesture());
    expect(result.current.canUndo).toBe(false);
  });

  it('cancelGesture restores the pre-gesture doc', () => {
    const { result } = setup();
    act(() => result.current.preview({ type: 'gap', value: 5 }));
    act(() => result.current.cancelGesture());
    expect(result.current.doc).toBe(initial);
    expect(result.current.inGesture).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('undo is ignored while a gesture is in progress', () => {
    const { result } = setup();
    act(() => result.current.commit({ type: 'gap', value: 1 }));
    act(() => result.current.preview({ type: 'gap', value: 2 }));
    act(() => result.current.undo());
    expect(result.current.doc.style.gap).toBe(2);
    act(() => result.current.endGesture());
    act(() => result.current.undo());
    expect(result.current.doc.style.gap).toBe(1);
  });

  it(`caps past at ${HISTORY_CAP} entries`, () => {
    const { result } = setup();
    act(() => {
      for (let i = 1; i <= HISTORY_CAP + 20; i++) result.current.commit({ type: 'gap', value: i });
    });
    // Undo far more times than there are entries; extra undos are no-ops.
    act(() => {
      for (let i = 0; i < HISTORY_CAP * 2; i++) result.current.undo();
    });
    expect(result.current.canUndo).toBe(false);
    // Only the last 100 commits (21…120) can be undone, so we stop at gap 20.
    expect(result.current.doc.style.gap).toBe(20);
  });

  it('referencedAssetsInHistory covers past, present and future', () => {
    const { result } = setup();
    act(() => result.current.commit({ type: 'image', assetId: 'a1' }));
    act(() => result.current.commit({ type: 'image', assetId: 'a2' }));
    act(() => result.current.commit({ type: 'image', assetId: 'a3' }));
    act(() => result.current.undo());
    expect(result.current.referencedAssetsInHistory()).toEqual(new Set(['a1', 'a2', 'a3']));
    act(() => result.current.commit({ type: 'image', assetId: null }));
    // a3 was only in the future, which a new commit clears.
    expect(result.current.referencedAssetsInHistory()).toEqual(new Set(['a1', 'a2']));
  });
});
