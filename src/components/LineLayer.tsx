import { useMemo } from 'react';
import { NO_GESTURE_ATTR } from '../input/useGestures';
import { dividerLinesPx, styleScale } from '../model/geometry';
import type { Doc, PxCell, Pt, Size } from '../model/types';
import styles from './LineLayer.module.css';

interface LineLayerProps {
  doc: Doc;
  size: Size;
  cells: PxCell[];
  emptyIds: Set<string>;
  /** The selected freehand divider, highlighted. */
  selectedId?: string;
  /** When set, freehand dividers get hit targets and can be selected (research R24). */
  onSelectPath?: (splitId: string) => void;
  /** Delete/Backspace on a focused freehand divider. */
  onRemovePath?: (splitId: string) => void;
  /** The keyboard-focused cell; shaped cells get their focus ring drawn here (their clip hides the CSS one). */
  focusedCellId?: string;
}

const pointsAttr = (pts: Pt[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

/**
 * Draws the gap along every line (straight and freehand) in the background color and the dashed
 * outline of empty shaped cells (research R22), plus selectable hit targets for freehand lines.
 */
export function LineLayer({ doc, size, cells, emptyIds, selectedId, onSelectPath, onRemovePath, focusedCellId }: LineLayerProps) {
  const gap = doc.style.gap * styleScale(size);
  const lines = useMemo(() => dividerLinesPx(doc, size), [doc, size]);
  const freehand = lines.filter((l) => l.kind === 'path');

  const emptyShaped = cells.filter((c) => c.polygon && emptyIds.has(c.cellId));
  const focusedShaped = cells.find((c) => c.polygon && c.cellId === focusedCellId);

  return (
    <svg className={styles.layer} width={size.w} height={size.h} role="presentation">
      {gap > 0 &&
        lines.map((l) => (
          <polyline key={l.splitId} className={styles.gap} points={pointsAttr(l.points)} stroke={doc.style.color} strokeWidth={gap} />
        ))}
      {emptyShaped.map((c) => (
        <polygon key={c.cellId} className={styles.outline} points={pointsAttr(c.polygon!)} />
      ))}
      {freehand.map((f) =>
        f.splitId === selectedId ? <polyline key={`sel-${f.splitId}`} className={styles.selected} points={pointsAttr(f.points)} /> : null,
      )}
      {focusedShaped && <polygon className={styles.focusRing} points={pointsAttr(focusedShaped.polygon!)} />}
      {onSelectPath &&
        freehand.map((f, i) => (
          <polyline
            key={`hit-${f.splitId}`}
            {...{ [NO_GESTURE_ATTR]: '' }}
            className={styles.hit}
            points={pointsAttr(f.points)}
            tabIndex={0}
            role="button"
            aria-label={`Freehand divider ${i + 1} — press Delete to remove`}
            aria-pressed={f.splitId === selectedId}
            onClick={() => onSelectPath(f.splitId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectPath(f.splitId);
              } else if ((e.key === 'Delete' || e.key === 'Backspace') && onRemovePath) {
                e.preventDefault();
                e.stopPropagation();
                onRemovePath(f.splitId);
              }
            }}
          />
        ))}
    </svg>
  );
}
