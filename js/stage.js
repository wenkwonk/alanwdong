const FONT_FAMILY = 'Inter';
const FONT_WEIGHT = 700;
const MAX_FONT_PX = 168;   // CSS px cap for the name on large screens

// Draws `text` crisply on `canvas`, sized to its container, at the screen's
// pixel density. Redraws on resize and when the color scheme changes.
// Returns a promise that resolves once the font has loaded and it has drawn.
export function createStage(canvas, text) {
  const ctx = canvas.getContext('2d');
  let sizeKey = '';   // skips redraws when only the height changed

  function draw(force) {
    const cssW = canvas.parentElement.clientWidth;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${cssW}@${scale}`;
    if (!cssW || (key === sizeKey && !force)) return;
    sizeKey = key;

    // Fit the name to ~86% of the width (measured at 100px with the same
    // relative letter spacing it is drawn with).
    ctx.font = `${FONT_WEIGHT} 100px ${FONT_FAMILY}`;
    setTracking(100);
    const fontPx = Math.min(MAX_FONT_PX, (cssW * 0.86 * 100) / ctx.measureText(text).width);
    const cssH = Math.round(fontPx * 1.6);
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * scale);
    canvas.height = Math.round(cssH * scale);

    ctx.font = `${FONT_WEIGHT} ${fontPx * scale}px ${FONT_FAMILY}`;
    setTracking(fontPx * scale);
    ctx.textAlign = 'center';
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--ink');
    const m = ctx.measureText(text);
    const y = canvas.height / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(text, canvas.width / 2, y);
  }

  function setTracking(fontSize) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.02 * fontSize}px`;
  }

  let pending = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => draw(false));
  }).observe(canvas.parentElement);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => draw(true));

  return document.fonts
    .load(`${FONT_WEIGHT} 100px ${FONT_FAMILY}`)
    .catch(() => {})       // draw with the fallback font rather than not at all
    .then(() => draw(true));
}
