import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type PointerEvent } from 'react';
import { NO_GESTURE_ATTR, useGestures, type Point } from '../input/useGestures';
import { planStroke, type Draft } from '../model/draft';
import { layoutPixels, minAreaNorm, minSizeNorm, styleScale } from '../model/geometry';
import { cellsInReadingOrder, dividers, pathDividers, type MakeId, type SplitError } from '../model/layout';
import { pathMidpoint, polygonCentroid } from '../model/polygon';
import type { Area } from '../model/snap';
import { newId, type Doc, type Size } from '../model/types';
import { removeDividerWithReport, type DocAction } from '../state/docReducer';
import { getAsset, ImageLoadError, loadImage, maxSideFor } from '../state/imageStore';
import type { Mode } from '../state/uiState';
import { fillEmptyWithSamples, putSampleIn } from '../samples/actions';
import { Cell, type CellActions } from './Cell';
import { CellMenu } from './CellMenu';
import { SamplePicker } from './SamplePicker';
import { Divider, RemoveHandle } from './Divider';
import { LineLayer } from './LineLayer';
import { StrokeOverlay } from './StrokeOverlay';
import styles from './Editor.module.css';

const MARGIN = 16;

const REASON: Record<SplitError, string> = {
  'too-small': 'Too small',
  'self-crossing': "Lines can't cross themselves",
  'no-target': 'Draw from edge to edge',
};

/** Where a cell's "⋯" button goes: the top-right corner of a rectangle, the centroid of a shape. */
function menuAnchor(px: { x: number; y: number; w: number; h: number; polygon?: { x: number; y: number }[] }) {
  if (px.polygon) {
    const c = polygonCentroid(px.polygon);
    return { x: c.x, y: c.y };
  }
  return { x: px.x + px.w - 22, y: px.y + 22 };
}

/** Largest rectangle with the canvas aspect ratio that fits the available space. */
function fitPreview(avail: Size, canvas: { width: number; height: number }): Size {
  const w = Math.max(avail.w - 2 * MARGIN, 1);
  const h = Math.max(avail.h - 2 * MARGIN, 1);
  const k = Math.min(w / canvas.width, h / canvas.height);
  return { w: Math.floor(canvas.width * k), h: Math.floor(canvas.height * k) };
}

/** The stroke in progress: the split it would make if released now, and the split ids it creates. */
interface StrokeState {
  draft: Draft;
  newSplitIds: Set<string>;
}

interface EditorProps {
  doc: Doc;
  mode: Mode;
  setMode: (mode: Mode) => void;
  commit: (action: DocAction) => void;
  preview: (action: DocAction) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  undo: () => void;
  selectedDividerId?: string;
  selectDivider: (id?: string) => void;
  pushToast: (message: string, action?: { label: string; run: () => void }) => void;
  /** Opens the Preview (offered once an upload fills the last empty cell, FR-044). */
  onPreview: () => void;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function Editor(props: EditorProps) {
  const { doc, mode, commit, selectedDividerId, selectDivider } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<Size>({ w: 0, h: 0 });
  const [stroke, setStroke] = useState<StrokeState | null>(null);
  const points = useRef<Point[]>([]);
  // One id map per stroke, so the preview and the committed split share node ids (no remounts).
  const strokeIds = useRef(new Map<string, string>());

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setAvail({
        w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const previewSize = useMemo(() => fitPreview(avail, doc.canvas), [avail, doc.canvas]);
  const content: Area = useMemo(() => {
    const pad = doc.style.padding * styleScale(previewSize);
    return { x: pad, y: pad, w: Math.max(previewSize.w - 2 * pad, 1), h: Math.max(previewSize.h - 2 * pad, 1) };
  }, [doc.style.padding, previewSize]);

  const makeId: MakeId = (cellId, role) => {
    const key = `${cellId}:${role}`;
    let id = strokeIds.current.get(key);
    if (!id) {
      id = newId();
      strokeIds.current.set(key, id);
    }
    return id;
  };

  const computeStroke = (pts: Point[]): StrokeState | null => {
    const draft = planStroke(doc.layout, pts, content, {
      min: minSizeNorm(doc.canvas, doc.style),
      minArea: minAreaNorm(doc.canvas, doc.style),
      makeId,
    });
    if (!draft) return null;
    const newSplitIds = new Set<string>();
    for (const [key, id] of strokeIds.current) if (key.includes(':split')) newSplitIds.add(id);
    return { draft, newSplitIds };
  };

  // Strokes may start and end outside the canvas (overshoot is trimmed), so the whole editor area
  // listens in draw mode; points are converted to canvas coordinates.
  const offset = useRef<Point>({ x: 0, y: 0 });
  const toSurface = (p: Point): Point => ({ x: p.x - offset.current.x, y: p.y - offset.current.y });

  useGestures(
    containerRef,
    {
      onDragStart(p) {
        const c = containerRef.current!.getBoundingClientRect();
        const sf = surfaceRef.current!.getBoundingClientRect();
        offset.current = { x: sf.left - c.left, y: sf.top - c.top };
        points.current = [toSurface(p)];
        strokeIds.current = new Map();
      },
      onDragMove(p) {
        points.current.push(toSurface(p));
        setStroke(computeStroke(points.current));
      },
      onDragEnd(p) {
        points.current.push(toSurface(p));
        const s = computeStroke(points.current);
        if (s && 'tree' in s.draft.result) {
          const d = s.draft;
          if (d.kind === 'straight') {
            commit({ type: 'splitAt', axis: d.line.axis, coord: d.line.coord, span: d.line.span, makeId });
          } else {
            const path = d.pathPx.map((q) => ({ x: (q.x - content.x) / content.w, y: (q.y - content.y) / content.h }));
            commit({ type: 'splitByPath', path, makeId });
          }
        }
        setStroke(null);
      },
      onCancel() {
        setStroke(null);
      },
    },
    { enabled: mode === 'draw' },
  );

  // ----- Photos (FR-020 to FR-028) -----
  const fileInput = useRef<HTMLInputElement>(null);
  const pickerCell = useRef<string | null>(null);
  const [menuCellId, setMenuCellId] = useState<string | null>(null);
  const [sampleCellId, setSampleCellId] = useState<string | null>(null);
  const [samplesBusy, setSamplesBusy] = useState(false);
  const [focusedCellId, setFocusedCellId] = useState<string | undefined>(undefined);
  const [activeCellId, setActiveCellId] = useState<string | undefined>(undefined);
  type Swap = { from: string; url: string; x: number; y: number; target?: string };
  const [swap, setSwapState] = useState<Swap | null>(null);
  // Mirrored in a ref so the drop reads the latest target without side effects in a state updater.
  const swapRef = useRef<Swap | null>(null);
  const setSwap = (next: Swap | null) => {
    swapRef.current = next;
    setSwapState(next);
  };

  const loadInto = async (cellId: string, file: File) => {
    try {
      const asset = await loadImage(file, maxSideFor(doc.canvas));
      const cells = cellsInReadingOrder(doc.layout);
      const empty = cells.filter((c) => !c.image);
      const fillsLast = cells.length > 1 && empty.length === 1 && empty[0]!.id === cellId;
      commit({ type: 'setImage', cellId, assetId: asset.id });
      if (fillsLast) props.pushToast('All cells filled', { label: 'Preview', run: props.onPreview });
    } catch (e) {
      if (e instanceof ImageLoadError) props.pushToast(e.message);
      else throw e;
    }
  };

  const focusCell = (cellId: string) =>
    containerRef.current?.querySelector<HTMLElement>(`[data-cell-id="${CSS.escape(cellId)}"]`)?.focus();

  const cellUnder = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest('[data-cell-id]') as HTMLElement | null)?.dataset.cellId;

  const cellActionsImpl: CellActions = {
    commit,
    preview: props.preview,
    endGesture: props.endGesture,
    cancelGesture: props.cancelGesture,
    openPicker: (cellId) => {
      pickerCell.current = cellId;
      fileInput.current?.click();
    },
    loadInto: (cellId, file) => void loadInto(cellId, file),
    openMenu: setMenuCellId,
    focusChange: setFocusedCellId,
    activate: setActiveCellId,
    swapStart: (cellId, x, y) => {
      const image = cellsInReadingOrder(doc.layout).find((c) => c.id === cellId)?.image;
      const url = image && getAsset(image.assetId)?.url;
      if (url) setSwap({ from: cellId, url, x, y });
    },
    swapMove: (x, y) => {
      const sw = swapRef.current;
      if (sw) setSwap({ ...sw, x, y, target: cellUnder(x, y) });
    },
    swapEnd: (drop) => {
      const sw = swapRef.current;
      if (drop && sw?.target && sw.target !== sw.from) commit({ type: 'swapImages', a: sw.from, b: sw.target });
      setSwap(null);
    },
  };

  const latestActions = useRef(cellActionsImpl);
  useLayoutEffect(() => {
    latestActions.current = cellActionsImpl;
  });
  const cellActions = useMemo<CellActions>(
    () => ({
      commit: (a) => latestActions.current.commit(a),
      preview: (a) => latestActions.current.preview(a),
      endGesture: () => latestActions.current.endGesture(),
      cancelGesture: () => latestActions.current.cancelGesture(),
      openPicker: (id) => latestActions.current.openPicker(id),
      loadInto: (id, f) => latestActions.current.loadInto(id, f),
      openMenu: (id) => latestActions.current.openMenu(id),
      focusChange: (id) => latestActions.current.focusChange(id),
      activate: (id) => latestActions.current.activate(id),
      swapStart: (id, x, y) => latestActions.current.swapStart(id, x, y),
      swapMove: (x, y) => latestActions.current.swapMove(x, y),
      swapEnd: (drop) => latestActions.current.swapEnd(drop),
    }),
    [],
  );

  function closeMenu() {
    const id = menuCellId;
    setMenuCellId(null);
    if (id) focusCell(id);
  }

  function sampleFromMenu() {
    if (menuCellId) setSampleCellId(menuCellId);
  }

  async function trySamples() {
    setSamplesBusy(true);
    try {
      await fillEmptyWithSamples(doc, commit);
    } finally {
      setSamplesBusy(false);
    }
  }

  function replaceFromMenu() {
    if (menuCellId) cellActions.openPicker(menuCellId);
  }

  // Removing a divider merges its subtree into one cell (FR-018, FR-019); report what was lost.
  const removeLine = (splitId: string) => {
    const report = removeDividerWithReport(doc, splitId);
    if (report.removedDividers === 0) return;
    commit({ type: 'removeDivider', splitId });
    selectDivider(undefined);
    if (report.droppedImages > 0 || report.removedDividers > 1) {
      const photos = report.droppedImages === 1 ? 'photo' : 'photos';
      const lines = report.removedDividers === 1 ? 'divider' : 'dividers';
      props.pushToast(`Merged — ${report.removedDividers} ${lines} and ${report.droppedImages} ${photos} removed`, {
        label: 'Undo',
        run: props.undo,
      });
    }
  };

  // Delete/Backspace removes the selected divider; Escape clears the selection.
  useEffect(() => {
    if (!selectedDividerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeLine(selectedDividerId);
      } else if (e.key === 'Escape') {
        selectDivider(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const clientToContent = (clientX: number, clientY: number): Point => {
    const r = surfaceRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - content.x, y: clientY - r.top - content.y };
  };

  // Pressing anywhere that isn't a divider or its × clears the selection.
  const onPointerDownCapture = (e: PointerEvent) => {
    if (!(e.target as Element).closest(`[${NO_GESTURE_ATTR}]`)) selectDivider(undefined);
  };

  // While a valid stroke is in progress, show the layout it would create (live crop, FR-045).
  const draft = stroke?.draft;
  const tentative = draft && 'tree' in draft.result ? draft.result.tree : null;
  const shownDoc = useMemo(() => (tentative ? { ...doc, layout: tentative } : doc), [doc, tentative]);
  const cells = useMemo(() => layoutPixels(shownDoc, previewSize), [shownDoc, previewSize]);
  const images = useMemo(
    () => new Map(cellsInReadingOrder(shownDoc.layout).map((c) => [c.id, c.image])),
    [shownDoc.layout],
  );
  const emptyIds = useMemo(
    () => new Set(cellsInReadingOrder(shownDoc.layout).filter((c) => !c.image).map((c) => c.id)),
    [shownDoc.layout],
  );

  let overlay: ComponentProps<typeof StrokeOverlay> | null = null;
  if (stroke && draft) {
    const xPx = (n: number) => content.x + n * content.w;
    const yPx = (n: number) => content.y + n * content.h;
    const error = 'error' in draft.result ? draft.result.error : undefined;
    // A straight line that lands exactly on an existing edge is simply ignored, not flagged.
    const invalid = error !== undefined && !(draft.kind === 'straight' && error === 'no-target');
    const reason = invalid && error ? REASON[error] : undefined;

    if (draft.kind === 'straight') {
      const { axis, coord, span } = draft.line;
      // A horizontal line sits at a y and runs along x; a vertical line the other way round.
      const [atPx, alongPx] = axis === 'horizontal' ? [yPx, xPx] : [xPx, yPx];
      const coordPx = atPx(coord);
      const segments = tentative
        ? dividers(tentative)
            .filter((d) => stroke.newSplitIds.has(d.splitId))
            .map((d) => ({ coord: coordPx, from: alongPx(d.span[0]), to: alongPx(d.span[1]) }))
        : [{ coord: coordPx, from: alongPx(span[0]), to: alongPx(span[1]) }];
      overlay = {
        kind: 'straight',
        axis,
        segments,
        invalid,
        reason,
        guide: draft.guide && { ...draft.guide, coord: coordPx, from: alongPx(0), to: alongPx(1) },
      };
    } else {
      // Valid: show only the trimmed chords that will become lines. Invalid: the whole stroke.
      const polylines = tentative
        ? pathDividers(tentative)
            .filter((d) => stroke.newSplitIds.has(d.splitId))
            .map((d) => d.points.map((q) => ({ x: xPx(q.x), y: yPx(q.y) })))
        : [draft.pathPx];
      overlay = { kind: 'path', polylines, invalid, reason, labelAt: pathMidpoint(draft.pathPx) };
    }
  }

  const drawing = mode === 'draw';
  // First-run hint: one empty cell and nothing else yet.
  const blank = doc.layout.type === 'cell' && !doc.layout.image;
  const menuPx = menuCellId ? cells.find((c) => c.cellId === menuCellId) : undefined;
  const straightLines = stroke ? [] : dividers(doc.layout);
  const selectedPath = selectedDividerId ? pathDividers(doc.layout).find((d) => d.splitId === selectedDividerId) : undefined;
  const selectedPathMid = selectedPath && pathMidpoint(selectedPath.points);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${drawing ? styles.containerDrawing : ''}`}
      onPointerDownCapture={onPointerDownCapture}
      // Files dropped outside a cell must not navigate the page away.
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          const cellId = pickerCell.current;
          e.target.value = '';
          if (file && cellId) void loadInto(cellId, file);
        }}
      />
      {swap && (
        <img className={styles.swapGhost} src={swap.url} alt="" style={{ left: swap.x, top: swap.y }} aria-hidden="true" />
      )}
      <div className={styles.status} aria-live="polite">
        {drawing ? (
          <p className={styles.pill} {...{ [NO_GESTURE_ATTR]: '' }}>
            <span className={styles.dot} aria-hidden="true" />
            Drag across the canvas to split
            <button type="button" className={styles.done} onClick={() => props.setMode('arrange')}>
              Done
            </button>
          </p>
        ) : (
          blank && (
            <p className={styles.hint}>
              Tap + to add a photo · Layout for grids · Draw to split your own way ·{' '}
              <button
                type="button"
                {...{ [NO_GESTURE_ATTR]: '' }}
                className={styles.hintAction}
                onClick={() => void trySamples()}
                disabled={samplesBusy}
              >
                {samplesBusy ? 'Adding samples…' : 'Try sample photos'}
              </button>
            </p>
          )
        )}
      </div>
      <div
        ref={surfaceRef}
        className={`${styles.surface} ${drawing ? styles.drawing : ''}`}
        style={{
          width: previewSize.w,
          height: previewSize.h,
          background: doc.style.color,
          visibility: avail.w > 0 ? 'visible' : 'hidden',
        }}
        aria-label={`Collage canvas, ${doc.canvas.width} by ${doc.canvas.height} pixels`}
        role="group"
      >
        {cells.map((px, i) => (
          <Cell
            key={px.cellId}
            px={px}
            index={i + 1}
            image={images.get(px.cellId)}
            mode={mode}
            actions={cellActions}
            swapTarget={swap?.target === px.cellId && swap.from !== px.cellId}
            swapSource={swap?.from === px.cellId}
            active={activeCellId === px.cellId}
          />
        ))}
        <LineLayer
          doc={shownDoc}
          size={previewSize}
          cells={cells}
          emptyIds={emptyIds}
          selectedId={selectedDividerId}
          onSelectPath={stroke ? undefined : selectDivider}
          onRemovePath={removeLine}
          focusedCellId={focusedCellId}
        />
        {straightLines.map((d) => (
          <Divider
            key={d.splitId}
            divider={d}
            layout={doc.layout}
            content={content}
            clientToContent={clientToContent}
            selected={d.splitId === selectedDividerId}
            onSelect={selectDivider}
            onRemove={removeLine}
            onPreview={(splitId, coord) => props.preview({ type: 'resizeDivider', splitId, coord })}
            onCommit={(splitId, coord) => commit({ type: 'resizeDivider', splitId, coord })}
            onEndGesture={props.endGesture}
            onCancelGesture={props.cancelGesture}
          />
        ))}
        {menuPx && menuCellId && (
          <CellMenu
            left={Math.min(menuAnchor(menuPx).x, previewSize.w - 170)}
            top={menuAnchor(menuPx).y + 18}
            onReplace={replaceFromMenu}
            onUseSample={sampleFromMenu}
            onRemove={() => commit({ type: 'removeImage', cellId: menuCellId })}
            onReset={() => commit({ type: 'resetFraming', cellId: menuCellId })}
            onClose={closeMenu}
          />
        )}
        {sampleCellId && (
          <SamplePicker
            onPick={(id) => {
              const cellId = sampleCellId;
              setSampleCellId(null);
              void putSampleIn(doc, cellId, id, commit);
            }}
            onCancel={() => setSampleCellId(null)}
          />
        )}
        {selectedPathMid && (
          <RemoveHandle
            left={content.x + selectedPathMid.x * content.w}
            top={content.y + selectedPathMid.y * content.h}
            onRemove={() => removeLine(selectedDividerId!)}
          />
        )}
        {overlay && <StrokeOverlay {...overlay} />}
      </div>
    </div>
  );
}
