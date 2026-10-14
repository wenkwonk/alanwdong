// Pure image math on single-channel Float32Array buffers (row-major, w × h).
// Values are ink intensity: 0 = background, 1 = full ink. Layers may push
// values negative (rendered as shadow) or above 1 (clamped when drawn).

// 3×3 convolution. `k` is 9 numbers, row-major. Out-of-bounds pixels are
// handled by clamping coordinates to the nearest edge.
export function convolve(src, w, h, k) {
  const out = new Float32Array(w * h);
  const [k0, k1, k2, k3, k4, k5, k6, k7, k8] = k;
  for (let y = 0; y < h; y++) {
    const r0 = (y > 0 ? y - 1 : 0) * w;
    const r1 = y * w;
    const r2 = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < w - 1 ? x + 1 : w - 1;
      out[r1 + x] =
        k0 * src[r0 + xm] + k1 * src[r0 + x] + k2 * src[r0 + xp] +
        k3 * src[r1 + xm] + k4 * src[r1 + x] + k5 * src[r1 + xp] +
        k6 * src[r2 + xm] + k7 * src[r2 + x] + k8 * src[r2 + xp];
    }
  }
  return out;
}

export const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
export const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

// Gradient magnitude from the two Sobel kernels, normalized to [0, 1].
// Equivalent to hypot(convolve(SOBEL_X), convolve(SOBEL_Y)), fused into one
// pass so the hot path makes no intermediate buffers.
export function sobel(src, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const r0 = (y > 0 ? y - 1 : 0) * w;
    const r1 = y * w;
    const r2 = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < w - 1 ? x + 1 : w - 1;
      const a = src[r0 + xm], b = src[r0 + x], c = src[r0 + xp];
      const d = src[r1 + xm], f = src[r1 + xp];
      const g = src[r2 + xm], i = src[r2 + x], j = src[r2 + xp];
      const gx = c + 2 * f + j - a - 2 * d - g;
      const gy = g + 2 * i + j - a - 2 * b - c;
      out[r1 + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return normalizeMax(out);
}

// Scale so the largest value is 1 (no-op on an empty buffer).
export function normalizeMax(buf) {
  let max = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] > max) max = buf[i];
  if (max > 1e-6) for (let i = 0; i < buf.length; i++) buf[i] /= max;
  return buf;
}

export const GAUSSIAN = [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v / 16);
export const SHARPEN = [0, -1, 0, -1, 5, -1, 0, -1, 0];
export const EMBOSS = [-2, -1, 0, -1, 1, 1, 0, 1, 2];

// Box-average down by an integer factor `f`. Returns { buf, w, h }.
export function downsample(src, w, h, f) {
  const sw = Math.ceil(w / f), sh = Math.ceil(h / f);
  const out = new Float32Array(sw * sh);
  const cnt = new Float32Array(sw * sh);
  for (let y = 0; y < h; y++) {
    const row = ((y / f) | 0) * sw;
    for (let x = 0; x < w; x++) {
      const i = row + ((x / f) | 0);
      out[i] += src[y * w + x];
      cnt[i]++;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] /= cnt[i];
  return { buf: out, w: sw, h: sh };
}

// Bilinear resize of a small buffer back up to w × h.
export function upsample(small, w, h) {
  const { buf: src, w: sw, h: sh } = small;
  const out = new Float32Array(w * h);
  const fx = sw / w, fy = sh / h;
  for (let y = 0; y < h; y++) {
    const sy = Math.max(0, (y + 0.5) * fy - 0.5);
    const y0 = Math.min(sh - 1, sy | 0), y1 = Math.min(sh - 1, y0 + 1), ty = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.max(0, (x + 0.5) * fx - 0.5);
      const x0 = Math.min(sw - 1, sx | 0), x1 = Math.min(sw - 1, x0 + 1), tx = sx - x0;
      const top = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx;
      const bot = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx;
      out[y * w + x] = top * (1 - ty) + bot * ty;
    }
  }
  return out;
}

// Apply each kernel in `kernels` in turn on a copy downsampled by `f`, then
// scale the result back up. Lets 3×3 kernels act at a visible radius on HiDPI
// canvases.
export function convolveAtScale(src, w, h, f, ...kernels) {
  const small = downsample(src, w, h, f);
  for (const k of kernels) small.buf = convolve(small.buf, small.w, small.h, k);
  return upsample(small, w, h);
}
