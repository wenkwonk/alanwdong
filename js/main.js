import { LAYERS } from './layers.js';
import { createStage } from './stage.js';
import { createTiles } from './tiles.js';

const canvas = document.getElementById('name-canvas');
const chipList = document.getElementById('chips');
const resetBtn = document.getElementById('reset');
const status = document.getElementById('status');
const classification = document.getElementById('classification');

const stage = createStage(canvas, 'Alan Dong');
const tiles = createTiles(document.getElementById('tiles'), LAYERS, canvas.parentElement, applyLayer);

// The whole UI state: applied layers in order. `key` tells repeats apart.
let stack = [];
let nextKey = 0;

function applyLayer(id) {
  stack.push({ id, key: nextKey++ });
  update();
  announce(`Applied ${LAYERS[id].label}.`);
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
}

function update() {
  // Shown (and rendered) with output stages last, matching the network.
  const ordered = [...stack.filter((l) => !LAYERS[l.id].output), ...stack.filter((l) => LAYERS[l.id].output)];
  stage.setStack(ordered.map((l) => l.id));

  const counts = {};
  for (const l of stack) counts[l.id] = (counts[l.id] || 0) + 1;
  tiles.setCounts(counts);

  renderChips(ordered);
  classification.hidden = !counts.softmax;
  resetBtn.hidden = stack.length === 0;
  const labels = ordered.map((l) => LAYERS[l.id].label);
  canvas.setAttribute('aria-label', labels.length ? `Alan Dong, processed by: ${labels.join(', ')}` : 'Alan Dong');
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

resetBtn.addEventListener('click', reset);
update();
