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
//   classes    [{ id, section, title, short }] one per kernel type
//   softmax    whether the network ends in a softmax output layer
//   fly        (id, fromRect, toPoint, ms) => Promise, the automatic drag
//   generate   (rect, instant, ranking) => Promise, shows the page opening
//              out of rect (the score panel, or null); ranking is section
//              ids, highest score first
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
    const cards = [];
    let panel = null;   // the head, once shown

    if (maps.length && !ctl.skipped) {
      const ar = src.w / src.h;
      const { slots: grid, head: lane } = layout([1, ...columns.map((c) => c.maps.length)], area, ar, head.length > 0);
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
        if (!lastCards.includes(c)) ctl.animate(c.fig, [{ opacity: 1 }, { opacity: 0.2 }], { duration: 400 });
      }
      ctl.animate(svg, [{ opacity: 1 }, { opacity: 0.25 }], { duration: 400 });

      // Max-pool the last layer's maps in place, a level at a time.
      for (const m of last) m.card.ctx.imageSmoothingEnabled = false;
      const steps = Math.max(...last.map((m) => m.levels.length));
      for (let i = 0; i < steps && !ctl.skipped; i++) {
        for (const m of last) {
          const lv = m.levels[Math.min(i, m.levels.length - 1)];
          m.card.ctx.clearRect(0, 0, src.w, src.h);
          m.card.ctx.drawImage(paint(lv.buf, lv.w, lv.h, colors), 0, 0, src.w, src.h);
        }
        await ctl.wait(700 / steps);
      }

      if (head.length && !ctl.skipped) {
        // The head is the next column: it fades in where the diagram
        // continues, wired to the last layer.
        panel = headPanel(last, head, softmax, colors);
        root.append(panel);
        const pw = Math.min(lane.w, panel.offsetWidth), ph = panel.offsetHeight;
        Object.assign(panel.style, {
          left: lane.x + (lane.w - pw) / 2 + 'px',
          top: lane.y + (lane.h - ph) / 2 + 'px',
          opacity: 0,
        });
        const groups = [...panel.querySelectorAll('.fp-group')];
        const wires = document.createElementNS(SVG, 'svg');
        wires.setAttribute('class', 'fp-links');
        wires.setAttribute('width', area.width);
        wires.setAttribute('height', area.height);
        root.insertBefore(wires, root.firstChild);
        const local = (rc) => ({ x: rc.left - area.left, y: rc.top - area.top, w: rc.width, h: rc.height });
        const vertical = area.width < 600;
        last.forEach((m, i) => {
          const a = local(m.card.cv.getBoundingClientRect()), g = local(groups[i].getBoundingClientRect());
          const line = vertical
            ? segment(wires, a.x + a.w / 2, a.y + a.h, g.x + g.w / 2, g.y)
            : segment(wires, a.x + a.w, a.y + a.h / 2, g.x, g.y + g.h / 2);
          ctl.animate(line, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        });
        ctl.animate(panel, [{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });

        // Flatten: each pooled map squeezes into its group of cells, which
        // light up with its actual values as it arrives.
        const squeeze = last.map((m, i) => {
          const c = m.card.cv.getBoundingClientRect(), g = groups[i].getBoundingClientRect();
          m.card.fig.style.transformOrigin = '0 0';
          return ctl.animate(m.card.fig, [
            { transform: 'none', opacity: 1 },
            { transform: `translate(${(g.left - c.left) * 0.7}px, ${(g.top - c.top) * 0.7}px) scale(${0.3 + 0.7 * g.width / c.width}, ${0.3 + 0.7 * g.height / c.height})`, opacity: 1, offset: 0.7 },
            { transform: `translate(${g.left - c.left}px, ${g.top - c.top}px) scale(${g.width / c.width}, ${g.height / c.height})`, opacity: 0 },
          ], { duration: 650, easing: 'cubic-bezier(.5,0,.3,1)' });
        });
        const cellsIn = groups.flatMap((g) => [...g.children].map((cell, j) =>
          ctl.animate(cell, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 380 + j * 35, fill: 'both' })));
        await Promise.all([...squeeze, ...cellsIn]);

        // Dense: wires from the vector to every class, then the scores.
        drawDense(panel);
        await Promise.all([...panel.querySelectorAll('.fp-dense line')].map((l) =>
          ctl.animate(l, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 400, easing: 'ease-out' })));
        await Promise.all([...panel.querySelectorAll('.fp-bar i')].map((bar, i) =>
          ctl.animate(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 450, delay: i * 70, easing: 'ease-out', fill: 'both' })));
        const top = panel.querySelector('.fp-row');
        top.classList.add('is-top');
        await ctl.animate(top, [{ backgroundColor: 'transparent' }, { backgroundColor: 'var(--hl)' }], { duration: 300 });
        await ctl.wait(450);
      }
    }

    // The page opens out of the score panel while the diagram fades away.
    const from = panel && !ctl.skipped ? panel.getBoundingClientRect() : null;
    canvas.parentElement.style.visibility = '';
    const fade = from ? root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished : null;
    await Promise.all([generate(from, ctl.skipped, head.map((h) => h.section)), fade]);
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
  return vertical
    ? segment(svg, a.x + a.w / 2, a.y + ah, b.x + b.w / 2, b.y)
    : segment(svg, a.x + a.w, a.y + ah / 2, b.x, b.y + bh / 2);
}

function segment(svg, x1, y1, x2, y2) {
  const line = document.createElementNS(SVG, 'line');
  Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
  svg.append(line);
  return line;
}

// The dense layer's wiring inside the score panel: every group of the
// flattened vector connects to every class. Lines use pathLength=1 so they
// can be drawn on with stroke-dashoffset.
function drawDense(panel) {
  const svg = panel.querySelector('.fp-dense');
  const box = svg.getBoundingClientRect();
  for (const g of panel.querySelectorAll('.fp-group')) {
    const a = g.getBoundingClientRect();
    for (const bar of panel.querySelectorAll('.fp-row')) {
      const b = bar.getBoundingClientRect();
      const line = segment(svg, a.right - box.left, a.top + a.height / 2 - box.top, b.left - box.left, b.top + b.height / 2 - box.top);
      line.setAttribute('pathLength', 1);
    }
  }
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
    return { section: c.section, title: c.title, short: c.short, z: DENSE_WEIGHT * sum / Math.max(1, n), p: null };
  });
  if (softmax && rows.length) {
    const zmax = Math.max(...rows.map((r) => r.z));
    const e = rows.map((r) => Math.exp(r.z - zmax));
    const total = e.reduce((a, b) => a + b, 0);
    rows.forEach((r, i) => (r.p = e[i] / total));
  }
  return rows.sort((a, b) => (b.p ?? b.z) - (a.p ?? a.z));
}

// The head, drawn: the flattened vector (a group of cells per last-layer
// map, showing that map's actual pooled values), the dense wiring, and a
// bar per class with its probability (or logit).
function headPanel(last, head, softmax, colors) {
  const panel = document.createElement('div');
  panel.className = 'fp-head';
  const title = document.createElement('p');
  title.className = 'fp-title';
  title.textContent = softmax ? 'max-pool → flatten → dense → softmax' : 'max-pool → flatten → dense → logits';

  const body = document.createElement('div');
  body.className = 'fp-body';
  const flat = document.createElement('div');
  flat.className = 'fp-flat';
  const CELLS = 6;
  for (const m of last) {
    const group = document.createElement('div');
    group.className = 'fp-group';
    for (let j = 0; j < CELLS; j++) {
      const v = Math.min(1, m.features[Math.floor(((j + 0.5) * m.features.length) / CELLS)]);
      const cell = document.createElement('i');
      cell.style.background = `rgba(${colors.ink}, ${0.08 + 0.92 * v})`;
      group.append(cell);
    }
    flat.append(group);
  }
  const dense = document.createElementNS(SVG, 'svg');
  dense.setAttribute('class', 'fp-dense');

  const scores = document.createElement('div');
  scores.className = 'fp-scores';
  const max = Math.max(...head.map((h) => Math.abs(h.p ?? h.z)), 1e-6);
  for (const h of head) {
    const row = document.createElement('div');
    row.className = 'fp-row';
    const name = document.createElement('span');
    name.textContent = h.short;
    const bar = document.createElement('span');
    bar.className = 'fp-bar';
    const fill = document.createElement('i');
    fill.style.width = `${(100 * Math.abs(h.p ?? h.z)) / (h.p != null ? 1 : max)}%`;
    bar.append(fill);
    const val = document.createElement('span');
    val.textContent = (h.p ?? h.z).toFixed(h.p != null ? 3 : 2);
    row.append(name, bar, val);
    scores.append(row);
  }
  body.append(flat, dense, scores);
  panel.append(title, body);
  return panel;
}

// Lay out the diagram: one lane per layer (the input first), each lane's
// maps stacked and centred, then a lane for the head if `withHead`. Lanes
// are columns, or rows on narrow screens. Returns { slots, head }:
// slots[lane][i] = { x, y, w } and head = { x, y, w, h }, in area coords.
const HEAD_W = 236, HEAD_H = 170;
function layout(counts, area, ar, withHead) {
  const gap = 16, label = 20, gx = 40;
  const vertical = area.width < 600;
  const lanes = counts.length, most = Math.max(...counts);
  let w, h, head, place;
  if (vertical) {
    const roomH = area.height * 0.94 - (withHead ? HEAD_H + gap : 0);
    w = Math.min((area.width - gap * (most - 1)) / most, ((roomH - gap * (lanes - 1)) / lanes - label) * ar);
    h = w / ar + label;
    const y0 = (area.height - (lanes * h + (lanes - 1) * gap + (withHead ? gap + HEAD_H : 0))) / 2;
    place = (c, i, n) => ({ x: (area.width - (n * w + (n - 1) * gap)) / 2 + i * (w + gap), y: y0 + c * (h + gap), w });
    head = { x: 0, y: y0 + lanes * (h + gap), w: area.width, h: HEAD_H };
  } else {
    const headW = withHead ? HEAD_W + gx : 0;
    w = Math.min((area.width - headW - gx * (lanes - 1)) / lanes, ((area.height * 0.85 - gap * (most - 1)) / most - label) * ar, 240);
    h = w / ar + label;
    const x0 = (area.width - (lanes * w + (lanes - 1) * gx + headW)) / 2;
    place = (c, i, n) => ({ x: x0 + c * (w + gx), y: (area.height - (n * h + (n - 1) * gap)) / 2 + i * (h + gap), w });
    head = { x: x0 + lanes * (w + gx), y: 0, w: HEAD_W, h: area.height };
  }
  return { slots: counts.map((n, c) => Array.from({ length: n }, (_, i) => place(c, i, n))), head };
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
