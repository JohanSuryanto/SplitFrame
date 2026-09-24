import { useLayoutEffect, useRef } from 'react';
import type { Size } from '../model/types';
import { drawWatermark } from '../render/renderCollage';
import styles from './WatermarkLayer.module.css';

interface WatermarkLayerProps {
  canvas: { width: number; height: number };
  size: Size;
}

/**
 * The export credit drawn over the editing canvas while the Export panel is open, exactly where it
 * will be in the file, so the Watermark switch has a visible effect. Ignores pointer input and is
 * hidden from screen readers; the switch is the accessible control (FR-215).
 */
export function WatermarkLayer({ canvas, size }: WatermarkLayerProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || size.w <= 0 || size.h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const backing = { w: Math.round(size.w * dpr), h: Math.round(size.h * dpr) };
    c.width = backing.w;
    c.height = backing.h;
    drawWatermark(ctx, canvas, backing);
  }, [canvas, size.w, size.h]);

  return <canvas ref={ref} className={styles.layer} style={{ width: size.w, height: size.h }} aria-hidden="true" />;
}
