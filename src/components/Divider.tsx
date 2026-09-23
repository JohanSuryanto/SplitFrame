import { useRef, type KeyboardEvent } from 'react';
import { NO_GESTURE_ATTR, useGestures, type Point } from '../input/useGestures';
import { snap, snapCandidates, type Area } from '../model/snap';
import type { Divider as DividerLine, LayoutNode } from '../model/types';
import styles from './Divider.module.css';

const SNAP_PX = 8;

interface DividerProps {
  divider: DividerLine;
  layout: LayoutNode;
  /** Content area in preview px. */
  content: Area;
  /** Converts a viewport point to content-area px (the surface moves the divider while dragging). */
  clientToContent: (clientX: number, clientY: number) => Point;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onPreview: (splitId: string, coord: number) => void;
  onCommit: (splitId: string, coord: number) => void;
  onEndGesture: () => void;
  onCancelGesture: () => void;
}

/** A straight divider: drag to resize (snapping to parallel edges), tap to select, × to remove. */
export function Divider(props: DividerProps) {
  const { divider: d, layout, content, selected } = props;
  const ref = useRef<HTMLDivElement>(null);
  const horizontal = d.direction === 'horizontal';

  const xPx = (n: number) => content.x + n * content.w;
  const yPx = (n: number) => content.y + n * content.h;
  const along = horizontal ? content.h : content.w;

  const coordFrom = (p: Point): number => {
    const c = props.clientToContent(p.clientX ?? 0, p.clientY ?? 0);
    const raw = horizontal ? c.y / content.h : c.x / content.w;
    return snap(raw, snapCandidates(layout, d.direction, d.splitId), SNAP_PX / along).value;
  };

  useGestures(ref, {
    onTap: () => props.onSelect(d.splitId),
    onDragStart: () => props.onSelect(d.splitId),
    onDragMove: (p) => props.onPreview(d.splitId, coordFrom(p)),
    onDragEnd: () => props.onEndGesture(),
    onCancel: () => props.onCancelGesture(),
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const back = horizontal ? 'ArrowUp' : 'ArrowLeft';
    const fwd = horizontal ? 'ArrowDown' : 'ArrowRight';
    if (e.key === back || e.key === fwd) {
      e.preventDefault();
      props.onCommit(d.splitId, d.coord + (e.key === fwd ? step : -step));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Handled here; keep the editor's window-level Delete handler from removing it a second time.
      e.preventDefault();
      e.stopPropagation();
      props.onRemove(d.splitId);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      props.onSelect(d.splitId);
    }
  };

  const [s0, s1] = d.span;
  const style = horizontal
    ? { left: xPx(s0), top: yPx(d.coord), width: xPx(s1) - xPx(s0) }
    : { left: xPx(d.coord), top: yPx(s0), height: yPx(s1) - yPx(s0) };
  const mid = horizontal ? { left: (xPx(s0) + xPx(s1)) / 2, top: yPx(d.coord) } : { left: xPx(d.coord), top: (yPx(s0) + yPx(s1)) / 2 };

  return (
    <>
      <div
        ref={ref}
        {...{ [NO_GESTURE_ATTR]: '' }}
        className={`${styles.hit} ${horizontal ? styles.horizontal : styles.vertical} ${selected ? styles.selected : ''}`}
        style={style}
        role="separator"
        aria-orientation={d.direction}
        aria-valuenow={Math.round(d.coord * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Divider"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <span className={styles.line} aria-hidden="true" />
      </div>
      {selected && <RemoveHandle left={mid.left} top={mid.top} onRemove={() => props.onRemove(d.splitId)} />}
    </>
  );
}

/** The round × button shown on a selected divider (straight or freehand). */
export function RemoveHandle({ left, top, onRemove }: { left: number; top: number; onRemove: () => void }) {
  return (
    <button
      type="button"
      {...{ [NO_GESTURE_ATTR]: '' }}
      className={styles.remove}
      style={{ left, top }}
      aria-label="Remove divider"
      onClick={onRemove}
    >
      ×
    </button>
  );
}
