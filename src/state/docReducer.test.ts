import { docReducer, hasWork, initialDoc } from './docReducer';

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
