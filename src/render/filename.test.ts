import { exportFilename } from './filename';

describe('exportFilename (T027)', () => {
  it('uses local time, zero-padded, 24-hour clock', () => {
    expect(exportFilename(new Date(2026, 8, 3, 9, 5), 'png')).toBe('splitframe-20260903-0905.png');
    expect(exportFilename(new Date(2026, 11, 31, 23, 59), 'png')).toBe('splitframe-20261231-2359.png');
  });

  it('gives the .jpg extension for JPG', () => {
    expect(exportFilename(new Date(2026, 0, 1, 0, 0), 'jpg')).toBe('splitframe-20260101-0000.jpg');
  });
});
