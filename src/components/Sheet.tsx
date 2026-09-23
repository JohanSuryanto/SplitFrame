import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import styles from './Sheet.module.css';

/** Elements with this attribute (the dock) don't count as "outside" for closing a sheet. */
export const SHEET_IGNORE_ATTR = 'data-sheet-ignore';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel that opens from the dock: a floating card on wide screens, a bottom sheet on phones.
 * Its height is published as `--sheet-h` so the canvas can shrink to stay fully visible above it.
 * Escape, the close button, the handle (tap or swipe down) or a press outside closes it.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  const swipe = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const wide = window.matchMedia('(min-width: 1024px)');
    const publish = () => {
      root.style.setProperty('--sheet-w', wide.matches ? `${el.offsetWidth + 24}px` : '0px');
      root.style.setProperty('--sheet-h', wide.matches ? '0px' : `${el.offsetHeight}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    wide.addEventListener('change', publish);
    return () => {
      ro.disconnect();
      wide.removeEventListener('change', publish);
      root.style.setProperty('--sheet-h', '0px');
      root.style.setProperty('--sheet-w', '0px');
    };
  }, []);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, button:not([data-sheet-close])')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest?.(`[${SHEET_IGNORE_ATTR}]`)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  return (
    <section ref={ref} className={styles.sheet} role="dialog" aria-label={title}>
      <div
        className={styles.handle}
        aria-hidden="true"
        onPointerDown={(e) => (swipe.current = e.clientY)}
        onPointerUp={(e) => {
          if (swipe.current !== null && e.clientY - swipe.current > 32) onClose();
          swipe.current = null;
        }}
      >
        <span />
      </div>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} aria-label={`Close ${title}`} data-sheet-close onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
