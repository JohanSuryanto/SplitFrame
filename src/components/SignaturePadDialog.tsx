// The signature pad (feature 006, FR-603 to FR-606, research S9). Strokes stay local until Done, so
// they never enter the undo history; Done hands back a normalized picture.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { normalizeStrokes } from '../model/signature';
import { smoothStroke } from '../model/stroke';
import { DEFAULT_SIGNATURE_PLACEMENT, type Pt, type SignaturePicture } from '../model/types';
import { downloadSignature } from '../render/exportCanvas';
import { traceStroke } from '../render/renderCollage';
import styles from './SignatureDialog.module.css';

interface SignaturePadDialogProps {
  /** Ink for a downloaded PNG: the current signature's color, or the default. */
  inkColor: string;
  onDone: (picture: Extract<SignaturePicture, { kind: 'strokes' }>) => void;
  onCancel: () => void;
  onDownloadError: () => void;
}

const INK = '#111111';

/** Phones: full width at 2:1, at most 60% of the screen height. Desktop: up to 720 px wide at 3:1. */
function padSize() {
  const phone = window.innerWidth < 768;
  const w = Math.floor(phone ? window.innerWidth - 62 : Math.min(720, window.innerWidth * 0.9));
  const h = Math.floor(phone ? Math.min(w / 2, window.innerHeight * 0.6) : w / 3);
  return { w, h };
}

const penFor = (h: number) => Math.max(2.5, h * 0.018);

export function SignaturePadDialog({ inkColor, onDone, onCancel, onDownloadError }: SignaturePadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(padSize);
  /** Finished strokes, in pad-width units so a resize or rotation just rescales them. */
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const live = useRef<{ id: number; pts: Pt[] } | null>(null);
  const downOnBackdrop = useRef(false);
  const pen = penFor(size.h);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    const onResize = () => setSize(padSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const ctx = useCallback(() => {
    const c = canvasRef.current?.getContext('2d');
    if (!c) return null;
    c.lineWidth = pen;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = INK;
    c.fillStyle = INK;
    return c;
  }, [pen]);

  const toPx = useCallback((pts: Pt[]) => pts.map((p) => ({ x: p.x * size.w, y: p.y * size.w })), [size.w]);

  // Full redraw: guides, then every finished stroke. Guides are only on screen, never in the signature.
  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = size.h * 0.75;
    g.strokeStyle = '#d4d4d8';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(size.w * 0.08, base);
    g.lineTo(size.w * 0.92, base);
    g.stroke();
    g.fillStyle = '#a1a1aa';
    g.font = '16px ui-sans-serif, system-ui, sans-serif';
    g.textBaseline = 'alphabetic';
    g.fillText('×', size.w * 0.08, base - 6);
    if (strokes.length === 0) {
      g.textAlign = 'center';
      g.fillText('Sign here', size.w / 2, size.h * 0.45);
    }
    const ink = ctx();
    if (ink) for (const s of strokes) traceStroke(ink, toPx(s));
  }, [size, strokes, ctx, toPx]);

  useLayoutEffect(redraw, [redraw]);

  const point = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / size.w, y: (e.clientY - r.top) / size.w };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (live.current || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    live.current = { id: e.pointerId, pts: [p] };
    const ink = ctx();
    if (ink) traceStroke(ink, toPx([p]));
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    const ink = ctx();
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const prev = l.pts[l.pts.length - 1]!;
      const p = point(ev);
      l.pts.push(p);
      if (ink) {
        // Draw the new bit straight away, so the line keeps up with the finger (SC-605).
        ink.beginPath();
        ink.moveTo(prev.x * size.w, prev.y * size.w);
        ink.lineTo(p.x * size.w, p.y * size.w);
        ink.stroke();
      }
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    live.current = null;
    // Smooth out hand jitter, then redraw everything as curves.
    const smooth = smoothStroke(toPx(l.pts)).map((p) => ({ x: p.x / size.w, y: p.y / size.w }));
    setStrokes((s) => [...s, smooth]);
  };

  const done = () => {
    if (strokes.length > 0) onDone(normalizeStrokes(strokes.map(toPx), pen));
  };

  // Save just this drawing as a transparent PNG, without placing it on the image.
  const download = () => {
    if (strokes.length === 0) return;
    const picture = normalizeStrokes(strokes.map(toPx), pen);
    downloadSignature({ ...DEFAULT_SIGNATURE_PLACEMENT, color: inkColor, picture }).catch(onDownloadError);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    // Handle Escape here so it doesn't also close the Watermark sheet behind the dialog.
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };

  const empty = strokes.length === 0;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="pad-title"
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onPointerDown={(e) => (downOnBackdrop.current = e.target === dialogRef.current)}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === dialogRef.current) onCancel();
      }}
    >
      <h2 id="pad-title" className={styles.title}>
        Draw your signature
      </h2>
      <canvas
        ref={canvasRef}
        className={styles.pad}
        style={{ width: size.w, height: size.h }}
        role="img"
        aria-label="Signature pad. Draw with your finger, mouse or pen."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={empty} onClick={() => setStrokes((s) => s.slice(0, -1))}>
          Undo stroke
        </button>
        <button type="button" className={styles.secondary} disabled={empty} onClick={() => setStrokes([])}>
          Clear
        </button>
        <button type="button" className={styles.secondary} disabled={empty} onClick={download}>
          Download
        </button>
        <span className={styles.spacer} />
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.primary} disabled={empty} onClick={done}>
          Done
        </button>
      </div>
    </dialog>
  );
}
