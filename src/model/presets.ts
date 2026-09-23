// Canvas-size presets and layout presets. Each layout preset just builds a split tree.
import { cellsInReadingOrder, defaultFraming, mapCells } from './layout';
import { newId, type CanvasPreset, type Direction, type LayoutNode } from './types';

export const CANVAS_PRESETS: Record<Exclude<CanvasPreset, 'custom'>, [number, number]> = {
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '16:9': [1920, 1080],
};

export type LayoutPresetKind = 'cols2' | 'cols3' | 'cols4' | 'rows2' | 'rows3' | 'grid2x2';

export const LAYOUT_PRESETS: { kind: LayoutPresetKind; label: string }[] = [
  { kind: 'cols2', label: '2 columns' },
  { kind: 'cols3', label: '3 columns' },
  { kind: 'cols4', label: '4 columns' },
  { kind: 'rows2', label: '2 rows' },
  { kind: 'rows3', label: '3 rows' },
  { kind: 'grid2x2', label: '2×2 grid' },
];

const cell = (): LayoutNode => ({ type: 'cell', id: newId() });

/** N equal parts: ratios 1/N, then 1/(N−1) of the rest, and so on. */
function equalParts(n: number, direction: Direction, part: () => LayoutNode = cell): LayoutNode {
  if (n <= 1) return part();
  return { type: 'split', id: newId(), direction, ratio: 1 / n, a: part(), b: equalParts(n - 1, direction, part) };
}

export function buildPreset(kind: LayoutPresetKind): LayoutNode {
  switch (kind) {
    case 'cols2':
      return equalParts(2, 'vertical');
    case 'cols3':
      return equalParts(3, 'vertical');
    case 'cols4':
      return equalParts(4, 'vertical');
    case 'rows2':
      return equalParts(2, 'horizontal');
    case 'rows3':
      return equalParts(3, 'horizontal');
    case 'grid2x2':
      return equalParts(2, 'horizontal', () => equalParts(2, 'vertical'));
  }
}

/** Builds the preset and moves existing photos into its cells in reading order. */
export function applyPreset(tree: LayoutNode, kind: LayoutPresetKind): { tree: LayoutNode; droppedImages: number } {
  const photos = cellsInReadingOrder(tree).flatMap((c) => (c.image ? [c.image.assetId] : []));
  let i = 0;
  const next = mapCells(buildPreset(kind), (c) => {
    const assetId = photos[i++];
    return assetId ? { ...c, image: defaultFraming(assetId) } : c;
  });
  return { tree: next, droppedImages: Math.max(photos.length - i, 0) };
}
