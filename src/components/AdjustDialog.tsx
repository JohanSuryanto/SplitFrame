// The Adjust photo popup: frame a photo inside its cell's exact shape before it goes in (feature 004,
// FR-301 to FR-313). Everything is drawn with placeImage, so it matches the cell, Preview and export.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { effectiveZoom, panBy, placeImage, resetFraming, zoomAt, zoomMin, zoomTo } from '../model/frame';
import { layoutPixels } from '../model/geometry';
import { ZOOM_MAX, type CellImage, type Doc } from '../model/types';
import { useGestures } from '../input/useGestures';
import { getAsset } from '../state/imageStore';
import { ResetIcon } from './icons';
import styles from './AdjustDialog.module.css';

export interface Framing {
  zoom: number;
  focusX: number;
  focusY: number;
}

interface AdjustDialogProps {
  doc: Doc;
  cellId: string;
  assetId: string;
  initial: Framing;
  onDone: (framing: Framing) => void;
  onCancel: () => void;
}

/** Header (title, hint) plus the toolbar, which wraps onto two rows on phones. */
const chromeHeight = () => (window.innerWidth < 768 ? 200 : 150);
/** Space around the frame where the dimmed rest of the photo shows (FR-305). */
const MARGIN = 28;
/** How long the thirds grid lingers after a wheel zoom. */
const WHEEL_IDLE_MS = 500;

function viewport() {
  return { w: Math.floor(Math.min(window.innerWidth * 0.96, 900)), h: Math.floor(window.innerHeight - chromeHeight()) };
}

export function AdjustDialog({ doc, cellId, assetId, initial, onDone, onCancel }: AdjustDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [view, setView] = useState(viewport);
  const [draft, setDraft] = useState<Framing>(initial);
  /** True while dragging or zooming: shows the thirds grid. */
  const [active, setActive] = useState(false);
  /** The hint fades once the user has moved or zoomed. */
  const [touched, setTouched] = useState(false);
  const asset = getAsset(assetId);

  // The cell's true shape at export size; only its proportions matter here.
  const cell = useMemo(
    () => layoutPixels(doc, { w: doc.canvas.width, h: doc.canvas.height }).find((c) => c.cellId === cellId),
    [doc, cellId],
  );

  const frame = useMemo(() => {
    if (!cell) return null;
    const k = Math.max(Math.min((view.w - 2 * MARGIN) / cell.w, (view.h - 2 * MARGIN) / cell.h), 0.01);
    const w = cell.w * k;
    const h = cell.h * k;
    return {
      w,
      h,
      x: (view.w - w) / 2,
      y: (view.h - h) / 2,
      r: cell.r * k,
      polygon: cell.polygon?.map((p) => ({ x: (p.x - cell.x) * k, y: (p.y - cell.y) * k })),
    };
  }, [cell, view]);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    doneRef.current?.focus();
    const onResize = () => setView(viewport());
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(wheelTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !frame || !asset) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(view.w * dpr);
    c.height = Math.round(view.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.imageSmoothingQuality = 'high';

    const box = { w: frame.w, h: frame.h };
    const p = placeImage(box, asset, { assetId, ...draft });
    // 1. The whole photo, dimmed, so the part outside the shape stays visible.
    ctx.globalAlpha = 0.3;
    ctx.drawImage(asset.bitmap, frame.x + p.x0, frame.y + p.y0, asset.width * p.scale, asset.height * p.scale);
    ctx.globalAlpha = 1;
    // 2. The cell shape, filled with the background for any gaps (FR-306), then clipped.
    const path = new Path2D();
    if (frame.polygon) {
      frame.polygon.forEach((pt, i) => (i === 0 ? path.moveTo(frame.x + pt.x, frame.y + pt.y) : path.lineTo(frame.x + pt.x, frame.y + pt.y)));
      path.closePath();
    } else {
      path.roundRect(frame.x, frame.y, frame.w, frame.h, frame.r);
    }
    ctx.save();
    ctx.fillStyle = doc.style.color;
    ctx.fill(path);
    ctx.clip(path);
    // 3. The photo exactly as it will be in the cell.
    const { src, dest } = p;
    ctx.drawImage(asset.bitmap, src.sx, src.sy, src.sw, src.sh, frame.x + dest.x, frame.y + dest.y, dest.w, dest.h);
    // 4. Rule-of-thirds guides while moving or zooming.
    if (active) {
      ctx.beginPath();
      for (const t of [1 / 3, 2 / 3]) {
        ctx.moveTo(frame.x + frame.w * t, frame.y);
        ctx.lineTo(frame.x + frame.w * t, frame.y + frame.h);
        ctx.moveTo(frame.x, frame.y + frame.h * t);
        ctx.lineTo(frame.x + frame.w, frame.y + frame.h * t);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgb(255 255 255 / 0.55)';
      ctx.shadowColor = 'rgb(0 0 0 / 0.35)';
      ctx.shadowBlur = 2;
      ctx.stroke();
    }
    ctx.restore();
    // 5. The outline of the cell.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgb(255 255 255 / 0.85)';
    ctx.stroke(path);
  }, [active, asset, assetId, doc.style.color, draft, frame, view]);

  const box = frame ? { w: frame.w, h: frame.h } : { w: 0, h: 0 };
  const toFrame = (pt: { x: number; y: number }) => ({ x: pt.x - (frame?.x ?? 0), y: pt.y - (frame?.y ?? 0) });
  /**
   * Applies a framing change to the latest draft. Several pointer moves can arrive before a re-render,
   * so each must build on the previous one rather than on this render's draft.
   */
  const update = (change: (current: CellImage) => Framing) => {
    setDraft((d) => {
      const next = change({ assetId, ...d });
      return { zoom: next.zoom, focusX: next.focusX, focusY: next.focusY };
    });
    setTouched(true);
  };
  const center = { x: box.w / 2, y: box.h / 2 };

  useGestures(canvasRef, {
    onDragStart() {
      setActive(true);
    },
    onDragMove(_p, delta) {
      if (asset) update((cur) => panBy(cur, delta.x, delta.y, box, asset));
    },
    onDragEnd() {
      setActive(false);
    },
    onPinch(scale, c) {
      setActive(true);
      if (asset) update((cur) => zoomAt(cur, scale, toFrame(c), box, asset));
    },
    onPinchEnd() {
      setActive(false);
    },
    onWheel(factor, p) {
      setActive(true);
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => setActive(false), WHEEL_IDLE_MS);
      if (asset) update((cur) => zoomAt(cur, factor, toFrame(p), box, asset));
    },
    onDoubleTap() {
      update(resetFraming);
    },
    onCancel() {
      setActive(false);
    },
  });

  if (!asset || !frame) return null;

  const min = zoomMin(box, asset);
  const zoom = effectiveZoom(box, asset, draft.zoom);
  const logMin = Math.log(min);
  const logMax = Math.log(ZOOM_MAX);
  const fillAt = logMax > logMin ? ((0 - logMin) / (logMax - logMin)) * 100 : 0;
  const atFit = Math.abs(zoom - min) < 1e-9;
  const valueText = zoom === 1 ? 'fill' : atFit ? 'fit' : `${Math.round(zoom * 100)}%`;
  /** 100% = the photo just fills the cell. */
  const percent = `${Math.round(zoom * 100)}%`;

  const step = (factor: number) => update((cur) => zoomAt(cur, factor, center, box, asset));
  const setZoom = (z: number) => update((cur) => zoomTo(cur, z, box, asset));
  const reset = () => update(resetFraming);

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    // Keep the app's shortcuts (undo, D for Draw, Delete…) from acting on the collage behind the popup.
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const onSlider = target instanceof HTMLInputElement;
    const onButton = target instanceof HTMLButtonElement;
    const nudge = (e.shiftKey ? 0.1 : 0.02) * Math.min(box.w, box.h);
    const pan = (dx: number, dy: number) => {
      e.preventDefault();
      update((cur) => panBy(cur, dx, dy, box, asset));
    };
    // Arrows move the photo in their direction, like dragging it.
    if (!onSlider && e.key === 'ArrowLeft') pan(-nudge, 0);
    else if (!onSlider && e.key === 'ArrowRight') pan(nudge, 0);
    else if (!onSlider && e.key === 'ArrowUp') pan(0, -nudge);
    else if (!onSlider && e.key === 'ArrowDown') pan(0, nudge);
    else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      step(1.25);
    } else if (e.key === '-') {
      e.preventDefault();
      step(0.8);
    } else if (e.key === '0') {
      e.preventDefault();
      reset();
    } else if (e.key === 'Enter' && !onButton) {
      e.preventDefault();
      onDone(draft);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="adjust-title"
      aria-describedby="adjust-hint"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div className={styles.body}>
        <header className={styles.header}>
          <button type="button" className={styles.textButton} onClick={onCancel}>
            Cancel
          </button>
          <div className={styles.titleBlock}>
            <h2 id="adjust-title" className={styles.title}>
              Adjust photo
            </h2>
            <p id="adjust-hint" className={`${styles.hint} ${touched ? styles.hintHidden : ''}`}>
              Drag to move · pinch or scroll to zoom
            </p>
          </div>
          <button ref={doneRef} type="button" className={styles.done} onClick={() => onDone(draft)}>
            Done
          </button>
        </header>
        <canvas ref={canvasRef} className={styles.frame} style={{ width: view.w, height: view.h }} aria-hidden="true" />
        <div className={styles.toolbar} role="group" aria-label="Zoom">
          <button type="button" className={styles.icon} aria-label="Reset" title="Reset (0)" onClick={reset}>
            <ResetIcon />
          </button>
          <button type="button" className={styles.chip} aria-pressed={atFit} onClick={() => setZoom(min)}>
            Fit
          </button>
          <div className={styles.zoom}>
            <button type="button" className={styles.step} aria-label="Zoom out" onClick={() => step(0.8)}>
              −
            </button>
            <div className={styles.track} style={{ ['--fill' as string]: `${fillAt}%` }}>
              <input
                className={styles.slider}
                type="range"
                aria-label="Zoom"
                aria-valuetext={valueText}
                min={logMin}
                max={logMax}
                step={0.01}
                value={Math.log(zoom)}
                onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
              />
              <span className={styles.fillMark} aria-hidden="true" />
            </div>
            <button type="button" className={styles.step} aria-label="Zoom in" onClick={() => step(1.25)}>
              +
            </button>
          </div>
          <button type="button" className={styles.chip} aria-pressed={zoom === 1} onClick={() => setZoom(1)}>
            Fill
          </button>
          <output className={styles.percent} aria-live="off">
            {percent}
          </output>
        </div>
      </div>
    </dialog>
  );
}
