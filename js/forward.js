import { LAYERS } from './layers.js';
import { maxPool, relu } from './conv.js';
import { rasterize } from './raster.js';
import { paint, theme } from './paint.js';
import { drawSweep } from './sweep.js';

// Hand-set weight of the dense layer: each section's logit is this times
// the mean of its own channel's pooled features (a block-diagonal weight
// matrix with zero bias). Not trained; chosen so differences are visible.
const DENSE_WEIGHT = 8;

// The forward pass, animated. The name is rasterized and split into one
// feature map per conv channel. Each channel's kernel flies in and sweeps
// its map (repeats chain conv → ReLU). The maps are max-pooled, flattened
// into one feature vector, and a dense layer + softmax scores each section;
// the page is generated from that, with sections in score order.
//
//   canvas     the name's <canvas>
//   area       viewport rect to lay the feature maps out in
//   channels   [{ id, count, from, section, title }]
//              (from: rect the tile flies from; section: the class it feeds)
//   softmax    whether the network ends in a softmax output layer
//   fly        (id, fromRect, toPoint) => Promise, the automatic drag
//   generate   (point, instant, ranking) => Promise, shows the page growing
//              from point; ranking is section ids, highest score first
//   instant    skip all animation (still computes everything)
//
// Any click or keypress skips to the end.
export async function forwardPass({ canvas, area, channels, softmax, fly, generate, instant }) {
  const ctl = createSkip();
  if (instant) ctl.skip();
  const root = document.createElement('div');
  try {
    const nameRect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1e6 / (nameRect.width * nameRect.height)));
    const src = rasterize(canvas.parentElement, nameRect, scale);
    const colors = theme();
    const input = paint(src.buf, src.w, src.h, colors);

    // Each channel: (conv → ReLU) × count, then max-pool down to a few blocks.
    const maps = channels.map((ch) => {
      let b = src.buf;
      for (let i = 0; i < ch.count; i++) b = relu(LAYERS[ch.id].run(b, src.w, src.h, scale * 2, src.buf));
      const levels = [];
      let lv = { buf: b, w: src.w, h: src.h };
      while (lv.w > 16 && levels.length < 6) levels.push((lv = maxPool(lv.buf, lv.w, lv.h)));
      return { ...ch, out: b, output: paint(b, src.w, src.h, colors), levels, features: lv.buf };
    });
    const head = classify(maps, softmax);

    root.className = 'fp';
    Object.assign(root.style, { left: area.left + 'px', top: area.top + 'px', width: area.width + 'px', height: area.height + 'px' });
    root.setAttribute('aria-hidden', 'true');
    document.body.append(root);
    canvas.parentElement.style.visibility = 'hidden';
    const merge = center(area);

    if (maps.length && !ctl.skipped) {
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
        label.textContent = LAYERS[m.id].label + (m.count > 1 ? ` ×${m.count}` : '') + ' → ReLU';
        m.fig.append(m.cv, label);
        root.append(m.fig);
        m.k = src.w / s.w;
      }
      await Promise.all(maps.map((m, i) => {
        const s = slots[i];
        const dx = nameRect.left - area.left - s.x, dy = nameRect.top - area.top - s.y;
        return ctl.animate(m.fig, [
          { transform: `translate(${dx}px, ${dy}px) scale(${nameRect.width / s.w})`, opacity: i ? 0 : 1 },
          { transform: 'none', opacity: 1 },
        ], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }));

      // Kernels fly in from the network, one per map, all at once.
      if (!ctl.skipped) {
        await ctl.race(Promise.all(maps.map((m) => fly(m.id, m.from, center(m.cv.getBoundingClientRect())))));
      }

      // Sweep every map at once.
      await ctl.frames(900, (p) => {
        for (const m of maps) drawSweep(m.ctx, input, m.output, LAYERS[m.id], p, m.k, colors);
      });

      // Max-pool each map, a level at a time, while the maps shrink.
      for (const m of maps) {
        m.ctx.imageSmoothingEnabled = false;
        m.fig.style.transformOrigin = '50% 50%';   // shrink in place
        ctl.animate(m.fig, [{ transform: 'none' }, { transform: 'scale(0.7)' }], { duration: 900, easing: 'ease-in-out' });
      }
      const steps = Math.max(...maps.map((m) => m.levels.length));
      for (let i = 0; i < steps && !ctl.skipped; i++) {
        for (const m of maps) {
          const lv = m.levels[Math.min(i, m.levels.length - 1)];
          m.ctx.clearRect(0, 0, src.w, src.h);
          m.ctx.drawImage(paint(lv.buf, lv.w, lv.h, colors), 0, 0, src.w, src.h);
        }
        await ctl.wait(900 / steps);
      }

      // Flatten: the pooled maps fly into the middle and become one vector.
      await Promise.all(maps.map((m) => {
        const c = center(m.fig.getBoundingClientRect());
        return ctl.animate(m.fig, [
          { transform: 'scale(0.7)', opacity: 1 },
          { transform: `translate(${merge.x - c.x}px, ${merge.y - c.y}px) scale(0.08)`, opacity: 0 },
        ], { duration: 500, easing: 'cubic-bezier(.6,0,.4,1)' });
      }));
    }

    // Classifier head: flattened features → dense → softmax (or raw logits).
    if (head.length && !ctl.skipped) {
      const panel = headPanel(maps, head, softmax, colors);
      Object.assign(panel.style, { left: merge.x - area.left + 'px', top: merge.y - area.top + 'px' });
      root.append(panel);
      await ctl.animate(panel, [{ transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 }, { transform: 'translate(-50%, -50%)', opacity: 1 }],
        { duration: 250, easing: 'ease-out' });
      await Promise.all([...panel.querySelectorAll('.fp-bar i')].map((bar) =>
        ctl.animate(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 500, easing: 'ease-out' })));
      await ctl.wait(700);
    }

    root.remove();
    canvas.parentElement.style.visibility = '';
    await generate(merge, ctl.skipped, head.map((h) => h.section));
  } finally {
    root.remove();
    canvas.parentElement.style.visibility = '';
    ctl.dispose();
  }
}

// Dense layer + softmax over the pooled features. One class (section) per
// channel. Returns [{ section, title, z, p }] sorted by score, highest first;
// `p` is null when the network has no softmax layer.
function classify(maps, softmax) {
  const rows = maps.map((m) => {
    let sum = 0;
    for (const v of m.features) sum += v;
    return { section: m.section, title: m.title, z: DENSE_WEIGHT * sum / m.features.length, p: null };
  });
  if (softmax && rows.length) {
    const zmax = Math.max(...rows.map((r) => r.z));
    const e = rows.map((r) => Math.exp(r.z - zmax));
    const total = e.reduce((a, b) => a + b, 0);
    rows.forEach((r, i) => (r.p = e[i] / total));
  }
  return rows.sort((a, b) => (b.p ?? b.z) - (a.p ?? a.z));
}

// The head, drawn: a strip of the actual flattened feature values, then a
// bar per class with its probability (or logit).
function headPanel(maps, head, softmax, colors) {
  const panel = document.createElement('div');
  panel.className = 'fp-head';

  const all = maps.flatMap((m) => [...m.features]);
  const n = Math.min(24, all.length);
  const strip = document.createElement('div');
  strip.className = 'fp-flat';
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, all[Math.floor((i * all.length) / n)]);
    const cell = document.createElement('i');
    cell.style.background = `rgba(${colors.ink}, ${0.08 + 0.92 * v})`;
    strip.append(cell);
  }

  const table = document.createElement('div');
  table.className = 'fp-scores';
  const title = document.createElement('p');
  title.textContent = softmax ? 'flatten → dense → softmax' : 'flatten → dense → logits';
  table.append(title);
  const max = Math.max(...head.map((h) => Math.abs(h.p ?? h.z)), 1e-6);
  for (const h of head) {
    const row = document.createElement('div');
    row.className = 'fp-row';
    const name = document.createElement('span');
    name.textContent = h.title;
    const bar = document.createElement('span');
    bar.className = 'fp-bar';
    const fill = document.createElement('i');
    fill.style.width = `${(100 * Math.abs(h.p ?? h.z)) / (h.p != null ? 1 : max)}%`;
    bar.append(fill);
    const val = document.createElement('span');
    val.textContent = (h.p ?? h.z).toFixed(h.p != null ? 3 : 2);
    row.append(name, bar, val);
    table.append(row);
  }
  panel.append(strip, table);
  return panel;
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
    skip: () => skip(),
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
