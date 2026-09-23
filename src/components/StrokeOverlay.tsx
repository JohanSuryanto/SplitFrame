import type { SnapCandidate } from '../model/snap';
import type { Direction, Pt } from '../model/types';
import styles from './StrokeOverlay.module.css';

export interface OverlaySegment {
  /** Position on the split axis and extent along the line, in preview px. */
  coord: number;
  from: number;
  to: number;
}

type StrokeOverlayProps =
  | {
      kind: 'straight';
      axis: Direction;
      segments: OverlaySegment[];
      invalid: boolean;
      reason?: string;
      /** Snap guide in preview px, across the whole content area. */
      guide?: { kind: SnapCandidate['kind']; value: number; coord: number; from: number; to: number };
    }
  | {
      kind: 'path';
      /** Freehand lines in preview px: the trimmed chords when valid, the whole stroke when not. */
      polylines: Pt[][];
      invalid: boolean;
      reason?: string;
      labelAt?: Pt;
    };

const GUIDE_LABEL: Record<SnapCandidate['kind'], (v: number) => string> = {
  center: () => 'Center',
  third: (v) => (v < 0.5 ? '⅓' : '⅔'),
  edge: () => 'Edge',
};

function lineStyle(axis: Direction, coord: number, from: number, to: number) {
  return axis === 'horizontal'
    ? { left: from, top: coord, width: to - from }
    : { left: coord, top: from, height: to - from };
}

export function StrokeOverlay(props: StrokeOverlayProps) {
  if (props.kind === 'path') {
    const { polylines, invalid, reason, labelAt } = props;
    return (
      <div className={styles.overlay} aria-hidden="true">
        <svg className={styles.svg}>
          {polylines.map((pts, i) => (
            <polyline
              key={i}
              className={`${styles.path} ${invalid ? styles.pathInvalid : ''}`}
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          ))}
        </svg>
        {invalid && reason && labelAt && (
          <span className={styles.tooSmall} style={{ left: labelAt.x, top: labelAt.y }}>
            {reason}
          </span>
        )}
      </div>
    );
  }

  const { axis, segments, invalid, reason, guide } = props;
  const labelAt = segments[0];
  return (
    <div className={styles.overlay} aria-hidden="true">
      {guide && (
        <>
          <div className={`${styles.guide} ${styles[axis]}`} style={lineStyle(axis, guide.coord, guide.from, guide.to)} />
          <span
            className={styles.guideLabel}
            style={axis === 'horizontal' ? { left: guide.from + 4, top: guide.coord } : { left: guide.coord, top: guide.from + 4 }}
          >
            {GUIDE_LABEL[guide.kind](guide.value)}
          </span>
        </>
      )}
      {segments.map((s, i) => (
        <div
          key={i}
          className={`${styles.line} ${styles[axis]} ${invalid ? styles.invalid : ''}`}
          style={lineStyle(axis, s.coord, s.from, s.to)}
        />
      ))}
      {invalid && reason && labelAt && (
        <span
          className={styles.tooSmall}
          style={
            axis === 'horizontal'
              ? { left: (labelAt.from + labelAt.to) / 2, top: labelAt.coord }
              : { left: labelAt.coord, top: (labelAt.from + labelAt.to) / 2 }
          }
        >
          {reason}
        </span>
      )}
    </div>
  );
}
