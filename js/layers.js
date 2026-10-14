import { sobel } from './conv.js';

// Every tile is one entry here. `run(x, w, h)` receives the current image
// (output of the previous layer) and returns the next one. Layers are
// residual: they combine their convolution with the input instead of
// replacing it, so stacking builds the look up rather than eroding it.
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
};
