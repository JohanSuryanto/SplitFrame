import { cellsInReadingOrder } from '../model/layout';
import { DEFAULT_SIGNATURE_PLACEMENT, type LayoutNode, type Signature, type SignaturePicture, type Watermark } from '../model/types';
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

describe('setWatermark (feature 005, T004)', () => {
  const set = (patch: Partial<Watermark>, doc = initialDoc()) => docReducer(doc, { type: 'setWatermark', patch });

  it('cuts text to 100 characters', () => {
    expect(set({ text: 'x'.repeat(150) }).watermark.text).toHaveLength(100);
  });

  it('clamps opacity, size and position', () => {
    expect(set({ opacity: 0 }).watermark.opacity).toBe(0.1);
    expect(set({ opacity: 2 }).watermark.opacity).toBe(1);
    expect(set({ size: 0.5 }).watermark.size).toBe(0.2);
    expect(set({ size: 0 }).watermark.size).toBe(0.02);
    expect(set({ x: -1 }).watermark.x).toBe(0);
    expect(set({ y: 3 }).watermark.y).toBe(1);
  });

  it('clamps rotation and snaps near 0', () => {
    expect(set({ rotation: 120 }).watermark.rotation).toBe(90);
    expect(set({ rotation: -2 }).watermark.rotation).toBe(0);
    expect(set({ rotation: 2.9 }).watermark.rotation).toBe(0);
    expect(set({ rotation: 4 }).watermark.rotation).toBe(4);
  });

  it('accepts only #RRGGBB colors, uppercased', () => {
    expect(set({ color: '#ff0000' }).watermark.color).toBe('#FF0000');
    expect(set({ color: 'red' }).watermark.color).toBe('#FFFFFF');
    expect(set({ color: '#fff' }).watermark.color).toBe('#FFFFFF');
  });

  it('returns the same doc when nothing changes', () => {
    const doc = initialDoc();
    expect(set({ opacity: 0.5, x: 0.5 }, doc)).toBe(doc);
    expect(set({ color: 'red' }, doc)).toBe(doc);
  });

  it('tilts to −30° when Repeat turns on at 0°, and keeps other angles', () => {
    expect(set({ repeat: true }).watermark.rotation).toBe(-30);
    const tilted = set({ rotation: 15 });
    expect(set({ repeat: true }, tilted).watermark.rotation).toBe(15);
  });

  it('keeps rotation and position when Repeat turns off', () => {
    const on = set({ repeat: true, x: 0.2, y: 0.8 });
    const off = set({ repeat: false }, on);
    expect(off.watermark).toMatchObject({ repeat: false, rotation: -30, x: 0.2, y: 0.8 });
  });

  it('is kept by newCollage', () => {
    let doc = initialDoc();
    doc = docReducer(doc, { type: 'setImage', cellId: doc.layout.id, assetId: 'a' });
    doc = set({ text: 'For Bank X only', color: '#E53935' }, doc);
    expect(docReducer(doc, { type: 'newCollage' }).watermark).toBe(doc.watermark);
  });
});

describe('signature actions (feature 006, T004)', () => {
  const pic: SignaturePicture = { kind: 'strokes', strokes: [[{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }]], aspect: 3, lineWidth: 0.02 };
  const withSig = () => docReducer(initialDoc(), { type: 'setSignaturePicture', picture: pic });
  const patch = (p: Partial<Omit<Signature, 'picture'>>, doc = withSig()) => docReducer(doc, { type: 'setSignature', patch: p });

  it('creates a signature with the default placement', () => {
    expect(withSig().signature).toEqual({ picture: pic, ...DEFAULT_SIGNATURE_PLACEMENT });
  });

  it('replaces the picture and keeps placement', () => {
    const placed = patch({ x: 0.2, size: 0.5, color: '#1E3A8A' });
    const other: SignaturePicture = { kind: 'image', assetId: 'a', aspect: 2 };
    const next = docReducer(placed, { type: 'setSignaturePicture', picture: other });
    expect(next.signature).toMatchObject({ picture: other, x: 0.2, size: 0.5, color: '#1E3A8A' });
  });

  it('sets keepColors with the picture', () => {
    const next = docReducer(initialDoc(), { type: 'setSignaturePicture', picture: pic, keepColors: true });
    expect(next.signature?.keepColors).toBe(true);
  });

  it('clamps every field', () => {
    expect(patch({ size: 0.05 }).signature?.size).toBe(0.1);
    expect(patch({ size: 0.9 }).signature?.size).toBe(0.8);
    expect(patch({ opacity: 0 }).signature?.opacity).toBe(0.1);
    expect(patch({ rotation: 2 }).signature?.rotation).toBe(0);
    expect(patch({ rotation: -120 }).signature?.rotation).toBe(-90);
    expect(patch({ rotation: 10 }).signature?.rotation).toBe(10);
    expect(patch({ x: -1 }).signature?.x).toBe(0);
    expect(patch({ color: '#1e3a8a' }).signature?.color).toBe('#1E3A8A');
    expect(patch({ color: 'blue' }).signature?.color).toBe('#111111');
  });

  it('returns the same doc for no-ops', () => {
    const blank = initialDoc();
    expect(patch({ x: 0.3 }, blank)).toBe(blank);
    const doc = withSig();
    expect(patch({ x: 0.75, color: 'blue' }, doc)).toBe(doc);
    expect(docReducer(blank, { type: 'removeSignature' })).toBe(blank);
  });

  it('removes the signature', () => {
    expect(docReducer(withSig(), { type: 'removeSignature' }).signature).toBeNull();
  });

  it('is kept by newCollage', () => {
    let doc = withSig();
    doc = docReducer(doc, { type: 'setImage', cellId: doc.layout.id, assetId: 'a' });
    expect(docReducer(doc, { type: 'newCollage' }).signature).toBe(doc.signature);
  });
});
