import { theme } from './paint.js';

// Plays a convolution over the viewport rectangle `r`. A 3×3 window showing
// the kernel's weights steps across in raster order. Ahead of it, `input` (a
// picture of what was on screen, covering `srcRect`) is still shown; inside
// the window you see `output`, the input convolved with the kernel; behind
// it the overlay is clear so the new page underneath shows through.
//
// `onFrame(edge)` is called every frame with the swept boundary in viewport
// coordinates ({ left, right, top, cx, bottom }) so the caller can clip the
// new page to it. Resolves when done; any click or keypress skips to the end.
export function sweep(r, srcRect, input, output, layer, duration, onFrame) {
  const k = input.width / srcRect.width;     // device px per CSS px
  const cv = document.createElement('canvas');
  cv.className = 'sweep';
  cv.width = Math.round(r.width * k);
  cv.height = Math.round(r.height * k);
  Object.assign(cv.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);

  const ctx = cv.getContext('2d');
  const ox = srcRect.left - r.left, oy = srcRect.top - r.top;   // input offset, CSS px
  const { ink, bg } = theme();

  // Window size: a handful of bands over the region, cells in whole px.
  const bands = Math.min(9, Math.max(3, Math.round(r.height / 90)));
  const cell = Math.max(16, Math.round(r.height / bands / 3));
  const win = cell * 3;
  const rows = Math.ceil(r.height / win);
  const cols = Math.ceil(r.width / cell);

  function frame(p) {
    const pos = Math.min(p, 0.99999) * rows;
    const band = Math.floor(pos);
    const col = Math.floor((pos - band) * cols);
    const cx = p < 1 ? (col + 0.5) * cell : r.width;   // window centre, CSS px
    const top = p < 1 ? Math.min(band * win, r.height - win) : r.height;

    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    // Not yet convolved: the old picture, right of / below the window centre.
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, top, r.width - cx, win);
    ctx.rect(0, top + win, r.width, r.height);
    ctx.clip();
    ctx.drawImage(input, ox, oy, srcRect.width, srcRect.height);
    ctx.restore();

    if (p < 1) drawWindow(Math.min(Math.max(cx - win / 2, 0), r.width - win), top);
    onFrame({ left: r.left, right: r.right, top: r.top + top, cx: r.left + cx, bottom: r.top + top + win });
  }

  // The window: the convolution output under it, then the grid and weights.
  function drawWindow(x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, win, win);
    ctx.clip();
    ctx.fillStyle = `rgb(${bg})`;
    ctx.fillRect(x, y, win, win);
    ctx.drawImage(output, ox, oy, srcRect.width, srcRect.height);
    ctx.fillStyle = `rgba(${bg}, 0.35)`;
    ctx.fillRect(x, y, win, win);
    ctx.restore();

    ctx.strokeStyle = `rgb(${ink})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      ctx.moveTo(x + i * cell, y); ctx.lineTo(x + i * cell, y + win);
      ctx.moveTo(x, y + i * cell); ctx.lineTo(x + win, y + i * cell);
    }
    ctx.stroke();
    ctx.fillStyle = `rgb(${ink})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (layer.kernel) {
      ctx.font = `${Math.min(13, cell * 0.45)}px ui-monospace, Menlo, monospace`;
      layer.kernel.forEach((v, i) => {
        ctx.fillText(String(v), x + (i % 3 + 0.5) * cell, y + (Math.floor(i / 3) + 0.5) * cell);
      });
    } else {
      ctx.font = `${cell * 1.2}px ui-serif, Georgia, serif`;
      ctx.fillText('σ', x + win / 2, y + win / 2);
    }
  }

  let skip = false;
  const onSkip = () => { skip = true; };
  window.addEventListener('pointerdown', onSkip, true);
  window.addEventListener('keydown', onSkip, true);

  frame(0);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const p = skip ? 1 : Math.min(1, (now - t0) / duration);
      frame(p);
      if (p < 1) return requestAnimationFrame(tick);
      window.removeEventListener('pointerdown', onSkip, true);
      window.removeEventListener('keydown', onSkip, true);
      cv.remove();
      resolve();
    };
    requestAnimationFrame(tick);
  });
}
