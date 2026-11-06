// Use a photo of a pen signature (feature 006, FR-607 to FR-612, research S5, S6, S10). The paper is
// removed on a small copy so the Sensitivity slider stays live; Done redoes it once at full size.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { SignaturePicture } from '../model/types';
import { removeBackground, type Rgba } from '../render/removeBackground';
import { addAssetFromCanvas, dropHeld, getAsset, holdAsset, makeCanvas } from '../state/imageStore';
import panel from './Panel.module.css';
import styles from './SignatureDialog.module.css';

interface SignatureUploadDialogProps {
  /** The picked photo, already loaded into the image store. */
  assetId: string;
  /** Ink color for the preview while Keep original colors is off. */
  inkColor: string;
  onDone: (picture: Extract<SignaturePicture, { kind: 'image' }>, keepColors: boolean) => void;
  onCancel: () => void;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const PREVIEW_SIDE = 512;
const FINAL_SIDE = 2048;

/** The asset's pixels at a long side of at most maxSide. */
function pixels(bitmap: ImageBitmap, maxSide: number): Rgba | null {
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const c = makeCanvas(w, h);
  const g = c.getContext('2d') as Ctx2D | null;
  if (!g) return null;
  g.drawImage(bitmap, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  return { data: d.data, width: w, height: h };
}

/** The cleaned pixels as a canvas cropped to the ink box. */
function cropped(src: Rgba, data: Uint8ClampedArray, box: { x: number; y: number; w: number; h: number }) {
  const full = makeCanvas(src.width, src.height);
  const fg = full.getContext('2d') as Ctx2D | null;
  const out = makeCanvas(box.w, box.h);
  const og = out.getContext('2d') as Ctx2D | null;
  if (!fg || !og) return null;
  fg.putImageData(new ImageData(new Uint8ClampedArray(data), src.width, src.height), 0, 0);
  og.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out;
}

export function SignatureUploadDialog({ assetId, inkColor, onDone, onCancel: cancelled }: SignatureUploadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const downOnBackdrop = useRef(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [keepColors, setKeepColors] = useState(false);
  const [busy, setBusy] = useState(false);
  const asset = getAsset(assetId);

  // Let go of the source photo before reporting back, so whoever frees memory next can release it.
  const onCancel = () => {
    dropHeld(assetId);
    cancelled();
  };

  useEffect(() => {
    holdAsset(assetId);
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => dropHeld(assetId);
  }, [assetId]);

  const source = useMemo(() => (asset ? pixels(asset.bitmap, PREVIEW_SIDE) : null), [asset]);
  const result = useMemo(() => (source ? removeBackground(source, sensitivity) : null), [source, sensitivity]);
  const box = result?.box ?? null;

  // Draw the cropped result, fitted into the preview area, recolored unless Keep original colors is on.
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c || !source || !result || !box) return;
    const crop = cropped(source, result.data, box);
    if (!crop) return;
    const maxW = Math.min(640, window.innerWidth - 62);
    const k = Math.min(maxW / box.w, 220 / box.h);
    const w = Math.max(1, Math.round(box.w * k));
    const h = Math.max(1, Math.round(box.h * k));
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const g = c.getContext('2d');
    if (!g) return;
    g.drawImage(crop, 0, 0, c.width, c.height);
    if (!keepColors) {
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = inkColor;
      g.fillRect(0, 0, c.width, c.height);
    }
  }, [source, result, box, keepColors, inkColor]);

  const done = async () => {
    if (!asset || !box || busy) return;
    setBusy(true);
    try {
      const full = pixels(asset.bitmap, FINAL_SIDE);
      const cleaned = full && removeBackground(full, sensitivity);
      const crop = full && cleaned?.box && cropped(full, cleaned.data, cleaned.box);
      if (!crop || !cleaned?.box) return;
      const stored = await addAssetFromCanvas(crop);
      dropHeld(assetId);
      onDone({ kind: 'image', assetId: stored.id, aspect: cleaned.box.w / cleaned.box.h }, keepColors);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    // Handle Escape here so it doesn't also close the Watermark sheet behind the dialog.
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="upload-title"
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
      <h2 id="upload-title" className={styles.title}>
        Use a photo of your signature
      </h2>
      {box ? (
        <canvas ref={canvasRef} className={styles.preview} role="img" aria-label="Your signature with the paper removed" />
      ) : (
        <p className={styles.message} role="status">
          No signature found — try a higher sensitivity or a clearer photo
        </p>
      )}
      <div className={styles.controls}>
        <label className={panel.field}>
          <span className={panel.fieldLabel}>
            Sensitivity
            <output className={panel.fieldValue}>{sensitivity}</output>
          </span>
          <input
            className={panel.range}
            type="range"
            min={0}
            max={100}
            step={1}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
          />
        </label>
        <div className={panel.section}>
          <button
            type="button"
            role="switch"
            aria-checked={keepColors}
            aria-describedby="keep-colors-desc"
            className={panel.switchRow}
            onClick={() => setKeepColors((v) => !v)}
          >
            <span>Keep original colors</span>
            <span className={panel.switchTrack} aria-hidden="true">
              <span className={panel.switchThumb} />
            </span>
          </button>
          <p id="keep-colors-desc" className={panel.switchHint}>
            On for a logo; off to recolor the ink.
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.primary} disabled={!box || busy} onClick={done}>
          {busy ? 'Working…' : 'Done'}
        </button>
      </div>
    </dialog>
  );
}
