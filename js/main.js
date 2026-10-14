import { SITE } from './content.js';
import { LAYERS } from './layers.js';
import { createStage } from './stage.js';
import { createTiles } from './tiles.js';
import { createSections } from './sections.js';

const $ = (id) => document.getElementById(id);
const canvas = $('name-canvas');
const chipList = $('chips');
const resetBtn = $('reset');
const status = $('status');
const classification = $('classification');

$('subtitle').textContent = SITE.subtitle;
classification.textContent = SITE.classification;
document.querySelector('.hint-drag').textContent = SITE.hintDrag;
document.querySelector('.hint-tap').textContent = SITE.hintTap;

const stage = createStage(canvas, SITE.name);
const tiles = createTiles($('tiles'), LAYERS, canvas.parentElement, applyLayer);
const sections = createSections($('sections'), LAYERS, applyLayer);
const sectionFor = Object.fromEntries(sections.sections.map((s) => [s.layer, s]));

// The whole UI state: applied layers in order. `key` tells repeats apart.
// A section's depth is how many times its layer is in the stack.
let stack = [];
let nextKey = 0;

function applyLayer(id) {
  stack.push({ id, key: nextKey++ });
  const counts = update();
  const sec = sectionFor[id];
  announce(`Applied ${LAYERS[id].label}. ${sec.title}, depth ${Math.min(counts[id], sections.maxDepth(sec.id))}.`);
  revealSection(sec.id);
}

function removeLayer(key) {
  const i = stack.findIndex((l) => l.key === key);
  const [removed] = stack.splice(i, 1);
  update();
  announce(`Removed ${LAYERS[removed.id].label}.`);
}

function reset() {
  stack = [];
  update();
  announce('All layers cleared.');
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
}

// Bottom nav: open a section at full depth in one step.
function openFully(sectionId) {
  const sec = sections.sections.find((s) => s.id === sectionId);
  const count = () => stack.filter((l) => l.id === sec.layer).length;
  if (count() >= sections.maxDepth(sectionId)) return revealSection(sectionId, 'start');
  while (count() < sections.maxDepth(sectionId)) stack.push({ id: sec.layer, key: nextKey++ });
  update();
  announce(`${sec.title}, full detail.`);
  revealSection(sectionId, 'start');
}

function update() {
  // Shown (and rendered) with output stages last, matching the network.
  const ordered = [...stack.filter((l) => !LAYERS[l.id].output), ...stack.filter((l) => LAYERS[l.id].output)];
  stage.setStack(ordered.map((l) => l.id));

  const counts = {};
  for (const l of stack) counts[l.id] = (counts[l.id] || 0) + 1;
  tiles.setCounts(counts);
  sections.setDepths(Object.fromEntries(sections.sections.map((s) => [s.id, counts[s.layer] || 0])));
  document.body.classList.toggle('has-sections', stack.length > 0);

  renderChips(ordered);
  classification.hidden = !counts.softmax;
  resetBtn.hidden = stack.length === 0;
  const labels = ordered.map((l) => LAYERS[l.id].label);
  canvas.setAttribute('aria-label', labels.length ? `${SITE.name}, processed by: ${labels.join(', ')}` : SITE.name);
  return counts;
}

// Bring a section into view: just enough to see it when applied from the
// tiles (so the name stays on screen where possible), or to its top from nav.
function revealSection(id, block = 'nearest') {
  requestAnimationFrame(() => {
    sections.element(id).scrollIntoView({ behavior: scrollBehavior(), block });
  });
}

const scrollBehavior = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

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
      const rest = chipList.querySelectorAll('.chip-remove');
      (rest[Math.min(idx, rest.length - 1)] || document.querySelector('.tile')).focus();
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
