import { SITE } from './content.js';
import { LAYERS } from './layers.js';
import { createStage } from './stage.js';
import { createTiles } from './tiles.js';
import { createSections } from './sections.js';
import { createNetwork } from './network.js';
import { rasterize } from './raster.js';
import { paint, theme } from './paint.js';
import { sweep } from './sweep.js';

const $ = (sel) => document.querySelector(sel);
const stageEl = $('#stage');
const canvas = $('#name-canvas');
const nameView = $('.name-view');
const pageView = $('.page-view');
const networkEl = $('#network');
const status = $('#status');

for (const el of document.querySelectorAll('[data-text]')) el.textContent = SITE[el.dataset.text];

createStage(canvas, SITE.name);
const tiles = createTiles($('#tiles'), LAYERS, [networkEl, stageEl], addLayer);
const sections = createSections($('#sections'), LAYERS, (id) => { addLayer(id); run(); });
const network = createNetwork(networkEl, LAYERS, { onRun: run, onRemove: removeLayer, onReset: reset });
const sectionFor = Object.fromEntries(sections.sections.map((s) => [s.layer, s]));

// The whole UI state: the layers in your network, in the order added.
// `applied` marks the ones that have run. With nothing applied the stage
// shows the name; otherwise it shows a section for every layer that has run,
// at a depth equal to how many times it has run.
let stack = [];
let nextKey = 0;
let running = null;   // key of the layer being applied right now
const applied = (id) => stack.filter((l) => l.id === id && l.applied).length;
const inNetwork = (id) => stack.filter((l) => l.id === id).length;
// Run order: conv layers as added, output layers (softmax) last.
const ordered = () => [...stack.filter((l) => !LAYERS[l.id].output), ...stack.filter((l) => LAYERS[l.id].output)];

// Animations run one at a time; anything requested meanwhile waits its turn.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

function addLayer(id) {
  stack.push({ id, key: nextKey++, applied: false });
  update();
  announce(`Added ${LAYERS[id].label} to your network. Press Run to apply it.`);
}

// Apply every pending layer in order: the tile flies from its plate onto the
// stage, then the kernel sweeps across and reveals the new page.
function run() {
  enqueue(async () => {
    for (let next; (next = ordered().find((l) => !l.applied));) {
      running = next.key;
      update();
      if (!reducedMotion()) await tiles.fly(next.id, network.plateRect(next.key), center(visibleRect(stageEl)));
      await convolveInto(next);
    }
    running = null;
    update();
  });
}

// Bottom nav: add whatever that section needs for full depth, and run.
function openFully(sectionId) {
  const sec = sections.sections.find((s) => s.id === sectionId);
  const max = sections.maxDepth(sectionId);
  if (applied(sec.layer) >= max) return enqueue(() => scrollToSection(sectionId, 'start'));
  while (inNetwork(sec.layer) < max) stack.push({ id: sec.layer, key: nextKey++, applied: false });
  update();
  run();
}

function removeLayer(key) {
  enqueue(() => {
    const [removed] = stack.splice(stack.findIndex((l) => l.key === key), 1);
    if (removed.applied) crossfade();
    else update();
    announce(`Removed ${LAYERS[removed.id].label}.`);
    network.focusRun();
  });
}

function reset() {
  enqueue(() => {
    stack = [];
    crossfade();
    window.scrollTo({ top: 0 });
    announce('Network cleared.');
    document.querySelector('.tile').focus();
  });
}

// Rasterize what is on screen (the name, or the page) and convolve it with
// the layer's kernel. Then build the new page underneath, hidden behind a
// clip that opens up wherever the sweeping kernel has passed.
async function convolveInto(entry) {
  const layer = LAYERS[entry.id];
  const pageMode = stack.some((l) => l.applied);

  if (reducedMotion()) {
    entry.applied = true;
    update();
  } else {
    const before = visibleRect(stageEl);
    let scale = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.min(scale, Math.sqrt(2.5e6 / (before.width * before.height))); // cap work
    const src = rasterize(stageEl, before, scale);
    const out = layer.run(src.buf, src.w, src.h, scale * (pageMode ? 0.8 : 2), src.buf);
    const colors = theme();

    document.documentElement.classList.add('locked');
    stageEl.style.clipPath = 'inset(0 0 100% 0)';
    entry.applied = true;
    update();
    const r = union(before, visibleRect(stageEl));
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

  const sec = sectionFor[entry.id];
  announce(`Applied ${layer.label}. ${sec.title}, depth ${Math.min(applied(entry.id), sections.maxDepth(sec.id))}.`);
  await scrollToSection(sec.id, 'nearest');
}

// Non-convolution changes (removing a layer that ran, Reset) just fade.
function crossfade() {
  update();
  if (!reducedMotion()) stageEl.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
}

function update() {
  const pageMode = stack.some((l) => l.applied);
  document.body.classList.toggle('page-mode', pageMode);
  nameView.hidden = pageMode;
  pageView.hidden = !pageMode;

  const counts = {};
  for (const l of stack) counts[l.id] = (counts[l.id] || 0) + 1;
  tiles.setCounts(counts);
  sections.setDepths(Object.fromEntries(sections.sections.map((s) => [s.id, applied(s.layer)])));
  network.render(ordered(), running);
  const labels = ordered().filter((l) => l.applied).map((l) => LAYERS[l.id].label);
  canvas.setAttribute('aria-label', labels.length ? `${SITE.name}, processed by: ${labels.join(', ')}` : SITE.name);
}

// The on-screen part of `el`, excluding fixed bars along the bottom
// (the nav, and on narrow screens the tile tray and network strip).
function visibleRect(el) {
  const b = el.getBoundingClientRect();
  let bottom = window.innerHeight;
  for (const bar of document.querySelectorAll('.bottom-nav, .palette, .network')) {
    const t = bar.getBoundingClientRect().top;
    if (getComputedStyle(bar).position === 'fixed' && t > window.innerHeight / 2) bottom = Math.min(bottom, t);
  }
  const top = Math.max(0, b.top);
  return new DOMRect(b.left, top, b.width, Math.max(1, Math.min(bottom, b.bottom) - top));
}

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// Scroll a section into view; resolves once the scroll has settled.
function scrollToSection(id, block) {
  if (!stack.some((l) => l.applied)) return;
  const el = sections.element(id);
  const r = el.getBoundingClientRect();
  if (block === 'nearest' && r.top >= 0 && r.bottom <= visibleRect(document.body).bottom) return;
  const smooth = !reducedMotion();
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block });
  if (!smooth) return;
  return new Promise((resolve) => {
    const done = () => { clearTimeout(t); window.removeEventListener('scrollend', done); resolve(); };
    const t = setTimeout(done, 700);
    window.addEventListener('scrollend', done);
  });
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function union(a, b) {
  const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
  return new DOMRect(left, top, Math.max(a.right, b.right) - left, Math.max(a.bottom, b.bottom) - top);
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

update();
