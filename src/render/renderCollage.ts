// Executes a draw plan on a 2D canvas context, plus the optional watermark. Used by Preview (screen
// size) and export (full size), never by the editor (FR-215).
import type { Doc, Size } from '../model/types';
import { getAsset } from '../state/imageStore';
import { planDraw } from './planDraw';
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

  if (opts?.watermark) drawWatermark(ctx, doc.canvas, sizePx);
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
