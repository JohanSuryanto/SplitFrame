// Pointer-Events gesture recognizer: tap, double tap, drag, pinch and wheel.
// Works the same with mouse, touch and pen (FR-039).
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export interface Point {
  /** Position relative to the element's top-left corner, in CSS px. */
  x: number;
  y: number;
  /** Viewport position, for elements that move while they are dragged. */
  clientX?: number;
  clientY?: number;
}

export interface GestureCallbacks {
  onTap?(p: Point): void;
  onDoubleTap?(p: Point): void;
  onDragStart?(p: Point): void;
  onDragMove?(p: Point, delta: Point, total: Point): void;
  onDragEnd?(p: Point): void;
  onPinch?(scale: number, center: Point): void;
  onPinchEnd?(): void;
  onWheel?(factor: number, p: Point): void;
  onCancel?(): void;
}

export interface GestureOptions {
  enabled?: boolean;
  /** Stop pointerdown from reaching parent elements (used by dividers). */
  stopPropagation?: boolean;
}

/** Elements marked with this attribute handle their own pointer input; ancestors ignore it. */
export const NO_GESTURE_ATTR = 'data-no-gesture';

export const TAP_SLOP = 6;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 10;

type Phase = 'idle' | 'pending' | 'drag' | 'pinch' | 'done';

export function useGestures<T extends HTMLElement>(
  ref: RefObject<T | null>,
  callbacks: GestureCallbacks,
  options: GestureOptions = {},
): void {
  const cb = useRef(callbacks);
  useLayoutEffect(() => {
    cb.current = callbacks;
  });
  const { enabled = true, stopPropagation = false } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const pointers = new Map<number, Point>();
    let phase: Phase = 'idle';
    let start: Point = { x: 0, y: 0 };
    let last: Point = { x: 0, y: 0 };
    let pending: Point | null = null;
    let raf = 0;
    let pinchDist = 0;
    let lastTap: { t: number; p: Point } | null = null;

    const local = (e: { clientX: number; clientY: number }): Point => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, clientX: e.clientX, clientY: e.clientY };
    };
    const twoPoints = () => [...pointers.values()] as [Point, Point];
    const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const flush = () => {
      raf = 0;
      if (phase === 'drag' && pending) {
        const p = pending;
        pending = null;
        cb.current.onDragMove?.(p, { x: p.x - last.x, y: p.y - last.y }, { x: p.x - start.x, y: p.y - start.y });
        last = p;
      } else if (phase === 'pinch' && pointers.size >= 2) {
        const [a, b] = twoPoints();
        const d = dist(a, b);
        if (pinchDist > 0 && d > 0) cb.current.onPinch?.(d / pinchDist, mid(a, b));
        pinchDist = d;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(flush);
    };

    const endDrag = (p: Point) => {
      // Deliver the last movement before ending, whether or not a frame was scheduled.
      if (raf) cancelAnimationFrame(raf);
      flush();
      cb.current.onDragEnd?.(p);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const owner = (e.target as Element | null)?.closest?.(`[${NO_GESTURE_ATTR}]`);
      if (owner && owner !== el) return;
      if (stopPropagation) e.stopPropagation();
      const p = local(e);
      pointers.set(e.pointerId, p);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture can fail for synthetic events */
      }

      if (pointers.size === 1) {
        phase = 'pending';
        start = last = p;
      } else if (pointers.size === 2 && cb.current.onPinch && phase !== 'done') {
        if (phase === 'drag') endDrag(last);
        phase = 'pinch';
        const [a, b] = twoPoints();
        pinchDist = dist(a, b);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (phase === 'pending' && dist(p, start) >= TAP_SLOP) {
        phase = 'drag';
        cb.current.onDragStart?.(start);
      }
      if (phase === 'drag') {
        pending = p;
        schedule();
      } else if (phase === 'pinch') {
        schedule();
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const p = local(e);
      pointers.delete(e.pointerId);

      if (phase === 'pending' && pointers.size === 0) {
        const now = performance.now();
        if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && dist(p, lastTap.p) < DOUBLE_TAP_SLOP && cb.current.onDoubleTap) {
          lastTap = null;
          cb.current.onDoubleTap(p);
        } else {
          lastTap = { t: now, p };
          cb.current.onTap?.(p);
        }
      } else if (phase === 'drag') {
        pending = p;
        endDrag(p);
        phase = pointers.size ? 'done' : 'idle';
      } else if (phase === 'pinch' && pointers.size < 2) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        cb.current.onPinchEnd?.();
        phase = 'done';
      }
      if (pointers.size === 0) phase = 'idle';
    };

    const onCancelPointer = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (phase === 'drag' || phase === 'pinch') cb.current.onCancel?.();
      phase = pointers.size ? 'done' : 'idle';
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (phase !== 'drag' && phase !== 'pinch')) return;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      pending = null;
      phase = 'done';
      cb.current.onCancel?.();
    };

    const onWheel = (e: WheelEvent) => {
      if (!cb.current.onWheel) return;
      e.preventDefault();
      cb.current.onWheel(Math.exp(-e.deltaY * 0.0015), local(e));
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancelPointer);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancelPointer);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [ref, enabled, stopPropagation]);
}
