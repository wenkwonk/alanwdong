import { SITE } from './content.js';
import { LAYERS } from './layers.js';
import { createStage } from './stage.js';
import { createTiles } from './tiles.js';
import { createSections } from './sections.js';
import { createNetwork, MAX_LAYERS, MAX_FILTERS } from './network.js';
import { forwardPass } from './forward.js';

const $ = (sel) => document.querySelector(sel);
const stageEl = $('#stage');
const canvas = $('#name-canvas');
const nameView = $('.name-view');
const pageView = $('.page-view');
const networkEl = $('#network');
const status = $('#status');

createStage(canvas, SITE.name);
const tiles = createTiles($('#tiles'), LAYERS, [networkEl, stageEl], addLayer);
const sections = createSections($('#sections'), LAYERS, moreDetail);
const network = createNetwork(networkEl, LAYERS, {
  onRun: run, onRemove: removeLayer, onReset: reset, onMove: moveLayer, onSelect: selectLayer, onAddLayer: addNetworkLayer,
});
for (const el of document.querySelectorAll('[data-text]')) el.textContent = SITE[el.dataset.text];

// The whole UI state: the filters in your network. Each conv filter has a
// `layer` (0-based); the softmax output has none. `applied` marks the ones
// included in the last run. The page shows a section for every applied
// kernel type, at a depth equal to how many times that kernel appears.
let stack = [];
let nextKey = 0;
let layerCount = 1;
let active = 0;         // the selected layer: where new filters go
let running = false;
let changed = false;    // filters moved between layers since the last run
let showName = false;   // during a run: show the name even if layers applied
const applied = (id) => stack.filter((l) => l.id === id && l.applied).length;
const convs = () => stack.filter((l) => !LAYERS[l.id].output).sort((a, b) => a.layer - b.layer);
const outputs = () => stack.filter((l) => LAYERS[l.id].output);
const ordered = () => [...convs(), ...outputs()];
const inLayer = (i) => stack.filter((l) => l.layer === i).length;

// Runs and other changes happen one at a time.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

// Add a tile to the network: a conv filter goes to the layer it was dropped
// on, or else the selected layer; softmax becomes the output (once).
function addLayer(id, point) {
  if (running) return;
  const label = LAYERS[id].label;
  if (LAYERS[id].output) {
    if (outputs().length) return announce('The network already ends in softmax.');
    stack.push({ id, key: nextKey++, applied: false });
    update();
    return announce(`Added ${label} as the output. Press Run to apply the network.`);
  }
  let target = (point && network.layerAt(point.x, point.y)) ?? active;
  let created = false;
  if (inLayer(target) >= MAX_FILTERS) {
    // Full: start the next layer automatically (if there's room for one).
    if (layerCount >= MAX_LAYERS) return announce(`The network is full (${MAX_LAYERS} layers of ${MAX_FILTERS}). Remove a filter first.`);
    target = layerCount++;
    created = true;
  }
  stack.push({ id, key: nextKey++, applied: false, layer: target });
  active = target;
  update();
  announce(`Added ${label} to ${created ? 'new ' : ''}layer ${target + 1}. Press Run to apply the network.`);
}

function selectLayer(i) {
  active = i;
  update();
  announce(`Layer ${i + 1} selected. New filters go here.`);
}

function addNetworkLayer() {
  if (running || layerCount >= MAX_LAYERS) return;
  active = layerCount++;
  update();
  announce(`Layer ${active + 1} added and selected.`);
}

// Move a filter to another layer: { to: index } or { by: ±1 }.
function moveLayer(key, { to, by }) {
  const f = stack.find((l) => l.key === key);
  if (running || !f) return;
  const target = Math.max(0, Math.min(layerCount - 1, to ?? f.layer + by));
  if (target === f.layer) return;
  if (inLayer(target) >= MAX_FILTERS) return announce(`Layer ${target + 1} is full.`);
  f.layer = target;
  changed = stack.some((l) => l.applied);
  update();
  announce(`${LAYERS[f.id].label} moved to layer ${target + 1}.`);
}

// Somewhere a filter can go: the selected layer if it has room, else any
// layer with room, else a new layer. Null if the network is full.
function roomyLayer() {
  if (inLayer(active) < MAX_FILTERS) return active;
  for (let i = 0; i < layerCount; i++) if (inLayer(i) < MAX_FILTERS) return i;
  return layerCount < MAX_LAYERS ? layerCount++ : null;
}

// A forward pass of the whole network over the name: feature maps layer by
// layer, pooling, a dense + softmax head, then the page.
function run() {
  enqueue(async () => {
    if (!stack.some((l) => !l.applied) && !changed) return;
    running = true;
    const animate = !reducedMotion();

    // The input is always the name: on a re-run, collapse the page back to it.
    showName = true;
    window.scrollTo({ top: 0 });
    if (animate && stack.some((l) => l.applied)) {
      crossfade();
      await sleep(300);
    } else {
      update();
    }

    // Filters grouped by layer (empty layers skipped); one output class per
    // kernel type.
    const net = [];
    for (let i = 0; i < layerCount; i++) {
      const filters = convs().filter((l) => l.layer === i);
      if (filters.length) net.push(filters.map((l) => ({ id: l.id, from: network.plateRect(l.key) })));
    }
    const classes = [...new Set(convs().map((l) => l.id))]
      .map((id) => ({ id, section: sectionFor(id).id, title: sectionFor(id).title, short: sectionFor(id).short }));

    let ranking = [];
    await forwardPass({
      canvas,
      area: mapArea(),
      net,
      classes,
      softmax: stack.some((l) => LAYERS[l.id].output),
      fly: tiles.fly,
      instant: !animate,
      generate: (rect, instant, rank) => {
        ranking = rank;
        sections.setOrder(rank);
        for (const l of stack) l.applied = true;
        showName = false;
        changed = false;
        update();
        if (!instant) return openFrom(rect);
      },
    });

    running = false;
    update();
    const titles = ranking.map((id) => sections.sections.find((s) => s.id === id).title);
    announce(`Network ran. Sections in order of score: ${titles.join(', ') || 'none'}.`);
  });
}

// The page opens out of the score panel: a clip that starts at the panel's
// rectangle and expands to the whole page.
function openFrom(rect) {
  if (!rect) return;
  const s = stageEl.getBoundingClientRect();
  const t = Math.max(0, rect.top - s.top), l = Math.max(0, rect.left - s.left);
  const r = Math.max(0, s.right - rect.right), b = Math.max(0, s.bottom - rect.bottom);
  const a = stageEl.animate([
    { clipPath: `inset(${t}px ${r}px ${b}px ${l}px round 10px)`, opacity: 0.4 },
    { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 },
  ], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' });
  return a.finished.catch(() => {});
}

// Bottom nav: the fast path. Add what the section needs for full depth and
// apply the whole network at once, without the animation.
function openFully(sectionId) {
  const sec = sections.sections.find((s) => s.id === sectionId);
  enqueue(async () => {
    // Each extra copy needs room; softmax only ever appears once.
    const isOutput = LAYERS[sec.layer].output;
    const want = isOutput ? 1 : sections.maxDepth(sectionId);
    while (stack.filter((l) => l.id === sec.layer).length < want) {
      if (isOutput) { stack.push({ id: sec.layer, key: nextKey++, applied: false }); continue; }
      const layer = roomyLayer();
      if (layer == null) break;
      stack.push({ id: sec.layer, key: nextKey++, applied: false, layer });
    }
    applyNow();
    await scrollToSection(sectionId, 'start');
  });
}

// "More detail" in a section: one more of its layer, applied at once.
function moreDetail(id) {
  enqueue(() => {
    const layer = roomyLayer();
    if (layer == null) return announce('The network is full: remove a filter first.');
    stack.push({ id, key: nextKey++, applied: false, layer });
    applyNow();
  });
}

function applyNow() {
  for (const l of stack) l.applied = true;
  crossfade();
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
    layerCount = 1;
    active = 0;
    changed = false;
    crossfade();
    window.scrollTo({ top: 0 });
    announce('Network cleared.');
    document.querySelector('.tile').focus();
  });
}

function crossfade() {
  update();
  if (!reducedMotion()) stageEl.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
}

function update() {
  const pageMode = stack.some((l) => l.applied) && !showName;
  document.body.classList.toggle('page-mode', pageMode);
  nameView.hidden = pageMode;
  pageView.hidden = !pageMode;

  const counts = {};
  for (const l of stack) counts[l.id] = (counts[l.id] || 0) + 1;
  tiles.setCounts(counts);
  sections.setDepths(Object.fromEntries(sections.sections.map((s) => [s.id, applied(s.layer)])));
  network.render({ filters: convs(), outputs: outputs(), layerCount, active, running, changed });
  const labels = ordered().filter((l) => l.applied).map((l) => LAYERS[l.id].label);
  canvas.setAttribute('aria-label', labels.length ? `${SITE.name}, processed by: ${labels.join(', ')}` : SITE.name);
}

const sectionFor = (layerId) => sections.sections.find((s) => s.layer === layerId);

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

// Where the feature maps can go: the visible area between the tile column
// and the network panel (or above the bottom bars on narrow screens).
function mapArea() {
  const v = visibleRect(document.body);
  let left = 16, right = window.innerWidth - 16;
  for (const col of document.querySelectorAll('.palette, .network')) {
    const r = col.getBoundingClientRect();
    if (r.width < window.innerWidth / 2) {   // a side column, not a full-width bottom bar
      if (r.right < window.innerWidth / 2) left = Math.max(left, r.right + 24);
      else right = Math.min(right, r.left - 24);
    }
  }
  return new DOMRect(left, v.top + 16, right - left, v.height - 32);
}

// Scroll a section into view; resolves once the scroll has settled.
function scrollToSection(id, block) {
  const el = sections.element(id);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function announce(msg) {
  status.textContent = msg;
}

for (const link of document.querySelectorAll('[data-open]')) {
  link.textContent = sections.sections.find((s) => s.id === link.dataset.open).short;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openFully(link.dataset.open);
  });
}

update();
