import { sobel, convolveAtScale, GAUSSIAN, SHARPEN, EMBOSS, SOBEL_X } from './conv.js';

const G = GAUSSIAN;
// A kernel minus the identity: what the kernel adds on top of its input.
const minusIdentity = (k) => k.map((v, i) => (i === 4 ? v - 1 : v));
const SHARPEN_DETAIL = minusIdentity(SHARPEN);  // the Laplacian
const EMBOSS_RELIEF = minusIdentity(EMBOSS);    // directional relief

const tap = (f, k) => Math.max(1, Math.round(k * f));

// Every tile is one entry here.
//   label    shown on the tile and in the layer chips
//   kernel   the 3×3 weights drawn on the tile and in the sweep window
//            (layers without one show `formula` instead)
//   divisor  shown as "÷n" when the weights are scaled
//   output   marks the softmax output layer (no kernel, no `run`)
//   run(x, w, h, f, src)
//            convolves image `x` (w × h ink values) and returns the result.
//            `f` is the feature size in pixels: big text (the name) gets a
//            larger f than body text so every effect reads at either size.
//            Kernels act at that scale by running on a pooled copy, like a
//            CNN layer on a downsampled feature map.
//
// Layers are residual: they combine their output with the input, so the
// content underneath stays legible. Which section a tile reveals is set in
// content.js (`layer`).
export const LAYERS = {
  edges: {
    label: 'conv · edges',
    kernel: SOBEL_X,
    run(x, w, h) {
      // Sobel x and y (y is x transposed), magnitude, over a dimmed input.
      const e = sobel(x, w, h);
      for (let i = 0; i < e.length; i++) e[i] = Math.max(0.18 * x[i], e[i]);
      return e;
    },
  },

  blur: {
    label: 'conv · blur',
    kernel: [1, 2, 1, 2, 4, 2, 1, 2, 1],
    divisor: 16,
    run(x, w, h, f) {
      // The Gaussian kernel, applied three times on the pooled map.
      const b = convolveAtScale(x, w, h, tap(f, 1.5), G, G, G);
      for (let i = 0; i < b.length; i++) b[i] = 0.25 * x[i] + 0.9 * b[i];
      return b;
    },
  },

  sharpen: {
    label: 'conv · sharpen',
    kernel: SHARPEN,
    run(x, w, h, f) {
      // sharpen = identity + Laplacian. Add the Laplacian (from the pooled
      // map, so it is smooth when scaled back up) to the full-res input.
      // Overshoot outside strokes goes negative and draws as a shadow ring.
      const d = convolveAtScale(x, w, h, tap(f, 1), G, SHARPEN_DETAIL);
      for (let i = 0; i < d.length; i++) d[i] = x[i] + 2.5 * d[i];
      return d;
    },
  },

  emboss: {
    label: 'conv · emboss',
    kernel: EMBOSS,
    run(x, w, h, f) {
      // Smooth, take the emboss relief, smooth again, add it as a bevel.
      const r = convolveAtScale(x, w, h, tap(f, 1), G, G, EMBOSS_RELIEF, G);
      for (let i = 0; i < r.length; i++) r[i] = x[i] + 1.1 * r[i];
      return r;
    },
  },

  softmax: {
    label: 'output · softmax',
    output: true,
    formula: 'eᶻ/Σeᶻ',
    // Not a kernel: the output layer. It turns the dense layer's scores into
    // probabilities at the end of the forward pass (see forward.js).
  },
};
