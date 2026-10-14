import { LAYERS } from './layers.js';
import { maxPool, relu } from './conv.js';
import { rasterize } from './raster.js';
import { paint, theme } from './paint.js';
import { drawSweep } from './sweep.js';

// Hand-set weight of the dense layer: each section's logit is this times
// the mean of the pooled features from the last-layer maps its kernel
// produced (a sparse, block-structured weight matrix with zero bias).
// Not trained.
const DENSE_WEIGHT = 8;
const SVG = 'http://www.w3.org/2000/svg';

// The forward pass, animated. Layers run in sequence and each has one or
// more filters. A filter convolves *every* map from the previous layer with
// its 3×3 kernel and sums the results with equal weights, then ReLU: a real
// multi-channel convolution whose weight tensor is hand-set (the same kernel
// for each input channel, scaled by 1/inputs). Layer 1's only input is the
// name. The last layer's maps are then max-pooled and flattened, a dense
// layer + softmax scores each section, and the page is generated with
// sections in score order.
//
//   canvas     the name's <canvas>
//   area       viewport rect to lay the feature maps out in
//   net        [[{ id, from }, …], …] filters per layer, in order
//              (from: rect the tile flies from)
//   classes    [{ id, section, title }] one per kernel type
//   softmax    whether the network ends in a softmax output layer
//   fly        (id, fromRect, toPoint, ms) => Promise, the automatic drag
//   generate   (point, instant, ranking) => Promise, shows the page growing
//              from point; ranking is section ids, highest score first
//   instant    skip all animation (still computes everything)
//
// Any click or keypress skips to the end.
export async function forwardPass({ canvas, area, net, classes, softmax, fly, generate, instant }) {
  const ctl = createSkip();
  if (instant) ctl.skip();
  const root = document.createElement('div');
  try {
    const nameRect = canvas.getBoundingClientRect();
    // The maps are shown small, so compute at modest resolution.
    const scale = Math.min(window.devicePixelRatio || 1, 2, 720 / nameRect.width);
    const src = rasterize(canvas.parentElement, nameRect, scale);
    const N = src.w * src.h;
    const colors = theme();
    const inputImg = paint(src.buf, src.w, src.h, colors);

    // Compute the whole pass up front.
    const columns = [];   // per layer: { input (image of the mean input), maps }
    const maps = [];      // every filter's output, all layers
    let prev = [src.buf];
    for (const filters of net) {
      const mean = new Float32Array(N);
      for (const inp of prev) for (let i = 0; i < N; i++) mean[i] += inp[i] / prev.length;
      const col = { input: prev.length === 1 ? inputImg : paint(mean, src.w, src.h, colors), maps: [] };
      for (const f of filters) {
        const out = new Float32Array(N);
        for (const inp of prev) {
          const o = LAYERS[f.id].run(inp, src.w, src.h, scale * 2, src.buf);
          for (let i = 0; i < N; i++) out[i] += o[i] / prev.length;
        }
        relu(out);
        const levels = [];
        let lv = { buf: out, w: src.w, h: src.h };
        while (lv.w > 16 && levels.length < 5) levels.push((lv = maxPool(lv.buf, lv.w, lv.h)));
        const m = { ...f, out, output: paint(out, src.w, src.h, colors), levels, features: lv.buf };
        col.maps.push(m);
        maps.push(m);
      }
      columns.push(col);
      prev = col.maps.map((m) => m.out);
    }
    // Only the last layer feeds the head, as in a standard CNN.
    const last = columns.length ? columns[columns.length - 1].maps : [];
    const head = classify(classes, last, softmax);

    root.className = 'fp';
    Object.assign(root.style, { left: area.left + 'px', top: area.top + 'px', width: area.width + 'px', height: area.height + 'px' });
    root.setAttribute('aria-hidden', 'true');
    document.body.append(root);
    canvas.parentElement.style.visibility = 'hidden';
    const merge = center(area);
    const cards = [];

    if (maps.length && !ctl.skipped) {
      const ar = src.w / src.h;
      const grid = layout([1, ...columns.map((c) => c.maps.length)], area, ar);
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('class', 'fp-links');
      svg.setAttribute('width', area.width);
      svg.setAttribute('height', area.height);
      root.append(svg);

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
        const c = { fig, cv, ctx, k: src.w / slot.w, slot };
        cards.push(c);
        return c;
      };

      // The name moves into the input slot.
      const s0 = grid[0][0];
      const first = card(s0, 'input', inputImg);
      await ctl.animate(first.fig, [
        { transform: `translate(${nameRect.left - area.left - s0.x}px, ${nameRect.top - area.top - s0.y}px) scale(${nameRect.width / s0.w})` },
        { transform: 'none' },
      ], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });

      // Layer by layer: every filter's map appears, wired to every map of
      // the previous layer; the kernels fly in and all sweep at once.
      let prevCards = [first];
      for (const [li, col] of columns.entries()) {
        const slots = grid[li + 1];
        const lines = [];
        for (const [fi, m] of col.maps.entries()) {
          const s = slots[fi];
          m.card = card(s, `L${li + 1} · ${LAYERS[m.id].label.split(' · ')[1]}`, col.input);
          for (const pc of prevCards) lines.push(link(svg, pc.slot, s, ar, area.width < 600));
          const from = prevCards[0].slot;
          ctl.animate(m.card.fig, [
            { transform: `translate(${from.x - s.x}px, ${from.y - s.y}px)`, opacity: 0 },
            { transform: 'none', opacity: 1 },
          ], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
        for (const l of lines) ctl.animate(l, [{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
        if (!ctl.skipped) {
          await ctl.race(Promise.all(col.maps.map((m) => fly(m.id, m.from,
            { x: area.left + m.card.slot.x + m.card.slot.w / 2, y: area.top + m.card.slot.y + m.card.slot.w / ar / 2 }, 450))));
        }
        await ctl.frames(450, (t) => {
          for (const m of col.maps) drawSweep(m.card.ctx, col.input, m.output, LAYERS[m.id], t, m.card.k, colors);
        });
        prevCards = col.maps.map((m) => m.card);
      }

      // The head reads only the last layer: everything before it dims.
      const lastCards = last.map((m) => m.card);
      for (const c of cards) {
        if (!lastCards.includes(c)) ctl.animate(c.fig, [{ opacity: 1 }, { opacity: 0.15 }], { duration: 300 });
      }
      ctl.animate(svg, [{ opacity: 1 }, { opacity: 0.15 }], { duration: 300 });

      // Max-pool the last layer's maps in place, a level at a time.
      for (const m of last) {
        m.card.ctx.imageSmoothingEnabled = false;
        m.card.fig.style.transformOrigin = '50% 50%';
        ctl.animate(m.card.fig, [{ transform: 'none' }, { transform: 'scale(0.85)' }], { duration: 700, easing: 'ease-in-out' });
      }
      const steps = Math.max(...last.map((m) => m.levels.length));
      for (let i = 0; i < steps && !ctl.skipped; i++) {
        for (const m of last) {
          const lv = m.levels[Math.min(i, m.levels.length - 1)];
          m.card.ctx.clearRect(0, 0, src.w, src.h);
          m.card.ctx.drawImage(paint(lv.buf, lv.w, lv.h, colors), 0, 0, src.w, src.h);
        }
        await ctl.wait(700 / steps);
      }

      // Flatten: the pooled maps fly into the head's feature vector, which
      // fills in with their actual values; then dense → softmax.
      if (head.length && !ctl.skipped) {
        const panel = headPanel(last, head, softmax, colors);
        Object.assign(panel.style, { left: merge.x - area.left + 'px', top: merge.y - area.top + 'px', opacity: 0 });
        root.append(panel);
        const strip = center(panel.querySelector('.fp-flat').getBoundingClientRect());
        await Promise.all(last.map((m) => {
          const c = center(m.card.fig.getBoundingClientRect());
          return ctl.animate(m.card.fig, [
            { transform: 'scale(0.85)', opacity: 1 },
            { transform: `translate(${strip.x - c.x}px, ${strip.y - c.y}px) scale(0.05)`, opacity: 0 },
          ], { duration: 550, easing: 'cubic-bezier(.6,0,.4,1)' });
        }));
        for (const c of cards) ctl.animate(c.fig, [{ opacity: 0.15 }, { opacity: 0 }], { duration: 250 });
        ctl.animate(svg, [{ opacity: 0.15 }, { opacity: 0 }], { duration: 250 });
        panel.style.opacity = '';
        await Promise.all([...panel.querySelectorAll('.fp-flat i')].map((cell, i) =>
          ctl.animate(cell, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: i * 14, fill: 'both' })));
        await Promise.all([...panel.querySelectorAll('.fp-bar i')].map((bar) =>
          ctl.animate(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 500, easing: 'ease-out' })));
        await ctl.wait(600);
      }
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

// A faint line from one map to another (right edge → left edge, or bottom →
// top when the layers are stacked vertically).
function link(svg, a, b, ar, vertical) {
  const ah = a.w / ar, bh = b.w / ar;
  const [x1, y1, x2, y2] = vertical
    ? [a.x + a.w / 2, a.y + ah, b.x + b.w / 2, b.y]
    : [a.x + a.w, a.y + ah / 2, b.x, b.y + bh / 2];
  const line = document.createElementNS(SVG, 'line');
  Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
  svg.append(line);
  return line;
}

// Dense layer + softmax over the last layer's pooled, flattened features.
// One class (section) per kernel type in the network; a class reads the
// features of the last-layer maps its kernel produced, and a kernel absent
// from the last layer gets only the bias (0). Returns [{ section, title, z, p }] sorted by score, highest
// first; `p` is null when the network has no softmax layer.
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
  title.textContent = softmax ? 'max-pool → flatten → dense → softmax' : 'max-pool → flatten → dense → logits';
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

// Lay out the maps: one column per layer (the input first), each column's
// maps stacked and centred; on narrow screens columns become rows. `counts`
// is maps per column. Returns slots[column][i] = { x, y, w } in area coords.
function layout(counts, area, ar) {
  const gap = 16, label = 20;
  const vertical = area.width < 600;
  const lanes = counts.length, most = Math.max(...counts);
  let w;
  if (vertical) {
    w = Math.min((area.width - gap * (most - 1)) / most, ((area.height * 0.9 - gap * (lanes - 1)) / lanes - label) * ar);
  } else {
    const gx = 40;   // room between columns for the wiring
    w = Math.min((area.width - gx * (lanes - 1)) / lanes, ((area.height * 0.85 - gap * (most - 1)) / most - label) * ar, 260);
  }
  const h = w / ar + label;
  return counts.map((n, c) => Array.from({ length: n }, (_, i) => {
    if (vertical) {
      const rowY = (area.height - (lanes * h + (lanes - 1) * gap)) / 2 + c * (h + gap);
      const x0 = (area.width - (n * w + (n - 1) * gap)) / 2;
      return { x: x0 + i * (w + gap), y: rowY, w };
    }
    const gx = (area.width - lanes * w) / Math.max(1, lanes - 1);
    const x = lanes === 1 ? (area.width - w) / 2 : c * (w + Math.min(gx, 80)) + (area.width - (lanes * w + (lanes - 1) * Math.min(gx, 80))) / 2;
    const y0 = (area.height - (n * h + (n - 1) * gap)) / 2;
    return { x, y: y0 + i * (h + gap), w };
  }));
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
