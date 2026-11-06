import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { DEFAULT_SIGNATURE_PLACEMENT, type Doc, type Signature, type Watermark } from '../model/types';
import { downloadSignature } from '../render/exportCanvas';
import { drawSignature } from '../render/renderCollage';
import type { DocAction } from '../state/docReducer';
import { ImageLoadError, loadImage } from '../state/imageStore';
import { SignaturePadDialog } from './SignaturePadDialog';
import { SignatureUploadDialog } from './SignatureUploadDialog';
import styles from './Panel.module.css';

export type MarkTab = 'text' | 'signature';

interface Ops {
  commit: (action: DocAction) => void;
  preview: (action: DocAction) => void;
  endGesture: () => void;
}

interface WatermarkPanelProps extends Ops {
  doc: Doc;
  tab: MarkTab;
  onTab: (tab: MarkTab) => void;
  pushToast: (message: string) => void;
  /** Frees photos no undo step refers to (a cancelled signature upload). */
  releaseUnused: () => void;
}

const TEXT_SWATCHES = ['#FFFFFF', '#111111', '#E53935', '#808080'];
const INK_SWATCHES = ['#111111', '#FFFFFF', '#1E3A8A', '#E53935'];
/** Long side kept for an uploaded signature photo, before the paper is removed (research S5). */
const UPLOAD_SIDE = 2048;

const today = () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date());
const setText = (patch: Partial<Watermark>): DocAction => ({ type: 'setWatermark', patch });
const setSig = (patch: Partial<Omit<Signature, 'picture'>>): DocAction => ({ type: 'setSignature', patch });

/** A slider whose pointer drag is one undo step; keyboard steps commit right away (research C8). */
function Slider(props: { label: string; value: number; min: number; max: number; unit: string; disabled?: boolean; action: (v: number) => DocAction; ops: Ops }) {
  const { label, value, min, max, unit, disabled, action, ops } = props;
  const dragging = useRef(false);
  const endDrag = () => {
    if (dragging.current) ops.endGesture();
    dragging.current = false;
  };
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <output className={styles.fieldValue}>
          {value}
          {unit}
        </output>
      </span>
      <input
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-valuetext={`${value}${unit}`}
        onPointerDown={() => (dragging.current = true)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onChange={(e) => {
          const a = action(Number(e.target.value));
          if (dragging.current) ops.preview(a);
          else ops.commit(a);
        }}
      />
    </label>
  );
}

/** Preset swatches plus a color picker; a picker session is one undo step. */
function ColorRow(props: { id: string; swatches: string[]; value: string; disabled?: boolean; action: (c: string) => DocAction; ops: Ops; extra?: ReactNode }) {
  const { id, swatches, value, disabled, action, ops, extra } = props;
  const ref = useRef<HTMLInputElement>(null);
  const { endGesture } = ops;
  // The color picker fires `input` while choosing and `change` when it closes: preview, then settle.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDone = () => endGesture();
    el.addEventListener('change', onDone);
    return () => el.removeEventListener('change', onDone);
  }, [endGesture]);
  return (
    <div className={styles.section} role="group" aria-labelledby={id}>
      <h3 id={id} className={styles.sectionTitle}>
        Color
      </h3>
      <div className={styles.swatches}>
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            className={styles.swatch}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            aria-pressed={value === c}
            disabled={disabled}
            onClick={() => ops.commit(action(c))}
          />
        ))}
        <input
          ref={ref}
          className={styles.colorInput}
          type="color"
          aria-label="Custom color"
          disabled={disabled}
          value={value.toLowerCase()}
          onChange={(e) => ops.preview(action(e.target.value))}
        />
        {extra}
      </div>
    </div>
  );
}

/** A small picture of the current signature, upright and centered. */
function Thumbnail({ sig }: { sig: Signature }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(160 * dpr);
    c.height = Math.round(60 * dpr);
    // Fill 90% of the box's width or height, whichever limits first (short side of 160×60 is 60).
    const size = Math.min(144, 54 * sig.picture.aspect) / 60;
    drawSignature(g, { ...sig, x: 0.5, y: 0.5, rotation: 0, opacity: 1, size }, { width: 160, height: 60 }, { w: c.width, h: c.height });
  }, [sig]);
  return <canvas ref={ref} className={styles.thumb} style={{ width: 160, height: 60 }} aria-hidden="true" />;
}

/**
 * The user's own marks (features 005, 006): a Text tab (text, Add date, Repeat, size, rotation, opacity,
 * color, Center) and a Signature tab (draw or upload, then size, rotation, opacity, ink and Center).
 * Moving a mark happens on the canvas (MarkLayer); the selected tab decides which one moves.
 */
export function WatermarkPanel({ doc, tab, onTab, pushToast, releaseUnused, ...ops }: WatermarkPanelProps) {
  const { commit, preview, endGesture } = ops;
  const mark = doc.watermark;
  const sig = doc.signature;
  const off = mark.text.trim() === '';
  const [pad, setPad] = useState(false);
  const [upload, setUpload] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same file can be picked again
    if (!file) return;
    try {
      setUpload((await loadImage(file, UPLOAD_SIDE)).id);
    } catch (err) {
      pushToast(err instanceof ImageLoadError ? err.message : new ImageLoadError().message);
      releaseUnused();
    }
  };

  const tabs = (
    <div className={styles.section}>
      <div className={styles.segmented} role="group" aria-label="Mark">
        {(['text', 'signature'] as const).map((t) => (
          <button key={t} type="button" className={styles.segment} aria-pressed={tab === t} onClick={() => onTab(t)}>
            {t === 'text' ? 'Text' : 'Signature'}
          </button>
        ))}
      </div>
    </div>
  );

  if (tab === 'text') {
    return (
      <>
        {tabs}
        <div className={styles.section}>
          <div className={styles.textRow}>
            <input
              className={styles.textInput}
              type="text"
              maxLength={100}
              aria-label="Watermark text"
              placeholder="e.g. For verification by Bank X only"
              value={mark.text}
              onChange={(e) => preview(setText({ text: e.target.value }))}
              onBlur={endGesture}
            />
            <button
              type="button"
              className={styles.textButton}
              onClick={() => commit(setText({ text: off ? today() : `${mark.text} · ${today()}` }))}
            >
              Add date
            </button>
          </div>
          <p className={styles.note}>Drag on the image to move it. Everything stays on your device.</p>
        </div>
        <div className={styles.section}>
          <button
            type="button"
            role="switch"
            aria-checked={mark.repeat}
            aria-describedby="repeat-desc"
            className={styles.switchRow}
            disabled={off}
            onClick={() => commit(setText({ repeat: !mark.repeat }))}
          >
            <span>Repeat</span>
            <span className={styles.switchTrack} aria-hidden="true">
              <span className={styles.switchThumb} />
            </span>
          </button>
          <p id="repeat-desc" className={styles.switchHint}>
            Repeats the text across the whole image so it can’t be cropped out
          </p>
        </div>
        <div className={styles.section}>
          <Slider label="Size" value={Math.round(mark.size * 100)} min={2} max={20} unit="%" disabled={off} action={(v) => setText({ size: v / 100 })} ops={ops} />
          <Slider label="Rotation" value={Math.round(mark.rotation)} min={-90} max={90} unit="°" disabled={off} action={(v) => setText({ rotation: v })} ops={ops} />
          <Slider label="Opacity" value={Math.round(mark.opacity * 100)} min={10} max={100} unit="%" disabled={off} action={(v) => setText({ opacity: v / 100 })} ops={ops} />
        </div>
        <ColorRow
          id="mark-color-title"
          swatches={TEXT_SWATCHES}
          value={mark.color}
          disabled={off}
          action={(c) => setText({ color: c })}
          ops={ops}
          extra={
            <button type="button" className={styles.textButton} disabled={off} onClick={() => commit(setText({ x: 0.5, y: 0.5 }))}>
              Center
            </button>
          }
        />
      </>
    );
  }

  const dialogs = (
    <>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />
      {pad && (
        <SignaturePadDialog
          inkColor={sig?.color ?? DEFAULT_SIGNATURE_PLACEMENT.color}
          onDownloadError={() => pushToast('Couldn’t save the signature')}
          onDone={(picture) => {
            commit({ type: 'setSignaturePicture', picture, keepColors: false });
            setPad(false);
          }}
          onCancel={() => setPad(false)}
        />
      )}
      {upload && (
        <SignatureUploadDialog
          assetId={upload}
          inkColor={sig?.color ?? DEFAULT_SIGNATURE_PLACEMENT.color}
          onDone={(picture, keepColors) => {
            // The source photo is freed by the app once the history includes the new signature.
            commit({ type: 'setSignaturePicture', picture, keepColors });
            setUpload(null);
          }}
          onCancel={() => {
            setUpload(null);
            releaseUnused();
          }}
        />
      )}
    </>
  );

  if (!sig) {
    return (
      <>
        {tabs}
        <div className={styles.section}>
          <button type="button" className={styles.primary} onClick={() => setPad(true)}>
            Draw signature
          </button>
          <button type="button" className={styles.secondaryWide} onClick={() => fileInput.current?.click()}>
            Upload signature
          </button>
          <p className={styles.note}>Stays on your device and is forgotten when you close the page.</p>
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      {tabs}
      <div className={styles.section}>
        <div className={styles.sigRow}>
          <Thumbnail sig={sig} />
          <div className={styles.sigActions}>
            <button type="button" className={styles.textButton} onClick={() => setPad(true)}>
              Redraw
            </button>
            <button type="button" className={styles.textButton} onClick={() => fileInput.current?.click()}>
              Upload
            </button>
            <button type="button" className={styles.textButton} onClick={() => commit({ type: 'removeSignature' })}>
              Remove
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => downloadSignature(sig).catch(() => pushToast('Couldn’t save the signature'))}
            >
              Download
            </button>
          </div>
        </div>
        <p className={styles.note}>Drag on the image to move it. Download saves it alone as a transparent PNG.</p>
      </div>
      <div className={styles.section}>
        <Slider label="Size" value={Math.round(sig.size * 100)} min={10} max={80} unit="%" action={(v) => setSig({ size: v / 100 })} ops={ops} />
        <Slider label="Rotation" value={Math.round(sig.rotation)} min={-90} max={90} unit="°" action={(v) => setSig({ rotation: v })} ops={ops} />
        <Slider label="Opacity" value={Math.round(sig.opacity * 100)} min={10} max={100} unit="%" action={(v) => setSig({ opacity: v / 100 })} ops={ops} />
      </div>
      {sig.keepColors ? (
        <div className={styles.section}>
          <button type="button" className={styles.textButton} onClick={() => commit(setSig({ x: 0.5, y: 0.5 }))}>
            Center
          </button>
        </div>
      ) : (
        <ColorRow
          id="sig-color-title"
          swatches={INK_SWATCHES}
          value={sig.color}
          action={(c) => setSig({ color: c })}
          ops={ops}
          extra={
            <button type="button" className={styles.textButton} onClick={() => commit(setSig({ x: 0.5, y: 0.5 }))}>
              Center
            </button>
          }
        />
      )}
      {dialogs}
    </>
  );
}
