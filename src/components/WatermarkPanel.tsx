import { useEffect, useRef } from 'react';
import type { Doc, Watermark } from '../model/types';
import type { DocAction } from '../state/docReducer';
import styles from './Panel.module.css';

interface WatermarkPanelProps {
  doc: Doc;
  commit: (action: DocAction) => void;
  preview: (action: DocAction) => void;
  endGesture: () => void;
}

const SWATCHES = ['#FFFFFF', '#111111', '#E53935', '#808080'];

const today = () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date());
const set = (patch: Partial<Watermark>): DocAction => ({ type: 'setWatermark', patch });

/**
 * The user's own text watermark (feature 005): text, Add date, Repeat, size, rotation, opacity, color
 * and Center. Typing, a slider drag or a color pick is one undo step each (research C8); moving the
 * mark itself happens on the canvas (MarkLayer).
 */
export function WatermarkPanel({ doc, commit, preview, endGesture }: WatermarkPanelProps) {
  const mark = doc.watermark;
  const off = mark.text.trim() === '';
  const dragging = useRef(false);
  const colorRef = useRef<HTMLInputElement>(null);

  // Pointer drags preview and end the gesture on release; keyboard changes commit right away.
  const change = (patch: Partial<Watermark>) => (dragging.current ? preview(set(patch)) : commit(set(patch)));
  const endDrag = () => {
    if (dragging.current) endGesture();
    dragging.current = false;
  };

  // The color picker fires `input` while choosing and `change` when it closes: preview, then settle.
  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const onDone = () => endGesture();
    el.addEventListener('change', onDone);
    return () => el.removeEventListener('change', onDone);
  }, [endGesture]);

  const slider = (label: string, value: number, min: number, max: number, unit: string, toPatch: (v: number) => Partial<Watermark>) => (
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
        disabled={off}
        aria-valuetext={`${value}${unit}`}
        onPointerDown={() => (dragging.current = true)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onChange={(e) => change(toPatch(Number(e.target.value)))}
      />
    </label>
  );

  return (
    <>
      <div className={styles.section}>
        <div className={styles.textRow}>
          <input
            className={styles.textInput}
            type="text"
            maxLength={100}
            aria-label="Watermark text"
            placeholder="e.g. For verification by Bank X only"
            value={mark.text}
            onChange={(e) => preview(set({ text: e.target.value }))}
            onBlur={endGesture}
          />
          <button
            type="button"
            className={styles.textButton}
            onClick={() => commit(set({ text: off ? today() : `${mark.text} · ${today()}` }))}
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
          onClick={() => commit(set({ repeat: !mark.repeat }))}
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
        {slider('Size', Math.round(mark.size * 100), 2, 20, '%', (v) => ({ size: v / 100 }))}
        {slider('Rotation', Math.round(mark.rotation), -90, 90, '°', (v) => ({ rotation: v }))}
        {slider('Opacity', Math.round(mark.opacity * 100), 10, 100, '%', (v) => ({ opacity: v / 100 }))}
      </div>
      <div className={styles.section} role="group" aria-labelledby="mark-color-title">
        <h3 id="mark-color-title" className={styles.sectionTitle}>
          Color
        </h3>
        <div className={styles.swatches}>
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.swatch}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              aria-pressed={mark.color === c}
              disabled={off}
              onClick={() => commit(set({ color: c }))}
            />
          ))}
          <input
            ref={colorRef}
            className={styles.colorInput}
            type="color"
            aria-label="Custom color"
            disabled={off}
            value={mark.color.toLowerCase()}
            onChange={(e) => preview(set({ color: e.target.value }))}
          />
          <button type="button" className={styles.textButton} disabled={off} onClick={() => commit(set({ x: 0.5, y: 0.5 }))}>
            Center
          </button>
        </div>
      </div>
    </>
  );
}
