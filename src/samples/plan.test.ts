import { assignSamples, SAMPLE_IDS } from './plan';

describe('assignSamples', () => {
  it('cycles through the three samples in reading order', () => {
    expect(assignSamples(['a', 'b', 'c', 'd']).map((x) => x.sampleId)).toEqual(['dunes', 'lagoon', 'mosaic', 'dunes']);
  });

  it('can start the cycle at an offset', () => {
    expect(assignSamples(['a', 'b'], 1).map((x) => x.sampleId)).toEqual(['lagoon', 'mosaic']);
  });

  it('keeps the cell ids and handles no cells', () => {
    expect(assignSamples(['x']).map((x) => x.cellId)).toEqual(['x']);
    expect(assignSamples([])).toEqual([]);
  });

  it('ships exactly three samples for the MVP', () => {
    expect(SAMPLE_IDS).toHaveLength(3);
  });
});
