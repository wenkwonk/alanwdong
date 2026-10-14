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
