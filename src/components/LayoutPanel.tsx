import { useState, type FormEvent } from 'react';
import { minSizeNorm } from '../model/geometry';
import { cellsInReadingOrder, computeRects, countCells, referencedAssets } from '../model/layout';
import { applyPreset, buildPreset, CANVAS_PRESETS, LAYOUT_PRESETS, type LayoutPresetKind } from '../model/presets';
import { CUSTOM_SIZE_RANGE, type CanvasPreset, type Doc } from '../model/types';
import { fillEmptyWithSamples } from '../samples/actions';
import { isValidCustomSize, type DocAction } from '../state/docReducer';
import { getAsset, maxSideFor } from '../state/imageStore';
import styles from './Panel.module.css';

type AspectPreset = Exclude<CanvasPreset, 'custom'>;
const ASPECTS = Object.keys(CANVAS_PRESETS) as AspectPreset[];

interface LayoutPanelProps {
  doc: Doc;
  commit: (action: DocAction) => void;
  undo: () => void;
  pushToast: (message: string, action?: { label: string; run: () => void }) => void;
}

/** True when some cell is smaller than the minimum cell size (possible after a canvas change). */
function hasUndersizedCells(doc: Doc): boolean {
  const min = minSizeNorm(doc.canvas, doc.style);
  for (const r of computeRects(doc.layout).values()) {
    if (r.w < min.x - 1e-9 || r.h < min.y - 1e-9) return true;
  }
  return false;
}

function PresetIcon({ kind }: { kind: LayoutPresetKind }) {
  const rects = [...computeRects(buildPreset(kind)).values()];
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={2 + r.x * 20 + 0.75} y={2 + r.y * 20 + 0.75} width={r.w * 20 - 1.5} height={r.h * 20 - 1.5} rx="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

function AspectShape({ w, h }: { w: number; h: number }) {
  const k = 14 / Math.max(w, h);
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x={8 - (w * k) / 2} y={8 - (h * k) / 2} width={w * k} height={h * k} rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Canvas shape (FR-004), grid presets (FR-008) and Clear (FR-014). */
export function LayoutPanel({ doc, commit, undo, pushToast }: LayoutPanelProps) {
  const [customOpen, setCustomOpen] = useState(doc.canvas.preset === 'custom');
  const [customW, setCustomW] = useState(String(doc.canvas.width));
  const [customH, setCustomH] = useState(String(doc.canvas.height));
  const [customError, setCustomError] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const emptyCells = cellsInReadingOrder(doc.layout).filter((c) => !c.image).length;

  const warnIfSoft = (width: number, height: number) => {
    const needed = maxSideFor({ width, height });
    const soft = [...referencedAssets(doc.layout)].some((id) => {
      const limit = getAsset(id)?.downscaledTo;
      return limit !== undefined && limit < needed;
    });
    if (soft) pushToast('Re-add photos for full sharpness at this size.');
  };

  const applyCustom = (e: FormEvent) => {
    e.preventDefault();
    const width = Number(customW);
    const height = Number(customH);
    if (!isValidCustomSize(width, height)) {
      setCustomError(`Enter whole numbers from ${CUSTOM_SIZE_RANGE[0]} to ${CUSTOM_SIZE_RANGE[1]}`);
      return;
    }
    setCustomError(null);
    commit({ type: 'setCustomSize', width, height });
    warnIfSoft(width, height);
  };

  const choosePreset = (kind: LayoutPresetKind, label: string) => {
    const { droppedImages } = applyPreset(doc.layout, kind);
    commit({ type: 'applyPreset', kind });
    if (droppedImages > 0) {
      const noun = droppedImages === 1 ? 'photo' : 'photos';
      pushToast(`${droppedImages} ${noun} didn't fit the ${label} layout`, { label: 'Undo', run: undo });
    }
  };

  return (
    <>
      <div className={styles.section} role="group" aria-labelledby="canvas-title">
        <h3 id="canvas-title" className={styles.sectionTitle}>
          Canvas
        </h3>
        <div className={styles.chips}>
          {ASPECTS.map((a) => {
            const [w, h] = CANVAS_PRESETS[a];
            return (
              <button
                key={a}
                type="button"
                className={styles.chip}
                aria-pressed={doc.canvas.preset === a}
                aria-label={`${a}${a === '9:16' ? ' Story' : ''}, ${w} by ${h} pixels`}
                onClick={() => {
                  setCustomOpen(false);
                  commit({ type: 'setCanvasPreset', preset: a });
                  warnIfSoft(w, h);
                }}
              >
                <AspectShape w={w} h={h} />
                {a}
              </button>
            );
          })}
          <button
            type="button"
            className={styles.chip}
            aria-pressed={doc.canvas.preset === 'custom'}
            aria-expanded={customOpen}
            onClick={() => {
              setCustomW(String(doc.canvas.width));
              setCustomH(String(doc.canvas.height));
              setCustomError(null);
              setCustomOpen((o) => !o);
            }}
          >
            Custom
          </button>
        </div>
        {customOpen && (
          <form onSubmit={applyCustom} noValidate>
            <div className={styles.row}>
              <label>
                <span className={styles.visuallyHidden}>Width in pixels</span>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  min={CUSTOM_SIZE_RANGE[0]}
                  max={CUSTOM_SIZE_RANGE[1]}
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  aria-invalid={customError !== null}
                  aria-describedby={customError ? 'custom-size-error' : undefined}
                />
              </label>
              <span className={styles.times} aria-hidden="true">
                ×
              </span>
              <label>
                <span className={styles.visuallyHidden}>Height in pixels</span>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="numeric"
                  min={CUSTOM_SIZE_RANGE[0]}
                  max={CUSTOM_SIZE_RANGE[1]}
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  aria-invalid={customError !== null}
                  aria-describedby={customError ? 'custom-size-error' : undefined}
                />
              </label>
              <button type="submit" className={styles.textButton}>
                Apply
              </button>
            </div>
            {customError && (
              <p id="custom-size-error" className={styles.error} role="alert">
                {customError}
              </p>
            )}
          </form>
        )}
      </div>

      <div className={styles.section} role="group" aria-labelledby="grid-title">
        <h3 id="grid-title" className={styles.sectionTitle}>
          Grid
        </h3>
        <div className={styles.tiles}>
          {LAYOUT_PRESETS.map((p) => (
            <button key={p.kind} type="button" className={styles.tile} aria-label={p.label} title={p.label} onClick={() => choosePreset(p.kind, p.label)}>
              <PresetIcon kind={p.kind} />
            </button>
          ))}
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.textButton}
            disabled={countCells(doc.layout) <= 1}
            onClick={() => commit({ type: 'clearLayout' })}
          >
            Clear all lines
          </button>
          <button
            type="button"
            className={styles.textButton}
            disabled={emptyCells === 0 || filling}
            onClick={async () => {
              setFilling(true);
              try {
                await fillEmptyWithSamples(doc, commit);
              } finally {
                setFilling(false);
              }
            }}
          >
            {filling ? 'Adding…' : 'Fill empty cells with samples'}
          </button>
        </div>
        {hasUndersizedCells(doc) && <p className={styles.note}>Some cells are smaller than the minimum size.</p>}
      </div>
    </>
  );
}
