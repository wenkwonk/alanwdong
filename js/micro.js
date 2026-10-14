import { paint, theme } from './paint.js';

const MAX_W = 520;   // CSS px

// Draws the micrograph onto `canvas` in the site's ink colours, the same way
// the name is drawn: dark parts of the image are "ink", so it reads correctly
// in both light and dark mode. Sized to its container; redraws on resize and
// when the colour scheme changes.
export function createMicrograph(canvas, src) {
  const img = new Image();
  img.src = src;
  let key = '';

  function draw(force) {
    if (!img.complete || !img.naturalWidth) return;
    const cssW = Math.min(MAX_W, canvas.parentElement.clientWidth);
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const k = `${cssW}@${scale}`;
    if (!cssW || (k === key && !force)) return;
    key = k;
    const w = Math.round(cssW * scale);
    const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
    canvas.style.width = cssW + 'px';
    canvas.style.height = h / scale + 'px';
    canvas.width = w;
    canvas.height = h;

    // Luminance → ink (1 = darkest), then paint in theme colours.
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const t = tmp.getContext('2d', { willReadFrequently: true });
    t.drawImage(img, 0, 0, w, h);
    const px = t.getImageData(0, 0, w, h).data;
    const ink = new Float32Array(w * h);
    for (let i = 0, j = 0; i < ink.length; i++, j += 4) ink[i] = 1 - px[j] / 255;
    canvas.getContext('2d').drawImage(paint(ink, w, h, theme()), 0, 0);
  }

  img.addEventListener('load', () => draw(true));
  new ResizeObserver(() => draw(false)).observe(canvas.parentElement);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => draw(true));
  return { redraw: () => draw(true) };
}
