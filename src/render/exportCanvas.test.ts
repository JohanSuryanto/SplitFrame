import type { Doc } from '../model/types';
import type { ExportSettings } from '../state/uiState';
import { sameExportInput } from './exportCanvas';

const doc = {} as Doc;
const png: ExportSettings = { format: 'png', quality: 92, watermark: true };
const jpg: ExportSettings = { format: 'jpg', quality: 92, watermark: true };

describe('sameExportInput (T003)', () => {
  it('matches the same doc and settings', () => {
    expect(sameExportInput({ doc, settings: png }, { doc, settings: { ...png } })).toBe(true);
  });

  it('tells apart a different doc', () => {
    expect(sameExportInput({ doc, settings: png }, { doc: {} as Doc, settings: png })).toBe(false);
  });

  it('tells apart a different format', () => {
    expect(sameExportInput({ doc, settings: png }, { doc, settings: jpg })).toBe(false);
  });

  it('tells apart the watermark setting', () => {
    expect(sameExportInput({ doc, settings: png }, { doc, settings: { ...png, watermark: false } })).toBe(false);
  });

  it('ignores quality for PNG but not for JPG', () => {
    expect(sameExportInput({ doc, settings: png }, { doc, settings: { ...png, quality: 50 } })).toBe(true);
    expect(sameExportInput({ doc, settings: jpg }, { doc, settings: { ...jpg, quality: 50 } })).toBe(false);
  });
});
