import { useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { Signature, Size, Watermark } from '../model/types';
import { drawSignature, drawTextMark, drawWatermark } from '../render/renderCollage';
import type { DocAction } from '../state/docReducer';
import { SHEET_IGNORE_ATTR } from './Sheet';
import styles from './MarkLayer.module.css';

/** Which mark a drag or arrow key moves; null = the layer ignores input. */
export type MarkTarget = 'text' | 'signature' | null;

interface MarkLayerProps {
  canvas: { width: number; height: number };
  size: Size;
  /** The user's watermark: always drawn when it has text (feature 005, FR-511). */
  mark: Watermark;
  /** The user's signature: always drawn when present (feature 006, FR-616). */
  signature: Signature | null;
  /** The SplitFrame credit: only while the Export panel is open and it is on (003 FR-215). */
  showCredit: boolean;
  /** Watermark panel open on a tab whose mark exists: drag anywhere or use arrow keys to move it. */
  target: MarkTarget;
  commit: (action: DocAction) => void;
  preview: (action: DocAction) => void;
  endGesture: () => void;
  cancelGesture: () => void;
}

const LABELS = {
  text: 'Watermark position. Drag or use arrow keys to move.',
  signature: 'Signature position. Drag or use arrow keys to move.',
};

/**
 * The marks drawn over the editing canvas exactly where they will be in the file. Ignores input and is
 * hidden from screen readers unless a mark is targeted; then a drag moves it by the pointer's delta, so
 * it works on small, rotated or tiled marks alike. One drag is one undo step.
 */
export function MarkLayer({ canvas, size, mark, signature, showCredit, target, ...history }: MarkLayerProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; cx: number; cy: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || size.w <= 0 || size.h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const backing = { w: Math.round(size.w * dpr), h: Math.round(size.h * dpr) };
    c.width = backing.w; // also clears
    c.height = backing.h;
    drawTextMark(ctx, mark, canvas, backing);
    drawSignature(ctx, signature, canvas, backing);
    if (showCredit) drawWatermark(ctx, canvas, backing);
  }, [canvas, mark, signature, showCredit, size.w, size.h]);

  const current = target === 'signature' ? signature : mark;
  const move = (x: number, y: number): DocAction =>
    target === 'signature' ? { type: 'setSignature', patch: { x, y } } : { type: 'setWatermark', patch: { x, y } };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current || e.button !== 0 || !current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: current.x, y: current.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    history.preview(move(d.x + (e.clientX - d.cx) / size.w, d.y + (e.clientY - d.cy) / size.h));
  };
  const finish = (e: PointerEvent<HTMLDivElement>, cancel: boolean) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    if (cancel) history.cancelGesture();
    else history.endGesture();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d || !current) return;
    e.preventDefault();
    history.commit(move(current.x + d[0]!, current.y + d[1]!));
  };

  const canvasEl = <canvas ref={ref} className={styles.canvas} style={{ width: size.w, height: size.h }} />;
  if (!target || !current) {
    return (
      <div className={styles.layer} aria-hidden="true">
        {canvasEl}
      </div>
    );
  }
  return (
    <div
      className={`${styles.layer} ${styles.interactive}`}
      tabIndex={0}
      role="group"
      aria-label={LABELS[target]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onKeyDown={onKeyDown}
      {...{ [SHEET_IGNORE_ATTR]: '' }}
    >
      {canvasEl}
    </div>
  );
}
