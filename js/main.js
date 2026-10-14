import { SITE, TREES } from './content.js';

const SVG = 'http://www.w3.org/2000/svg';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const fn = (k) => `f${String(k).split('').map((d) => SUB[d]).join('')}`;
const terms = TREES.map((_, i) => fn(i + 1));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => matchMedia('(max-width: 720px)').matches;

// ---------- Render ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

// '*text*' → <em>text</em>
const rich = (text) => text.split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? h('em', {}, part) : part));

function renderTree(tree, i) {
  const section = h('section', { class: 'tree', id: tree.id, 'aria-labelledby': `${tree.id}-title` });
  const root = h('div', { class: 'tree-root reveal' },
    h('span', { class: 'tree-fn', 'aria-hidden': 'true' }, terms[i]),
    h('h2', { id: `${tree.id}-title` }, tree.title));
  if (tree.note) root.append(h('span', { class: 'tree-note' }, tree.note));

  const list = h('ul', { class: 'tree-nodes', style: `--n: ${tree.nodes.length}` });
  tree.nodes.forEach((node, j) => {
    const box = h('div', { class: 'node-box reveal' }, h('h3', {}, node.title));
    if (node.meta) box.append(h('p', { class: 'node-meta' }, node.meta));
    const li = h('li', { class: `node${j === tree.path ? ' is-path' : ''}` });
    // The branch's split condition, then the node.
    if (node.split) li.append(h('span', { class: 'split reveal', 'aria-hidden': 'true' }, node.split));
    li.append(box);
    const leaf = h('div', { class: 'leaf reveal' });
    if (node.summary) leaf.append(h('p', { class: 'leaf-summary' }, ...rich(node.summary)));
    if (node.details) leaf.append(h('ul', { class: 'leaf-details' }, ...node.details.map((d) => h('li', {}, ...rich(d)))));
    if (node.link) {
      leaf.append(h('p', { class: 'leaf-link' },
        h('a', { href: node.link.href, target: '_blank', rel: 'noopener' }, `${node.link.label} ↗`)));
    }
    if (node.value != null) leaf.append(h('p', { class: 'leaf-value', 'aria-hidden': 'true' }, `+${node.value.toFixed(2)}`));
    li.append(leaf);
    list.append(li);
  });
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'branches');
  svg.setAttribute('aria-hidden', 'true');
  section.append(svg, root, list);
  return section;
}

const treesEl = document.getElementById('trees');
treesEl.append(...TREES.map(renderTree));

document.querySelector('.equation').textContent = `ŷ = ${terms.join(' + ')}`;
// What each tree adds: the value of the leaf on its path. They sum to 1.
const contrib = TREES.map((t) => t.nodes[t.path]?.value ?? 0);
const total = contrib.reduce((a, b) => a + b, 0);
document.querySelector('.outro-eq').textContent = `${terms.join(' + ')} = ${total.toFixed(2)}`;
document.querySelector('.outro-next').textContent = SITE.next;
document.querySelector('.outro .contact').append(...SITE.contact.map((c) =>
  h('li', {}, h('a', { href: c.href, ...(c.href.startsWith('http') ? { rel: 'noopener' } : {}) }, c.label))));

const sumEl = document.querySelector('.running-sum');
const sumValue = h('b', {}, '0.00');
sumEl.append('ŷ = ', ...terms.flatMap((t, i) => [i ? ' + ' : '', h('span', {}, t)]), ' = ', sumValue);
const sumTerms = [...sumEl.querySelectorAll('span')];

// ---------- Training loss chart ----------
// Residual (1 − ŷ) after each tree, drawn as far as the reader has scrolled.

const loss = [1, ...contrib.map((_, k) => Math.max(0, total - contrib.slice(0, k + 1).reduce((a, b) => a + b, 0)) / total)];
const chart = document.querySelector('.loss');
const CW = 180, CH = 84, PAD = { l: 26, r: 8, t: 8, b: 18 };
const cx = (x) => PAD.l + (x / TREES.length) * (CW - PAD.l - PAD.r);
const cy = (v) => PAD.t + (1 - v) * (CH - PAD.t - PAD.b);
chart.setAttribute('viewBox', `0 0 ${CW} ${CH}`);
chart.innerHTML = `
  <line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${CH - PAD.b}"/>
  <line class="axis" x1="${PAD.l}" y1="${CH - PAD.b}" x2="${CW - PAD.r}" y2="${CH - PAD.b}"/>
  <text class="tick" x="${PAD.l - 4}" y="${cy(1) + 3}" text-anchor="end">1</text>
  <text class="tick" x="${PAD.l - 4}" y="${cy(0) + 3}" text-anchor="end">0</text>
  <text class="tick" x="${CW - PAD.r}" y="${CH - 4}" text-anchor="end">trees</text>
  <polyline class="curve" points=""/>
  <circle class="dot" r="2.5"/>`;
const curve = chart.querySelector('.curve');
const dot = chart.querySelector('.dot');

// Loss at fractional training progress x ∈ [0, number of trees].
const lossAt = (x) => {
  const k = Math.min(Math.floor(x), TREES.length - 1);
  return loss[k] + (loss[k + 1] - loss[k]) * Math.min(1, x - k);
};

// ---------- Branches ----------
// Each branch is a path ending at a node or leaf. Paths use pathLength=1 so
// stroke-dashoffset can draw them on in proportion to scroll.

let branches = [];   // { path, end: Element }

function drawBranches() {
  branches = [];
  for (const section of treesEl.children) {
    const svg = section.querySelector('.branches');
    svg.replaceChildren();
    const s = section.getBoundingClientRect();
    svg.setAttribute('width', s.width);
    svg.setAttribute('height', s.height);
    const at = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - s.left, r: r.right - s.left, t: r.top - s.top, b: r.bottom - s.top, cx: r.left - s.left + r.width / 2 };
    };
    const add = (d, end, onPath) => {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      p.setAttribute('pathLength', '1');
      if (onPath) p.classList.add('is-path');
      svg.append(p);
      branches.push({ path: p, end });
    };
    const root = at(section.querySelector('.tree-root'));
    const nodes = [...section.querySelectorAll('.node')];

    if (narrow()) {
      // A trunk down the left edge, with a tick to each node.
      const x = 6;
      for (const node of nodes) {
        const b = at(node.querySelector('.node-box'));
        const y = b.t + 14;
        add(`M ${x} ${root.b + 6} V ${y} H ${b.l - 6}`, node.querySelector('.node-box'), node.classList.contains('is-path'));
      }
    } else {
      // Root → each node (elbow), then node → its leaf.
      const midY = root.b + (at(nodes[0].querySelector('.node-box')).t - root.b) / 2;
      for (const node of nodes) {
        const box = node.querySelector('.node-box');
        const b = at(box);
        const onPath = node.classList.contains('is-path');
        add(`M ${root.cx} ${root.b + 6} V ${midY} H ${b.cx} V ${b.t - 6}`, box, onPath);
        const leaf = node.querySelector('.leaf');
        if (leaf) add(`M ${b.cx} ${b.b + 6} V ${at(leaf).t - 8}`, leaf, onPath);
      }
    }
  }
  update();
}

// ---------- Scroll-linked growth ----------

const clamp = (v) => Math.max(0, Math.min(1, v));
let reveals = [];

function update() {
  const vh = window.innerHeight;
  const still = reducedMotion();
  // A branch draws on as the element it leads to rises from the bottom of
  // the screen into view; the element appears once its branch arrives.
  for (const { path, end } of branches) {
    const t = still ? 1 : clamp((vh * 0.92 - end.getBoundingClientRect().top) / (vh * 0.22));
    path.style.strokeDashoffset = 1 - t;
  }
  for (const el of reveals) {
    el.classList.toggle('on', still || el.getBoundingClientRect().top < vh * 0.82);
  }
  // The running sum: a term lights once its tree's root is past mid-screen.
  const heroGone = document.querySelector('.hero').getBoundingClientRect().bottom < vh * 0.4;
  const outroIn = document.querySelector('.outro').getBoundingClientRect().top < vh * 0.75;
  sumEl.classList.toggle('on', heroGone && !outroIn);
  // Training progress: how far the middle of the screen is through each tree.
  let x = 0;
  [...treesEl.children].forEach((section, i) => {
    const r = section.getBoundingClientRect();
    const frac = still ? 1 : clamp((vh * 0.5 - r.top) / r.height);
    x += frac;
    sumTerms[i].classList.toggle('on', frac > 0.15);
  });
  const l = lossAt(x);
  sumValue.textContent = (total * (1 - l)).toFixed(2);
  const pts = [];
  for (let k = 0; k <= Math.floor(x); k++) pts.push(`${cx(k)},${cy(loss[k])}`);
  pts.push(`${cx(x)},${cy(l)}`);
  curve.setAttribute('points', pts.join(' '));
  dot.setAttribute('cx', cx(x));
  dot.setAttribute('cy', cy(l));
  chart.parentElement.classList.toggle('on', heroGone && !outroIn);
}

let frame = 0;
const schedule = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(update);
};
window.addEventListener('scroll', schedule, { passive: true });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', schedule);

let redraw = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(redraw);
  redraw = requestAnimationFrame(drawBranches);
}).observe(treesEl);

reveals = [...document.querySelectorAll('.reveal')];
document.fonts.ready.then(drawBranches);
drawBranches();
