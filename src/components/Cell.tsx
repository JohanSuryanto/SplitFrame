import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { NO_GESTURE_ATTR, useGestures } from '../input/useGestures';
import { frameImage, panBy, zoomAt } from '../model/frame';
import { polygonCentroid } from '../model/polygon';
import type { CellImage, PxCell } from '../model/types';
import type { DocAction } from '../state/docReducer';
import { getAsset } from '../state/imageStore';
import type { Mode } from '../state/uiState';
import styles from './Cell.module.css';

const WHEEL_IDLE_MS = 300;
const LONG_PRESS_MS = 350;

/** Everything a cell can ask the editor to do. */
export interface CellActions {
  commit: (action: DocAction) => void;
  preview: (action: DocAction) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  openPicker: (cellId: string) => void;
  /** Empty cell tapped: offer "your photos" or a sample. */
  chooseSource: (cellId: string) => void;
  loadInto: (cellId: string, file: File) => void;
  openMenu: (cellId: string) => void;
  swapStart: (cellId: string, clientX: number, clientY: number) => void;
  swapMove: (clientX: number, clientY: number) => void;
  swapEnd: (drop: boolean) => void;
  /** Keyboard focus moved onto (id) or off (undefined) a cell. */
  focusChange: (cellId: string | undefined) => void;
  /** The photo last touched or pressed: its "⋯" button stays visible on touch screens. */
  activate: (cellId: string) => void;
}

interface CellProps {
  px: PxCell;
  /** 1-based position in reading order, for labels. */
  index: number;
  image?: CellImage;
  mode: Mode;
  actions: CellActions;
  /** Highlighted as the drop target of a photo swap. */
  swapTarget: boolean;
  /** This cell's photo is being dragged to another cell. */
  swapSource: boolean;
  /** Last touched photo: shows its "⋯" button without hover. */
  active: boolean;
}

function CellView({ px, index, image, mode, actions, swapTarget, swapSource, active }: CellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [fileOver, setFileOver] = useState(false);
  const asset = image ? getAsset(image.assetId) : undefined;
  const filled = Boolean(image && asset);
  const arrange = mode === 'arrange';

  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const swapping = useRef(false);
  useEffect(
    () => () => {
      clearTimeout(wheelTimer.current);
      clearTimeout(pressTimer.current);
    },
    [],
  );

  const cancelPress = () => clearTimeout(pressTimer.current);
  const framing = (update: (img: CellImage) => CellImage) => {
    if (!image || !asset) return;
    const next = update(image);
    actions.preview({ type: 'setFraming', cellId: px.cellId, patch: { zoom: next.zoom, focusX: next.focusX, focusY: next.focusY } });
  };

  // Pan, pinch, wheel zoom and double-tap reset for photos, in Arrange mode only (FR-023, FR-024).
  useGestures(
    ref,
    {
      onDragStart() {
        if (!swapping.current) cancelPress();
      },
      onDragMove(p, delta) {
        if (swapping.current) actions.swapMove(p.clientX ?? 0, p.clientY ?? 0);
        else framing((img) => panBy(img, delta.x, delta.y, px, asset!));
      },
      onDragEnd() {
        if (swapping.current) {
          swapping.current = false;
          actions.swapEnd(true);
        } else {
          actions.endGesture();
        }
      },
      onPinch(scale, center) {
        cancelPress();
        framing((img) => zoomAt(img, scale, center, px, asset!));
      },
      onPinchEnd() {
        actions.endGesture();
      },
      onWheel(factor, p) {
        framing((img) => zoomAt(img, factor, p, px, asset!));
        clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(actions.endGesture, WHEEL_IDLE_MS);
      },
      onTap() {
        cancelPress();
        if (swapping.current) {
          swapping.current = false;
          actions.swapEnd(false);
        }
      },
      onDoubleTap() {
        cancelPress();
        actions.commit({ type: 'resetFraming', cellId: px.cellId });
      },
      onCancel() {
        cancelPress();
        if (swapping.current) {
          swapping.current = false;
          actions.swapEnd(false);
        } else {
          actions.cancelGesture();
        }
      },
    },
    { enabled: arrange && filled },
  );

  // Press and hold a photo to pick it up and drop it on another cell (FR-028).
  const onPointerDown = (e: PointerEvent) => {
    if (filled) actions.activate(px.cellId);
    if ((e.target as Element).closest(`[${NO_GESTURE_ATTR}]`)) return;
    if (!arrange || !filled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const { clientX, clientY } = e;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      swapping.current = true;
      actions.swapStart(px.cellId, clientX, clientY);
    }, LONG_PRESS_MS);
  };

  const onClick = () => {
    if (arrange && !filled) actions.chooseSource(px.cellId);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (filled) actions.openMenu(px.cellId);
      else actions.chooseSource(px.cellId);
    } else if (filled && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      e.stopPropagation();
      actions.commit({ type: 'removeImage', cellId: px.cellId });
    }
  };

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setFileOver(true);
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setFileOver(false);
    const file = e.dataTransfer.files[0];
    if (file) actions.loadInto(px.cellId, file);
  };

  let imgStyle: CSSProperties | undefined;
  if (image && asset) {
    // Shaped cells frame the photo against their bounding box, so it covers the whole shape.
    const s = frameImage(px, asset, image);
    const k = px.w / s.sw;
    imgStyle = {
      width: asset.width * k,
      height: asset.height * k,
      transform: `translate(${-s.sx * k}px, ${-s.sy * k}px)`,
    };
  }

  const style: CSSProperties = { left: px.x, top: px.y, width: px.w, height: px.h };
  if (px.polygon) {
    // clip-path also clips hit-testing, so clicks and drops land on the shape under the pointer.
    style.clipPath = `polygon(${px.polygon.map((p) => `${p.x - px.x}px ${p.y - px.y}px`).join(', ')})`;
  } else {
    style.borderRadius = px.r;
  }

  // In a shaped cell the bounding-box center can fall outside the shape; use the centroid.
  let promptStyle: CSSProperties | undefined;
  let menuStyle: CSSProperties = { right: 8, top: 8 };
  if (px.polygon) {
    const c = polygonCentroid(px.polygon);
    promptStyle = { position: 'absolute', left: c.x - px.x, top: c.y - px.y, transform: 'translate(-50%, -50%)' };
    menuStyle = { left: c.x - px.x, top: c.y - px.y, transform: 'translate(-50%, -50%)' };
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className={styles.cell}
      data-cell-id={px.cellId}
      data-empty={filled ? undefined : ''}
      data-shaped={px.polygon ? '' : undefined}
      data-filled={filled ? '' : undefined}
      data-file-over={fileOver || swapTarget ? '' : undefined}
      data-swap-source={swapSource ? '' : undefined}
      data-active={active ? '' : undefined}
      aria-label={filled ? `Photo in cell ${index} — press Enter for options` : `Empty cell ${index} — press Enter to add a photo`}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={() => !swapping.current && cancelPress()}
      onPointerCancel={cancelPress}
      onFocus={() => actions.focusChange(px.cellId)}
      onBlur={() => actions.focusChange(undefined)}
      onDragOver={onDragOver}
      onDragLeave={() => setFileOver(false)}
      onDrop={onDrop}
    >
      {asset && imgStyle ? (
        <>
          <img className={styles.img} src={asset.url} alt="" draggable={false} style={imgStyle} />
          {arrange && (
            <button
              type="button"
              {...{ [NO_GESTURE_ATTR]: '' }}
              className={styles.more}
              style={menuStyle}
              tabIndex={-1}
              aria-label={`Photo options for cell ${index}`}
              aria-haspopup="menu"
              onClick={(e) => {
                e.stopPropagation();
                actions.openMenu(px.cellId);
              }}
            >
              ⋯
            </button>
          )}
        </>
      ) : (
        <span className={styles.prompt} aria-hidden="true" style={promptStyle}>
          +
        </span>
      )}
    </div>
  );
}

function samePx(a: PxCell, b: PxCell): boolean {
  if (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h || a.r !== b.r) return false;
  if (a.polygon === b.polygon) return true;
  if (!a.polygon || !b.polygon || a.polygon.length !== b.polygon.length) return false;
  return a.polygon.every((p, i) => p.x === b.polygon![i]!.x && p.y === b.polygon![i]!.y);
}

export const Cell = memo(
  CellView,
  (a, b) =>
    samePx(a.px, b.px) &&
    a.index === b.index &&
    a.image === b.image &&
    a.mode === b.mode &&
    a.actions === b.actions &&
    a.swapTarget === b.swapTarget &&
    a.swapSource === b.swapSource &&
    a.active === b.active,
);
