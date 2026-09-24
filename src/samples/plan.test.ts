import { assignSamples, SAMPLE_IDS } from './plan';

describe('assignSamples', () => {
  it('cycles through all the samples in reading order', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
    expect(assignSamples(ids).map((x) => x.sampleId)).toEqual([
      'dunes',
      'lagoon',
      'mosaic',
      'aurora',
      'bloom',
      'terrazzo',
      'dunes',
      'lagoon',
    ]);
  });

  it('can start the cycle at an offset', () => {
    expect(assignSamples(['a', 'b'], 1).map((x) => x.sampleId)).toEqual(['lagoon', 'mosaic']);
  });

  it('keeps the cell ids and handles no cells', () => {
    expect(assignSamples(['x']).map((x) => x.cellId)).toEqual(['x']);
    expect(assignSamples([])).toEqual([]);
  });

  it('ships six samples with unique ids', () => {
    expect(SAMPLE_IDS).toHaveLength(6);
    expect(new Set(SAMPLE_IDS).size).toBe(6);
  });
});
