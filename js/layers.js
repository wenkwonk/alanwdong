import { sobel, convolveAtScale, GAUSSIAN, EMBOSS } from './conv.js';

const G = GAUSSIAN;
// EMBOSS minus the identity kernel: the emboss without the input added back,
// i.e. pure directional relief (lit from the top-left).
const RELIEF = EMBOSS.map((v, i) => (i === 4 ? v - 1 : v));

// Every tile is one entry here. `run(x, w, h, s)` receives the current image
// (output of the previous layer), its size, and `s` = device pixels per CSS
// pixel, and returns the next image. Layers are residual: they combine their
// convolution with the input instead of replacing it, so stacking builds the
// look up rather than eroding it.
//
// `section` is the content section the tile reveals (see content.js); each
// repeat of the tile reveals that section in more depth.
// `output: true` marks a final stage that always runs after every conv layer.
export const LAYERS = {
  edges: {
    label: 'conv · edges',
    section: 'projects',
    run(x, w, h) {
      const e = sobel(x, w, h);
      // Full-strength outline over a dimmed copy of the input.
      for (let i = 0; i < e.length; i++) e[i] = Math.max(0.18 * x[i], e[i]);
      return e;
    },
  },

  blur: {
    label: 'conv · blur',
    section: 'skills',
    run(x, w, h, s) {
      // Gaussian at ~3 CSS px per sample, 4 passes: a soft focus with a halo.
      const b = convolveAtScale(x, w, h, Math.round(3 * s), G, G, G, G);
      for (let i = 0; i < b.length; i++) b[i] = 0.3 * x[i] + 0.95 * b[i];
      return b;
    },
  },

  sharpen: {
    label: 'conv · sharpen',
    section: 'experience',
    run(x, w, h, s) {
      // Unsharp mask: add back (input − Gaussian), i.e. the high-frequency
      // detail. Overshoot outside the letters goes negative and draws as a
      // shadow ring; inside it pushes past full ink.
      const b = convolveAtScale(x, w, h, Math.round(4 * s), G, G);
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) out[i] = x[i] + 2.2 * (x[i] - b[i]);
      return out;
    },
  },

  emboss: {
    label: 'conv · emboss',
    section: 'awards',
    run(x, w, h, s) {
      // Smooth, take the emboss relief, smooth again, then add it to the
      // input as a bevel.
      const r = convolveAtScale(x, w, h, Math.round(2 * s), G, G, G, RELIEF, G);
      for (let i = 0; i < r.length; i++) r[i] = x[i] + 1.1 * r[i];
      return r;
    },
  },

  softmax: {
    label: 'output · softmax',
    section: 'contact',
    output: true,
    // Not a kernel: restores the crisp name on top of whatever the network
    // did, with a soft glow. `src` is the untouched rendering.
    run(x, w, h, s, src) {
      const glow = convolveAtScale(src, w, h, Math.round(4 * s), G, G, G, G);
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        out[i] = Math.max(0.35 * x[i] + 0.5 * glow[i], src[i]);
      }
      return out;
    },
  },
};
