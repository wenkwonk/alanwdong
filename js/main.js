import { SITE } from './content.js';
import { LAYERS } from './layers.js';
import { createStage } from './stage.js';
import { createTiles } from './tiles.js';
import { createSections } from './sections.js';
import { createNetwork } from './network.js';
import { forwardPass } from './forward.js';

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
const sections = createSections($('#sections'), LAYERS, moreDetail);
const network = createNetwork(networkEl, LAYERS, { onRun: run, onRemove: removeLayer, onReset: reset });

// The whole UI state: the layers in your network, in the order added.
// `applied` marks the ones included in the last run. The page shows a section
// for every applied layer, at a depth equal to how many times it appears.
let stack = [];
let nextKey = 0;
let running = false;
let showName = false;   // during a run: show the name even if layers applied
const applied = (id) => stack.filter((l) => l.id === id && l.applied).length;
// Network order: conv layers as added, output layers (softmax) last.
const ordered = () => [...stack.filter((l) => !LAYERS[l.id].output), ...stack.filter((l) => LAYERS[l.id].output)];

// Runs and other changes happen one at a time.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

function addLayer(id) {
  stack.push({ id, key: nextKey++, applied: false });
  update();
  announce(`Added ${LAYERS[id].label} to your network. Press Run to apply it.`);
}

// A forward pass of the whole network over the name: split into feature maps,
// convolve, pool, merge, and generate the page.
function run() {
  enqueue(async () => {
    if (!stack.some((l) => !l.applied)) return;
    running = true;
    const finish = () => {
      for (const l of stack) l.applied = true;
      showName = false;
      update();
    };

    if (reducedMotion()) {
      finish();
    } else {
      if (stack.some((l) => l.applied)) {
        // Re-run: collapse the page back into the name first.
        showName = true;
        window.scrollTo({ top: 0 });
        crossfade();
        await sleep(300);
      } else {
        update();
      }

      // One channel per conv kernel; repeats deepen that channel.
      const channels = [];
      for (const l of ordered()) {
        if (LAYERS[l.id].output) continue;
        const ch = channels.find((c) => c.id === l.id);
        if (ch) ch.count++;
        else channels.push({ id: l.id, count: 1, key: l.key });
      }
      for (const ch of channels) ch.from = network.plateRect(ch.key);

      await forwardPass({
        canvas,
        area: mapArea(),
        channels,
        softmax: stack.some((l) => LAYERS[l.id].output),
        fly: tiles.fly,
        generate: (point, instant) => {
          finish();
          window.scrollTo({ top: 0 });
          if (!instant) return growFrom(point);
        },
      });
    }

    running = false;
    update();
    const names = [...new Set(ordered().map((l) => sectionFor(l.id).title))];
    announce(`Network ran. Showing ${names.join(', ')}.`);
  });
}

// The page grows out of the merged feature map as an expanding circle.
function growFrom(point) {
  const s = stageEl.getBoundingClientRect();
  const x = point.x - s.left, y = point.y - s.top;
  const r = Math.hypot(Math.max(x, s.width - x), Math.max(y, window.innerHeight - s.top));
  const a = stageEl.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }],
    { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' });
  return a.finished.catch(() => {});
}

// Bottom nav: the fast path. Add what the section needs for full depth and
// apply the whole network at once, without the animation.
function openFully(sectionId) {
  const sec = sections.sections.find((s) => s.id === sectionId);
  enqueue(async () => {
    while (stack.filter((l) => l.id === sec.layer).length < sections.maxDepth(sectionId)) {
      stack.push({ id: sec.layer, key: nextKey++, applied: false });
    }
    applyNow();
    await scrollToSection(sectionId, 'start');
  });
}

// "More detail" in a section: one more of its layer, applied at once.
function moreDetail(id) {
  enqueue(() => {
    stack.push({ id, key: nextKey++, applied: false });
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
  network.render(ordered(), running);
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
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openFully(link.dataset.open);
  });
}

update();
