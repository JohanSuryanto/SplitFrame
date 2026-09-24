import { cellsInReadingOrder } from '../model/layout';
import type { Doc } from '../model/types';
import type { DocAction } from '../state/docReducer';
import { assignSamples, type SampleId } from './plan';
import { loadSample } from './samples';

/** Fills every empty cell with a sample, as one undo step. Returns how many cells were filled. */
export async function fillEmptyWithSamples(doc: Doc, commit: (a: DocAction) => void): Promise<number> {
  const cells = cellsInReadingOrder(doc.layout);
  const empty = cells.filter((c) => !c.image).map((c) => c.id);
  if (empty.length === 0) return 0;
  // Continue the cycle after any photos already there, so neighbours tend to differ.
  const plan = assignSamples(empty, cells.length - empty.length);
  const assets = await Promise.all(plan.map((p) => loadSample(p.sampleId, doc.canvas)));
  commit({ type: 'setImages', entries: plan.map((p, i) => ({ cellId: p.cellId, assetId: assets[i]!.id })) });
  return plan.length;
}

/** Puts one sample in one cell (replacing any photo there). */
export async function putSampleIn(doc: Doc, cellId: string, sampleId: SampleId, commit: (a: DocAction) => void): Promise<void> {
  const asset = await loadSample(sampleId, doc.canvas);
  commit({ type: 'setImage', cellId, assetId: asset.id });
}
