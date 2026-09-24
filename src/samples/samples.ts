// Sample artworks, drawn in code on demand: nothing is downloaded and nothing ships as an image file.
// Each sample becomes an ordinary photo through the image store, so pan, zoom, swap and export all work.
import { loadImage, maxSideFor, type ImageAsset } from '../state/imageStore';
import type { CanvasSpec } from '../model/types';
import type { SampleId } from './plan';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const SIZE = 1600;

/** Small deterministic PRNG, so every sample looks the same every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fine film grain so flat color areas don't look synthetic. */
function grain(ctx: Ctx, w: number, h: number, seed: number, alpha = 0.05) {
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 40; i++) {
    ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
}

/** Sunset sky, a glowing sun and layered rolling hills. */
function dunes(ctx: Ctx, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, '#2b2d6e');
  sky.addColorStop(0.45, '#c9667e');
  sky.addColorStop(1, '#f6b98a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sx = w * 0.62;
  const sy = h * 0.46;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.45);
  glow.addColorStop(0, 'rgba(255, 228, 170, 0.85)');
  glow.addColorStop(1, 'rgba(255, 228, 170, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffe7b3';
  ctx.beginPath();
  ctx.arc(sx, sy, w * 0.09, 0, Math.PI * 2);
  ctx.fill();

  const layers = ['#e4876f', '#b8566a', '#7e3a64', '#4a2554', '#26163a'];
  layers.forEach((color, i) => {
    const base = h * (0.5 + i * 0.1);
    const amp = h * (0.035 + i * 0.012);
    const freq = 1.6 + i * 0.55;
    const phase = i * 1.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const t = x / w;
      ctx.lineTo(x, base + Math.sin(t * Math.PI * freq + phase) * amp + Math.sin(t * Math.PI * freq * 2.7 + phase) * amp * 0.3);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  });
  grain(ctx, w, h, 11);
}

/** Soft glowing color fields, like a mesh gradient. */
function lagoon(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#0f3b57';
  ctx.fillRect(0, 0, w, h);
  const blobs: [number, number, number, string][] = [
    [0.2, 0.25, 0.55, 'rgba(56, 212, 196, 0.85)'],
    [0.8, 0.2, 0.5, 'rgba(120, 140, 255, 0.75)'],
    [0.65, 0.75, 0.6, 'rgba(250, 170, 220, 0.6)'],
    [0.15, 0.85, 0.45, 'rgba(160, 245, 190, 0.6)'],
    [0.5, 0.5, 0.35, 'rgba(255, 255, 255, 0.25)'],
  ];
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, color] of blobs) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
  // A few thin ripples.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.58, w * (0.12 + i * 0.07), h * (0.05 + i * 0.03), -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  grain(ctx, w, h, 23, 0.04);
}

/** Geometric tiles of quarter circles in warm earth tones. */
function mosaic(ctx: Ctx, w: number, h: number) {
  const palette = ['#e9dcc6', '#d9794e', '#e4b04a', '#7d9a7a', '#2f4a5a', '#b9523f'];
  const n = 5;
  const tw = w / n;
  const th = h / n;
  const r = rng(7);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = col * tw;
      const y = row * th;
      const bg = palette[Math.floor(r() * palette.length)]!;
      let fg = palette[Math.floor(r() * palette.length)]!;
      if (fg === bg) fg = palette[(palette.indexOf(bg) + 2) % palette.length]!;
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, tw + 1, th + 1);
      const corner = Math.floor(r() * 4);
      const cx = corner === 1 || corner === 2 ? x + tw : x;
      const cy = corner >= 2 ? y + th : y;
      const start = [0, 0.5, 1, 1.5][corner]! * Math.PI;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, tw, start, start + Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      if (r() < 0.35) {
        ctx.fillStyle = palette[Math.floor(r() * palette.length)]!;
        ctx.beginPath();
        ctx.arc(x + tw / 2, y + th / 2, tw * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  grain(ctx, w, h, 5, 0.04);
}

/** Night sky with glowing aurora ribbons, stars and a mountain silhouette. */
function aurora(ctx: Ctx, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#050a1e');
  sky.addColorStop(0.55, '#0b2438');
  sky.addColorStop(1, '#0f3a3a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const r = rng(31);
  for (let i = 0; i < 320; i++) {
    const s = (0.6 + r() * 1.8) * (w / 1600);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + r() * 0.6})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h * 0.7, s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ribbons: the same wavy curve stroked in several soft, widening passes.
  ctx.globalCompositeOperation = 'lighter';
  const ribbons: [number, number, number, string][] = [
    [0.34, 0.06, 1.3, '70, 255, 170'],
    [0.46, 0.05, 1.7, '120, 200, 255'],
    [0.28, 0.04, 2.2, '190, 120, 255'],
  ];
  for (const [base, amp, freq, rgb] of ribbons) {
    for (let pass = 0; pass < 5; pass++) {
      ctx.strokeStyle = `rgba(${rgb}, ${0.1 - pass * 0.015})`;
      ctx.lineWidth = w * (0.02 + pass * 0.035);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = -0.05 * w; x <= w * 1.05; x += 10) {
        const t = x / w;
        const y = h * (base + Math.sin(t * Math.PI * freq + base * 9) * amp + Math.sin(t * Math.PI * freq * 3.1) * amp * 0.35);
        if (x <= -0.05 * w) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // Mountains.
  const peaks: [number, number][] = [
    [0, 0.8], [0.12, 0.7], [0.22, 0.76], [0.36, 0.62], [0.5, 0.74], [0.62, 0.66], [0.76, 0.78], [0.88, 0.69], [1, 0.75],
  ];
  ctx.fillStyle = '#04111a';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (const [x, y] of peaks) ctx.lineTo(x * w, y * h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  grain(ctx, w, h, 37, 0.035);
}

/** An abstract flower: rings of soft petals on cream, with a few leaves. */
function bloom(ctx: Ctx, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#f8efe4');
  bg.addColorStop(1, '#f1d6cb');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const petal = (cx: number, cy: number, angle: number, len: number, width: number, color: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2, width / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const leaves: [number, number, number][] = [
    [0.18, 0.78, -0.6],
    [0.82, 0.24, 2.4],
    [0.86, 0.82, -2.3],
    [0.12, 0.2, 0.7],
  ];
  for (const [x, y, a] of leaves) petal(x * w, y * h, a, w * 0.22, w * 0.08, '#8aa982');

  const cx = w * 0.5;
  const cy = h * 0.52;
  const rings: [number, number, number, string, number][] = [
    [12, 0.36, 0.13, 'rgba(233, 138, 126, 0.85)', 0],
    [10, 0.26, 0.11, 'rgba(242, 184, 162, 0.9)', 0.3],
    [8, 0.16, 0.08, 'rgba(217, 84, 79, 0.9)', 0.1],
  ];
  for (const [n, len, width, color, offset] of rings) {
    for (let i = 0; i < n; i++) petal(cx, cy, offset + (i * Math.PI * 2) / n, w * len, w * width, color);
  }
  ctx.fillStyle = '#f4c35a';
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
  const r = rng(41);
  ctx.fillStyle = '#b8642f';
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * w * 0.045;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, w * 0.006, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, w, h, 43, 0.035);
}

/** Speckled terrazzo stone: colorful chips on a warm off-white. */
function terrazzo(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#eee7dc';
  ctx.fillRect(0, 0, w, h);
  const palette = ['#d9794e', '#2f4a5a', '#e4b04a', '#7d9a7a', '#c9b8a3', '#b9523f', '#f7f3ec', '#8c6f5a'];
  const r = rng(53);
  for (let i = 0; i < 260; i++) {
    const x = r() * w;
    const y = r() * h;
    const size = w * (0.008 + r() * r() * 0.05);
    const sides = 4 + Math.floor(r() * 4);
    const rot = r() * Math.PI;
    ctx.fillStyle = palette[Math.floor(r() * palette.length)]!;
    ctx.beginPath();
    for (let k = 0; k < sides; k++) {
      const a = rot + (k / sides) * Math.PI * 2;
      const d = size * (0.6 + r() * 0.5);
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  grain(ctx, w, h, 59, 0.05);
}

const DRAW: Record<SampleId, (ctx: Ctx, w: number, h: number) => void> = { dunes, lagoon, mosaic, aurora, bloom, terrazzo };

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function toBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('sample render failed'))), 'image/jpeg', 0.92),
  );
}

/** Renders a sample and loads it like any photo the user picked. */
export async function loadSample(id: SampleId, canvas: Pick<CanvasSpec, 'width' | 'height'>): Promise<ImageAsset> {
  const c = makeCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('2D canvas not available');
  DRAW[id](ctx, SIZE, SIZE);
  const blob = await toBlob(c);
  const file = new File([blob], `sample-${id}.jpg`, { type: 'image/jpeg' });
  return loadImage(file, maxSideFor(canvas));
}

const thumbs = new Map<SampleId, string>();

/** A small preview for the sample picker (a data URL, cached). */
export function sampleThumbnail(id: SampleId): string {
  const cached = thumbs.get(id);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  DRAW[id](ctx, 160, 160);
  const url = c.toDataURL('image/jpeg', 0.85);
  thumbs.set(id, url);
  return url;
}
