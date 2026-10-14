import { LAYERS } from './layers.js';
import { maxPool, relu } from './conv.js';
import { rasterize } from './raster.js';
import { paint, theme } from './paint.js';
import { drawSweep } from './sweep.js';

// Hand-set weight of the dense layer: each section's logit is this times
// the mean of the pooled features from its own kernel's layers (a sparse,
// block-structured weight matrix with zero bias). Not trained.
const DENSE_WEIGHT = 8;

// The forward pass, animated. The layers run in sequence: the name is the
// input to layer 1, and every layer convolves the previous layer's output
// (conv → ReLU). Each layer's output appears as a feature map next to the
// last; its kernel flies in from the network and sweeps across. Every
// layer's output is then max-pooled and concatenated (a skip-connection /
// hypercolumn head), a dense layer + softmax scores each section, and the
// page is generated with sections in score order.
//
//   canvas     the name's <canvas>
//   area       viewport rect to lay the feature maps out in
//   layers     [{ id, from }] conv layers in order (from: rect the tile
//              flies from)
//   classes    [{ id, section, title }] one per kernel type: the section it
//              scores, read from that kernel's layers
//   softmax    whether the network ends in a softmax output layer
//   fly        (id, fromRect, toPoint, ms) => Promise, the automatic drag
//   generate   (point, instant, ranking) => Promise, shows the page growing
//              from point; ranking is section ids, highest score first
//   instant    skip all animation (still computes everything)
//
// Any click or keypress skips to the end.
export async function forwardPass({ canvas, area, layers, classes, softmax, fly, generate, instant }) {
  const ctl = createSkip();
  if (instant) ctl.skip();
  const root = document.createElement('div');
  try {
    const nameRect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1e6 / (nameRect.width * nameRect.height)));
    const src = rasterize(canvas.parentElement, nameRect, scale);
    const colors = theme();
    const inputImg = paint(src.buf, src.w, src.h, colors);

    // Compute the whole pass up front: layer i's input is layer i-1's output.
    const maps = [];
    let prev = src.buf;
    for (const L of layers) {
      const out = relu(LAYERS[L.id].run(prev, src.w, src.h, scale * 2, src.buf));
      const levels = [];
      let lv = { buf: out, w: src.w, h: src.h };
      while (lv.w > 16 && levels.length < 6) levels.push((lv = maxPool(lv.buf, lv.w, lv.h)));
      maps.push({ ...L, out, output: paint(out, src.w, src.h, colors), levels, features: lv.buf });
      prev = out;
    }
    maps.forEach((m, i) => (m.input = i ? maps[i - 1].output : inputImg));
    const head = classify(classes, maps, softmax);

    root.className = 'fp';
    Object.assign(root.style, { left: area.left + 'px', top: area.top + 'px', width: area.width + 'px', height: area.height + 'px' });
    root.setAttribute('aria-hidden', 'true');
    document.body.append(root);
    canvas.parentElement.style.visibility = 'hidden';
    const merge = center(area);
    const cards = [];

    if (maps.length && !ctl.skipped) {
      const ar = src.w / src.h;
      const slots = layout(maps.length + 1, area, ar);
      const card = (slot, text, img) => {
        const fig = document.createElement('figure');
        fig.className = 'fp-map';
        Object.assign(fig.style, { left: slot.x + 'px', top: slot.y + 'px', width: slot.w + 'px' });
        const cv = document.createElement('canvas');
        cv.width = src.w;
        cv.height = src.h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const label = document.createElement('figcaption');
        label.textContent = text;
        fig.append(cv, label);
        root.append(fig);
        const c = { fig, cv, ctx, k: src.w / slot.w };
        cards.push(c);
        return c;
      };

      // The name moves into the first slot: the network's input.
      const first = card(slots[0], 'input', inputImg);
      const s0 = slots[0];
      await ctl.animate(first.fig, [
        { transform: `translate(${nameRect.left - area.left - s0.x}px, ${nameRect.top - area.top - s0.y}px) scale(${nameRect.width / s0.w})` },
        { transform: 'none' },
      ], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });

      // Each layer in turn: a copy of the previous map slides into the next
      // slot, the kernel flies onto it, and the sweep convolves it.
      for (const [i, m] of maps.entries()) {
        const s = slots[i + 1], p = slots[i];
        m.card = card(s, `${i + 1} · ${LAYERS[m.id].label} → ReLU`, m.input);
        ctl.animate(m.card.fig, [
          { transform: `translate(${p.x - s.x}px, ${p.y - s.y}px)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
        if (!ctl.skipped) {
          const target = { x: area.left + s.x + s.w / 2, y: area.top + s.y + s.w / ar / 2 };
          await ctl.race(fly(m.id, m.from, target, 450));
        }
        await ctl.frames(450, (t) => drawSweep(m.card.ctx, m.input, m.output, LAYERS[m.id], t, m.card.k, colors));
      }

      // Max-pool every layer's output at once while the maps shrink; the
      // input map, which isn't pooled, fades.
      ctl.animate(first.fig, [{ opacity: 1 }, { opacity: 0.25 }], { duration: 300 });
      for (const m of maps) {
        m.card.ctx.imageSmoothingEnabled = false;
        m.card.fig.style.transformOrigin = '50% 50%';   // shrink in place
        ctl.animate(m.card.fig, [{ transform: 'none' }, { transform: 'scale(0.7)' }], { duration: 700, easing: 'ease-in-out' });
      }
      const steps = Math.max(...maps.map((m) => m.levels.length));
      for (let i = 0; i < steps && !ctl.skipped; i++) {
        for (const m of maps) {
          const lv = m.levels[Math.min(i, m.levels.length - 1)];
          m.card.ctx.clearRect(0, 0, src.w, src.h);
          m.card.ctx.drawImage(paint(lv.buf, lv.w, lv.h, colors), 0, 0, src.w, src.h);
        }
        await ctl.wait(700 / steps);
      }

      // Concatenate: every map flies into the middle.
      await Promise.all(cards.map((c) => {
        const r = c.fig.getBoundingClientRect();
        const from = getComputedStyle(c.fig).transform;
        return ctl.animate(c.fig, [
          { transform: from === 'none' ? 'none' : from, opacity: getComputedStyle(c.fig).opacity },
          { transform: `translate(${merge.x - center(r).x}px, ${merge.y - center(r).y}px) scale(0.08)`, opacity: 0 },
        ], { duration: 500, easing: 'cubic-bezier(.6,0,.4,1)' });
      }));
    }

    // Classifier head: concatenated features → dense → softmax (or logits).
    if (head.length && !ctl.skipped) {
      const panel = headPanel(maps, head, softmax, colors);
      Object.assign(panel.style, { left: merge.x - area.left + 'px', top: merge.y - area.top + 'px' });
      root.append(panel);
      await ctl.animate(panel, [{ transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 }, { transform: 'translate(-50%, -50%)', opacity: 1 }],
        { duration: 250, easing: 'ease-out' });
      await Promise.all([...panel.querySelectorAll('.fp-bar i')].map((bar) =>
        ctl.animate(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 500, easing: 'ease-out' })));
      await ctl.wait(600);
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

// Dense layer + softmax over the concatenated pooled features. One class
// (section) per kernel type, reading the features of that kernel's layers.
// Returns [{ section, title, z, p }] sorted by score, highest first; `p` is
// null when the network has no softmax layer.
function classify(classes, maps, softmax) {
  const rows = classes.map((c) => {
    let sum = 0, n = 0;
    for (const m of maps) {
      if (m.id !== c.id) continue;
      for (const v of m.features) sum += v;
      n += m.features.length;
    }
    return { section: c.section, title: c.title, z: DENSE_WEIGHT * sum / Math.max(1, n), p: null };
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

// Lay out n maps of aspect `ar` (w/h) in a centred grid inside `area`,
// read left to right, top to bottom.
function layout(n, area, ar) {
  const gap = 20, label = 22;
  const cols = area.width < 600 ? (n <= 3 ? 1 : 2) : n <= 2 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const fitW = (area.width - gap * (cols - 1)) / cols;
  const fitH = (area.height * 0.85 - (rows - 1) * gap) / rows - label;
  const w = Math.min(fitW, fitH * ar, 520);
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
