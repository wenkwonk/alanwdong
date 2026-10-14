import { SITE } from './content.js';
import { LAYERS } from './layers.js';
import { createStage } from './stage.js';
import { createTiles } from './tiles.js';
import { createSections } from './sections.js';
import { rasterize } from './raster.js';
import { paint, theme } from './paint.js';
import { sweep } from './sweep.js';

const $ = (sel) => document.querySelector(sel);
const stageEl = $('#stage');
const canvas = $('#name-canvas');
const nameView = $('.name-view');
const pageView = $('.page-view');
const chipList = $('#chips');
const resetBtn = $('#reset');
const status = $('#status');
const nav = $('.bottom-nav');
const palette = $('.palette');
const hintDrag = $('.hint-drag');

for (const el of document.querySelectorAll('[data-text]')) el.textContent = SITE[el.dataset.text];

createStage(canvas, SITE.name);
const tiles = createTiles($('#tiles'), LAYERS, stageEl, applyLayer);
const sections = createSections($('#sections'), LAYERS, applyLayer);
const sectionFor = Object.fromEntries(sections.sections.map((s) => [s.layer, s]));

// The whole UI state: applied layers in order. `key` tells repeats apart.
// No layers: the page shows the name. Otherwise it shows a section for every
// layer used, at a depth equal to how many times that layer was applied.
let stack = [];
let nextKey = 0;
const count = (id) => stack.filter((l) => l.id === id).length;

// Transitions run one at a time; drops made meanwhile wait their turn.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

function applyLayer(id) {
  enqueue(() => convolveInto(id, () => stack.push({ id, key: nextKey++ })));
}

// Bottom nav: open a section at full depth with one convolution.
function openFully(sectionId) {
  const sec = sections.sections.find((s) => s.id === sectionId);
  enqueue(async () => {
    const max = sections.maxDepth(sectionId);
    if (count(sec.layer) >= max) return scrollToSection(sectionId, 'start');
    await convolveInto(sec.layer, () => {
      while (count(sec.layer) < max) stack.push({ id: sec.layer, key: nextKey++ });
    }, 'start');
  });
}

function removeLayer(key) {
  enqueue(() => {
    const removed = stack.splice(stack.findIndex((l) => l.key === key), 1)[0];
    crossfade();
    announce(`Removed ${LAYERS[removed.id].label}.`);
  });
}

function reset() {
  enqueue(() => {
    stack = [];
    crossfade();
    window.scrollTo({ top: 0 });
    announce('All layers cleared.');
  });
}

// Rasterize what is on screen (the name, or the page), convolve it with the
// layer's kernel, play the sweep, swap in the new page underneath, dissolve.
async function convolveInto(id, mutate, block = 'nearest') {
  const layer = LAYERS[id];
  const pageMode = stack.length > 0;

  if (reducedMotion()) {
    mutate();
    update();
  } else {
    // Picture of what is on screen now, and its convolution.
    const before = visibleRect(stageEl);
    let scale = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.min(scale, Math.sqrt(2.5e6 / (before.width * before.height))); // cap work
    const src = rasterize(stageEl, before, scale);
    const out = layer.run(src.buf, src.w, src.h, scale * (pageMode ? 0.8 : 2), src.buf);
    const colors = theme();

    // Build the new page now, hidden behind a clip that the sweep opens up.
    document.documentElement.classList.add('locked');
    stageEl.style.clipPath = 'inset(0 0 100% 0)';
    mutate();
    update();
    const after = visibleRect(stageEl);
    const r = union(before, after);
    const s = stageEl.getBoundingClientRect();

    await sweep(r, before, paint(src.buf, src.w, src.h, colors), paint(out, src.w, src.h, colors), layer,
      pageMode ? 1500 : 1300, (e) => {
        // Swept area: every row above the window, plus its row up to the centre.
        // (Everything above the region, off screen, is open too.)
        const T = e.top - s.top, B = e.bottom - s.top, X = e.cx - s.left, F = 1e5;
        stageEl.style.clipPath = `polygon(${-F}px ${-F}px, ${F}px ${-F}px, ${F}px ${T}px, ${X}px ${T}px, ${X}px ${B}px, ${-F}px ${B}px)`;
      });

    stageEl.style.clipPath = '';
    document.documentElement.classList.remove('locked');
  }

  const sec = sectionFor[id];
  announce(`Applied ${layer.label}. ${sec.title}, depth ${Math.min(count(id), sections.maxDepth(sec.id))}.`);
  scrollToSection(sec.id, block);
}

// Non-convolution changes (removing a chip, Reset) just fade.
function crossfade() {
  update();
  if (!reducedMotion()) stageEl.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
}

function update() {
  const pageMode = stack.length > 0;
  document.body.classList.toggle('page-mode', pageMode);
  nameView.hidden = pageMode;
  pageView.hidden = !pageMode;
  hintDrag.textContent = pageMode ? SITE.hintDragPage : SITE.hintDrag;

  // Chips list output stages (softmax) last, matching the network.
  const ordered = [...stack.filter((l) => !LAYERS[l.id].output), ...stack.filter((l) => LAYERS[l.id].output)];
  const counts = {};
  for (const l of stack) counts[l.id] = (counts[l.id] || 0) + 1;
  tiles.setCounts(counts);
  sections.setDepths(Object.fromEntries(sections.sections.map((s) => [s.id, counts[s.layer] || 0])));
  renderChips(ordered);
  const labels = ordered.map((l) => LAYERS[l.id].label);
  canvas.setAttribute('aria-label', labels.length ? `${SITE.name}, processed by: ${labels.join(', ')}` : SITE.name);
}

// The on-screen part of `el`, excluding fixed bars along the bottom.
function visibleRect(el) {
  const b = el.getBoundingClientRect();
  let bottom = Math.min(window.innerHeight, nav.getBoundingClientRect().top);
  if (getComputedStyle(palette).position === 'fixed' && palette.getBoundingClientRect().top > window.innerHeight / 2) {
    bottom = Math.min(bottom, palette.getBoundingClientRect().top);
  }
  const top = Math.max(0, b.top);
  return new DOMRect(b.left, top, b.width, Math.max(1, Math.min(bottom, b.bottom) - top));
}

function scrollToSection(id, block) {
  if (!stack.length) return;
  sections.element(id).scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block });
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function union(a, b) {
  const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
  return new DOMRect(left, top, Math.max(a.right, b.right) - left, Math.max(a.bottom, b.bottom) - top);
}

function renderChips(ordered) {
  chipList.replaceChildren(...ordered.map(({ id, key }) => {
    const li = document.createElement('li');
    li.className = 'chip';
    const name = document.createElement('span');
    name.textContent = LAYERS[id].label;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'chip-remove';
    x.textContent = '×';
    x.setAttribute('aria-label', `Remove ${LAYERS[id].label}`);
    x.addEventListener('click', () => {
      // Keep keyboard focus nearby after the chip disappears.
      const idx = [...chipList.children].indexOf(li);
      removeLayer(key);
      enqueue(() => {
        const rest = chipList.querySelectorAll('.chip-remove');
        (rest[Math.min(idx, rest.length - 1)] || document.querySelector('.tile')).focus();
      });
    });
    li.append(name, x);
    return li;
  }));
}

function announce(msg) {
  status.textContent = msg;
}

for (const link of document.querySelectorAll('[data-open]')) {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openFully(link.dataset.open);
  });
}

resetBtn.addEventListener('click', reset);
update();
