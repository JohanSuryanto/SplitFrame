// Executes a draw plan on a 2D canvas context, then the user's watermark (feature 005), signature
// (feature 006) and the optional SplitFrame credit. Used by Preview (screen size) and export (full size);
// the editor draws only the marks, on its overlay (MarkLayer).
import { planSignature } from '../model/signature';
import type { Doc, Pt, Signature, Size, Watermark } from '../model/types';
import { getAsset, type ImageAsset } from '../state/imageStore';
import { planDraw } from './planDraw';
import { planTextMark } from './textMark';
import { planWatermark, watermarkFont } from './watermark';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
  } else if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

export function renderCollage(ctx: Ctx, doc: Doc, sizePx: Size, opts?: { watermark?: boolean }): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const op of planDraw(doc, getAsset, sizePx)) {
    switch (op.op) {
      case 'fill':
        ctx.fillStyle = op.color;
        ctx.fillRect(op.rect.x, op.rect.y, op.rect.w, op.rect.h);
        break;
      case 'clip':
        ctx.save();
        ctx.beginPath();
        if (op.path) {
          op.path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
        } else {
          roundRectPath(ctx, op.rect.x, op.rect.y, op.rect.w, op.rect.h, op.r);
        }
        ctx.clip();
        break;
      case 'image': {
        const asset = getAsset(op.assetId);
        if (!asset) break;
        const { sx, sy, sw, sh } = op.src;
        ctx.drawImage(asset.bitmap, sx, sy, sw, sh, op.dest.x, op.dest.y, op.dest.w, op.dest.h);
        break;
      }
      case 'restore':
        ctx.restore();
        break;
      case 'stroke':
        ctx.beginPath();
        op.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.lineWidth = op.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = op.color;
        ctx.stroke();
        break;
    }
  }

  drawTextMark(ctx, doc.watermark, doc.canvas, sizePx);
  drawSignature(ctx, doc.signature, doc.canvas, sizePx);
  if (opts?.watermark) drawWatermark(ctx, doc.canvas, sizePx);
}

type PathCtx = Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'arc' | 'fill' | 'stroke'> & {
  lineWidth: number;
};

/**
 * Strokes one pen line as smooth curves through the midpoints of its points (research S4); a lone point
 * becomes a dot. Shared by the signature pad and drawSignature so both look the same.
 */
export function traceStroke(ctx: PathCtx, pts: Pt[]): void {
  const first = pts[0];
  if (!first) return;
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(first.x, first.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  const last = pts[pts.length - 1]!;
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

/** One recolored copy of an uploaded signature, so dragging and export never redo pixel work (research S7). */
let tint: { key: string; canvas: OffscreenCanvas | HTMLCanvasElement } | null = null;

function tinted(asset: ImageAsset, color: string): CanvasImageSource {
  const key = `${asset.id}|${color}`;
  if (tint?.key === key) return tint.canvas;
  const { width, height } = asset.bitmap;
  let c: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(width, height);
  else {
    c = document.createElement('canvas');
    c.width = width;
    c.height = height;
  }
  const t = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!t) return asset.bitmap;
  t.fillStyle = color;
  t.fillRect(0, 0, width, height);
  t.globalCompositeOperation = 'destination-in';
  t.drawImage(asset.bitmap, 0, 0);
  tint = { key, canvas: c };
  return c;
}

/** Draws the signature for an export canvas of this size onto a surface of sizePx (FR-616, FR-617). */
export function drawSignature(ctx: Ctx, sig: Signature | null, canvas: { width: number; height: number }, sizePx: Size): void {
  if (!sig) return;
  const p = planSignature(sig, canvas, sizePx);
  const pic = sig.picture;
  ctx.save();
  ctx.translate(p.cx, p.cy);
  ctx.rotate(p.angle);
  ctx.globalAlpha = sig.opacity;
  if (pic.kind === 'strokes') {
    ctx.lineWidth = pic.lineWidth * p.w;
    ctx.strokeStyle = sig.color;
    ctx.fillStyle = sig.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of pic.strokes) traceStroke(ctx as PathCtx, s.map((q) => ({ x: q.x * p.w - p.w / 2, y: q.y * p.h - p.h / 2 })));
  } else {
    const asset = getAsset(pic.assetId);
    if (asset) ctx.drawImage(sig.keepColors ? asset.bitmap : tinted(asset, sig.color), -p.w / 2, -p.h / 2, p.w, p.h);
  }
  ctx.restore();
}

/** Draws the user's watermark for an export canvas of this size onto a surface of sizePx (FR-512, FR-513). */
export function drawTextMark(ctx: Ctx, mark: Watermark, canvas: { width: number; height: number }, sizePx: Size): void {
  const op = planTextMark(mark, canvas, sizePx, (text, px) => {
    ctx.font = watermarkFont(px);
    return ctx.measureText(text).width;
  });
  if (!op) return;
  ctx.save();
  ctx.font = op.font;
  ctx.fillStyle = op.color;
  ctx.globalAlpha = op.alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const base = ctx.getTransform();
  for (const p of op.points) {
    ctx.translate(p.x, p.y);
    ctx.rotate(op.angle);
    ctx.fillText(op.text, 0, 0);
    ctx.setTransform(base);
  }
  ctx.restore();
}

/** Draws the credit for an export canvas of this size onto a surface of sizePx (also the editor while Export is open). */
export function drawWatermark(ctx: Ctx, canvas: { width: number; height: number }, sizePx: Size): void {
  const op = planWatermark(canvas, sizePx, (text, px) => {
    ctx.font = watermarkFont(px);
    return ctx.measureText(text).width;
  });
  if (!op) return;
  ctx.save();
  ctx.font = op.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = op.color;
  ctx.shadowColor = op.shadow.color;
  ctx.shadowBlur = op.shadow.blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = op.shadow.offsetY;
  ctx.fillText(op.text, op.x, op.y);
  ctx.restore();
}
