import { LAYERS } from './layers.js';
import { maxPool } from './conv.js';
import { rasterize } from './raster.js';
import { paint, theme } from './paint.js';
import { drawSweep } from './sweep.js';

// The forward pass, animated. The name is rasterized and split into one
// feature map per conv channel; each channel's kernel flies in and sweeps
// its map (repeats chain the convolution); the maps are max-pooled down to
// a few blocks, merge into one, and the page is generated from it.
//
//   canvas     the name's <canvas>
//   area       viewport rect to lay the feature maps out in
//   channels   [{ id, count, from }]  (from: rect the tile flies from)
//   softmax    whether the network ends in a softmax output layer
//   fly        (id, fromRect, toPoint) => Promise, the automatic drag
//   generate   (point, instant) => Promise, shows the page growing from point
//
// Any click or keypress skips to the end.
export async function forwardPass({ canvas, area, channels, softmax, fly, generate }) {
  const ctl = createSkip();
  const root = document.createElement('div');
  try {
    const nameRect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1e6 / (nameRect.width * nameRect.height)));
    const src = rasterize(canvas.parentElement, nameRect, scale);
    const colors = theme();
    const input = paint(src.buf, src.w, src.h, colors);

    // Each channel's output: its kernel applied `count` times in a row.
    const maps = channels.map((ch) => {
      let b = src.buf;
      for (let i = 0; i < ch.count; i++) b = LAYERS[ch.id].run(b, src.w, src.h, scale * 2, src.buf);
      return { ...ch, out: b, output: paint(b, src.w, src.h, colors) };
    });

    root.className = 'fp';
    Object.assign(root.style, { left: area.left + 'px', top: area.top + 'px', width: area.width + 'px', height: area.height + 'px' });
    root.setAttribute('aria-hidden', 'true');
    document.body.append(root);
    let merge = { x: nameRect.left + nameRect.width / 2, y: nameRect.top + nameRect.height / 2 };

    if (maps.length) {
      // Split: copies of the name move from where it is into a grid.
      const slots = layout(maps.length, area, src.w / src.h);
      for (const [i, m] of maps.entries()) {
        const s = slots[i];
        m.fig = document.createElement('figure');
        m.fig.className = 'fp-map';
        Object.assign(m.fig.style, { left: s.x + 'px', top: s.y + 'px', width: s.w + 'px' });
        m.cv = document.createElement('canvas');
        m.cv.width = src.w;
        m.cv.height = src.h;
        m.ctx = m.cv.getContext('2d');
        m.ctx.drawImage(input, 0, 0);
        const label = document.createElement('figcaption');
        label.textContent = LAYERS[m.id].label + (m.count > 1 ? ` ×${m.count}` : '');
        m.fig.append(m.cv, label);
        root.append(m.fig);
        m.k = src.w / s.w;
      }
      canvas.parentElement.style.visibility = 'hidden';
      await Promise.all(maps.map((m, i) => {
        const s = slots[i];
        const dx = nameRect.left - area.left - s.x, dy = nameRect.top - area.top - s.y;
        return ctl.animate(m.fig, [
          { transform: `translate(${dx}px, ${dy}px) scale(${nameRect.width / s.w})`, opacity: i ? 0 : 1 },
          { transform: 'none', opacity: 1 },
        ], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }));

      // Kernels fly in from the network, one per map, all at once.
      if (!ctl.skipped) {
        await ctl.race(Promise.all(maps.map((m) => fly(m.id, m.from, center(m.cv.getBoundingClientRect())))));
      }

      // Sweep every map at once.
      await ctl.frames(1000, (p) => {
        for (const m of maps) drawSweep(m.ctx, input, m.output, LAYERS[m.id], p, m.k, colors);
      });

      // Max-pool each map, a level at a time, while the maps shrink.
      for (const m of maps) {
        m.levels = [];
        let lv = { buf: m.out, w: src.w, h: src.h };
        while (lv.w > 16 && m.levels.length < 6) m.levels.push((lv = maxPool(lv.buf, lv.w, lv.h)));
        m.ctx.imageSmoothingEnabled = false;
        m.fig.style.transformOrigin = '50% 50%';   // shrink in place
        ctl.animate(m.fig, [{ transform: 'none' }, { transform: 'scale(0.7)' }], { duration: 1100, easing: 'ease-in-out' });
      }
      const steps = Math.max(...maps.map((m) => m.levels.length));
      for (let i = 0; i < steps && !ctl.skipped; i++) {
        for (const m of maps) {
          const lv = m.levels[Math.min(i, m.levels.length - 1)];
          m.ctx.clearRect(0, 0, src.w, src.h);
          m.ctx.drawImage(paint(lv.buf, lv.w, lv.h, colors), 0, 0, src.w, src.h);
        }
        await ctl.wait(1100 / steps);
      }

      // Merge: the pooled maps fly into one block in the middle.
      merge = center(area);
      await Promise.all(maps.map((m) => {
        const r = m.fig.getBoundingClientRect();
        const c = center(r);
        return ctl.animate(m.fig, [
          { transform: 'scale(0.7)', opacity: 1 },
          { transform: `translate(${merge.x - c.x}px, ${merge.y - c.y}px) scale(0.08)`, opacity: 0 },
        ], { duration: 600, easing: 'cubic-bezier(.6,0,.4,1)' });
      }));
    }

    const block = document.createElement('div');
    block.className = 'fp-merged';
    Object.assign(block.style, { left: merge.x - area.left + 'px', top: merge.y - area.top + 'px' });
    root.append(block);
    canvas.parentElement.style.visibility = 'hidden';
    await ctl.animate(block, [{ transform: 'translate(-50%, -50%) scale(0)' }, { transform: 'translate(-50%, -50%) scale(1)' }],
      { duration: 250, easing: 'ease-out' });
    if (softmax) {
      block.classList.add('fp-softmax');
      await ctl.animate(block, [{ boxShadow: '0 0 0 0 var(--ink)' }, { boxShadow: '0 0 0 14px transparent' }], { duration: 500 });
    }

    root.remove();
    canvas.parentElement.style.visibility = '';
    await generate(merge, ctl.skipped);
  } finally {
    root.remove();
    canvas.parentElement.style.visibility = '';
    ctl.dispose();
  }
}

// Lay out n maps of aspect `ar` (w/h) in a centred grid inside `area`.
function layout(n, area, ar) {
  const gap = 20, label = 22;
  const cols = area.width < 600 ? 1 : Math.min(n, 2);
  const rows = Math.ceil(n / cols);
  const fitW = (area.width - gap * (cols - 1)) / cols;
  const fitH = (area.height * 0.85 - (rows - 1) * gap) / rows - label;
  const w = Math.min(fitW, fitH * ar, n === 1 ? 680 : 520);
  const h = w / ar + label;
  const totalH = rows * h + (rows - 1) * gap;
  const y0 = (area.height - totalH) / 2;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const x0 = (area.width - (inRow * w + (inRow - 1) * gap)) / 2;
    return { x: x0 + (i % cols) * (w + gap), y: y0 + r * (h + gap), w };
  });
}

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// Skipping: a click or keypress finishes every running animation and makes
// every pending wait resolve immediately.
function createSkip() {
  const anims = new Set();
  const waiters = new Set();
  const ctl = {
    skipped: false,
    animate(el, frames, opts) {
      const a = el.animate(frames, { fill: 'forwards', ...opts });
      anims.add(a);
      if (ctl.skipped) a.finish();
      return a.finished.catch(() => {});
    },
    wait(ms) {
      if (ctl.skipped) return Promise.resolve();
      return new Promise((resolve) => {
        const t = setTimeout(done, ms);
        function done() { clearTimeout(t); waiters.delete(done); resolve(); }
        waiters.add(done);
      });
    },
    race(promise) {
      return Promise.race([promise, new Promise((r) => (ctl.skipped ? r() : waiters.add(r)))]);
    },
    frames(ms, draw) {
      return new Promise((resolve) => {
        const t0 = performance.now();
        const tick = (now) => {
          const p = ctl.skipped ? 1 : Math.min(1, (now - t0) / ms);
          draw(p);
          if (p < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    },
    dispose() {
      window.removeEventListener('pointerdown', skip, true);
      window.removeEventListener('keydown', skip, true);
    },
  };
  function skip() {
    ctl.skipped = true;
    for (const a of anims) a.finish();
    for (const w of [...waiters]) w();
  }
  window.addEventListener('pointerdown', skip, true);
  window.addEventListener('keydown', skip, true);
  return ctl;
}
