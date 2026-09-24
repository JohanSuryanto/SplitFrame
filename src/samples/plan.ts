// Which sample goes where. Pure, so it can be tested without a canvas.

export type SampleId = 'dunes' | 'lagoon' | 'mosaic';

export const SAMPLE_IDS: SampleId[] = ['dunes', 'lagoon', 'mosaic'];

export const SAMPLE_NAMES: Record<SampleId, string> = {
  dunes: 'Dunes',
  lagoon: 'Lagoon',
  mosaic: 'Mosaic',
};

/**
 * Assigns samples to cells in reading order, cycling through the set so neighbours differ.
 * `offset` starts the cycle elsewhere (for example after the samples already on the canvas).
 */
export function assignSamples(cellIds: string[], offset = 0): { cellId: string; sampleId: SampleId }[] {
  return cellIds.map((cellId, i) => ({ cellId, sampleId: SAMPLE_IDS[(i + offset) % SAMPLE_IDS.length]! }));
}
