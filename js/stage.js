import { LAYERS } from './layers.js';

const FONT_FAMILY = 'Inter';
const FONT_WEIGHT = 700;
const MAX_FONT_PX = 168;   // CSS px cap for the name on large screens
const SLOW_MS = 50;        // if recomputes are repeatedly slower, halve resolution

// Renders `text` onto `canvas` and re-renders it through a stack of layers.
// The untouched rendering (`source`) is kept so every change recomputes from
// scratch, which makes removing a layer from the middle of the stack trivial.
export function createStage(canvas, text) {
  const ctx = canvas.getContext('2d');
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d', { willReadFrequently: true });

  let w = 0, h = 0;       // backing-store size in device pixels
  let source = null;      // Float32Array ink coverage of the plain name
  let stack = [];         // layer ids, in application order
  let quality = 1;        // 1 = full DPR, 0.5 = reduced (set if too slow)
  let sizeKey = '';       // skips relayout when only the height changed

  function layout() {
    const cssW = canvas.parentElement.clientWidth;
    const scale = Math.min(window.devicePixelRatio || 1, 2) * quality;
    const key = `${cssW}@${scale}`;
    if (!cssW || key === sizeKey) return;
    sizeKey = key;

    // Fit the name to ~86% of the available width (measured at 100px with
    // the same relative letter spacing it is drawn with).
    sctx.font = `${FONT_WEIGHT} 100px ${FONT_FAMILY}`;
    setTracking(100);
    const fontPx = Math.min(MAX_FONT_PX, (cssW * 0.86 * 100) / sctx.measureText(text).width);
    const cssH = Math.round(fontPx * 1.6);

    canvas.style.height = cssH + 'px';
    w = scratch.width = canvas.width = Math.round(cssW * scale);
    h = scratch.height = canvas.height = Math.round(cssH * scale);

    sctx.clearRect(0, 0, w, h);
    sctx.font = `${FONT_WEIGHT} ${fontPx * scale}px ${FONT_FAMILY}`;
    setTracking(fontPx * scale);
    sctx.textAlign = 'center';
    sctx.textBaseline = 'alphabetic';
    sctx.fillStyle = '#000';
    const m = sctx.measureText(text);
    const y = h / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    sctx.fillText(text, w / 2, y);

    // Only alpha matters: it is the antialiased ink coverage in [0, 1].
    const rgba = sctx.getImageData(0, 0, w, h).data;
    source = new Float32Array(w * h);
    for (let i = 0; i < source.length; i++) source[i] = rgba[i * 4 + 3] / 255;

    render();
  }

  function setTracking(px) {
    if ('letterSpacing' in sctx) sctx.letterSpacing = `${-0.02 * px}px`;
  }

  let slowRuns = 0;
  function render() {
    if (!source) return;
    const t0 = performance.now();

    let buf = source;
    for (const id of stack) buf = LAYERS[id].run(buf, w, h);
    paint(buf);

    // A single slow frame is usually JIT warm-up; only downscale if it persists.
    slowRuns = performance.now() - t0 > SLOW_MS ? slowRuns + 1 : 0;
    if (slowRuns >= 3 && quality === 1) {
      quality = 0.5;
      layout();
    }
  }

  // Positive values draw as ink, negative as shadow; the canvas stays
  // transparent so the page background (light or dark) shows through.
  function paint(buf) {
    const styles = getComputedStyle(canvas);
    const ink = parseColor(styles.getPropertyValue('--ink'));
    const shadow = parseColor(styles.getPropertyValue('--shadow'));
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0, j = 0; i < buf.length; i++, j += 4) {
      const v = buf[i];
      const c = v >= 0 ? ink : shadow;
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2];
      d[j + 3] = Math.min(Math.abs(v), 1) * 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  let pending = 0;
  const relayout = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(layout);
  };
  new ResizeObserver(relayout).observe(canvas.parentElement);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  const ready = document.fonts
    .load(`${FONT_WEIGHT} 100px ${FONT_FAMILY}`)
    .catch(() => {})       // draw with the fallback font rather than not at all
    .then(layout);

  return {
    ready,
    setStack(ids) {
      stack = ids.slice();
      render();
    },
  };
}

// '#rrggbb' → [r, g, b]
function parseColor(hex) {
  const n = parseInt(hex.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
