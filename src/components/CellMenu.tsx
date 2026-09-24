import { useEffect, useRef } from 'react';
import { NO_GESTURE_ATTR } from '../input/useGestures';
import styles from './CellMenu.module.css';

interface CellMenuProps {
  left: number;
  top: number;
  onReplace: () => void;
  onUseSample: () => void;
  onRemove: () => void;
  onReset: () => void;
  onClose: () => void;
}

/** Replace / Remove / Reset position for one photo (FR-024). Escape or a click outside closes it. */
export function CellMenu({ left, top, onReplace, onUseSample, onRemove, onReset, onClose }: CellMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
        next?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  const item = (label: string, run: () => void) => (
    <button
      type="button"
      role="menuitem"
      className={styles.item}
      onClick={() => {
        run();
        onClose();
      }}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} {...{ [NO_GESTURE_ATTR]: '' }} className={styles.menu} style={{ left, top }} role="menu" aria-label="Photo options">
      {item('Replace', onReplace)}
      {item('Use a sample…', onUseSample)}
      {item('Reset position', onReset)}
      {item('Remove', onRemove)}
    </div>
  );
}
