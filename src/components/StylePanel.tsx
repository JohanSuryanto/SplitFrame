import { useEffect, useMemo, useRef } from 'react';
import { styleLimits } from '../model/geometry';
import { STYLE_RANGES, type Doc, type Style } from '../model/types';
import type { DocAction } from '../state/docReducer';
import styles from './Panel.module.css';

interface StylePanelProps {
  doc: Doc;
  commit: (action: DocAction) => void;
  preview: (action: DocAction) => void;
  endGesture: () => void;
}

type NumericKey = 'gap' | 'radius' | 'padding';

const SWATCHES = ['#FFFFFF', '#F4EFE6', '#111111', '#E9E4F5', '#DCEBE4'];

/** Gap, corner radius, padding and color (FR-029). One slider drag is one undo step (FR-037). */
export function StylePanel({ doc, commit, preview, endGesture }: StylePanelProps) {
  const dragging = useRef(false);
  const colorRef = useRef<HTMLInputElement>(null);
  const { maxGap, maxPadding } = useMemo(() => styleLimits(doc), [doc]);

  // Pointer drags preview and end the gesture on release; keyboard changes commit right away.
  const change = (patch: Partial<Style>) => {
    const action: DocAction = { type: 'setStyle', patch };
    if (dragging.current) preview(action);
    else commit(action);
  };

  // The color picker fires `input` while choosing and `change` when it closes: preview, then settle.
  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const onDone = () => endGesture();
    el.addEventListener('change', onDone);
    return () => el.removeEventListener('change', onDone);
  }, [endGesture]);

  const endDrag = () => {
    if (dragging.current) endGesture();
    dragging.current = false;
  };

  const slider = (key: NumericKey, label: string, max: number) => (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <output className={styles.fieldValue}>{doc.style[key]}</output>
      </span>
      <input
        className={styles.range}
        type="range"
        min={STYLE_RANGES[key][0]}
        max={max}
        step={1}
        value={Math.min(doc.style[key], max)}
        onPointerDown={() => (dragging.current = true)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onChange={(e) => change({ [key]: Number(e.target.value) })}
      />
    </label>
  );

  const color = doc.style.color.toUpperCase();

  return (
    <>
      <div className={styles.section}>
        {slider('gap', 'Gap', maxGap)}
        {slider('radius', 'Corners', STYLE_RANGES.radius[1])}
        {slider('padding', 'Border', maxPadding)}
      </div>
      <div className={styles.section} role="group" aria-labelledby="color-title">
        <h3 id="color-title" className={styles.sectionTitle}>
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
              aria-pressed={color === c}
              onClick={() => commit({ type: 'setStyle', patch: { color: c } })}
            />
          ))}
          <input
            ref={colorRef}
            className={styles.colorInput}
            type="color"
            aria-label="Custom color"
            value={doc.style.color.toLowerCase()}
            onChange={(e) => preview({ type: 'setStyle', patch: { color: e.target.value } })}
          />
        </div>
      </div>
    </>
  );
}
