import { cellsInReadingOrder } from '../model/layout';
import type { LayoutNode } from '../model/types';
import { docReducer, hasWork, initialDoc } from './docReducer';

const collectIds = (t: LayoutNode) => cellsInReadingOrder(t).map((c) => c.id);
const photos = (t: LayoutNode) => cellsInReadingOrder(t).map((c) => c.image?.assetId);

describe('newCollage', () => {
  it('has nothing to lose on a blank canvas', () => {
    const doc = initialDoc();
    expect(hasWork(doc)).toBe(false);
    expect(docReducer(doc, { type: 'newCollage' })).toBe(doc);
  });

  it('clears lines and photos but keeps the canvas shape and style', () => {
    let doc = docReducer(initialDoc(), { type: 'setCanvasPreset', preset: '1:1' });
    doc = docReducer(doc, { type: 'setStyle', patch: { gap: 20 } });
    doc = docReducer(doc, { type: 'applyPreset', kind: 'cols3' });
    expect(hasWork(doc)).toBe(true);
    const fresh = docReducer(doc, { type: 'newCollage' });
    expect(fresh.layout.type).toBe('cell');
    expect(hasWork(fresh)).toBe(false);
    expect(fresh.canvas).toEqual(doc.canvas);
    expect(fresh.style).toEqual(doc.style);
  });

  it('counts a photo in a single cell as work', () => {
    const doc = initialDoc();
    const withPhoto = docReducer(doc, { type: 'setImage', cellId: doc.layout.id, assetId: 'a' });
    expect(hasWork(withPhoto)).toBe(true);
    expect(hasWork(docReducer(withPhoto, { type: 'newCollage' }))).toBe(false);
  });
});

describe('setImages', () => {
  it('fills several cells in one step', () => {
    const doc = docReducer(initialDoc(), { type: 'applyPreset', kind: 'cols3' });
    const ids = collectIds(doc.layout);
    const next = docReducer(doc, {
      type: 'setImages',
      entries: ids.slice(0, 2).map((cellId, i) => ({ cellId, assetId: `s${i}` })),
    });
    expect(photos(next.layout)).toEqual(['s0', 's1', undefined]);
  });

  it('is a no-op with no entries', () => {
    const doc = initialDoc();
    expect(docReducer(doc, { type: 'setImages', entries: [] })).toBe(doc);
  });
});

describe('setImage framing (feature 004, T004)', () => {
  const framingOf = (d: ReturnType<typeof initialDoc>) => {
    const c = cellsInReadingOrder(d.layout)[0]!;
    return { zoom: c.image?.zoom, focusX: c.image?.focusX, focusY: c.image?.focusY };
  };

  it('applies the framing chosen in Adjust', () => {
    const d = initialDoc();
    const next = docReducer(d, { type: 'setImage', cellId: d.layout.id, assetId: 'a', framing: { zoom: 0.6, focusX: 0.3, focusY: 0.7 } });
    expect(framingOf(next)).toEqual({ zoom: 0.6, focusX: 0.3, focusY: 0.7 });
  });

  it('uses the default fill without a framing', () => {
    const d = initialDoc();
    expect(framingOf(docReducer(d, { type: 'setImage', cellId: d.layout.id, assetId: 'a' }))).toEqual({ zoom: 1, focusX: 0.5, focusY: 0.5 });
  });
});
