import { LAYERS } from './layers.js';
import { createStage } from './stage.js';

const canvas = document.getElementById('name-canvas');
const stage = createStage(canvas, 'Alan Dong');

// The whole UI state: applied layer ids, in order.
const stack = [];

function applyLayer(id) {
  stack.push(id);
  stage.setStack(stack);
  canvas.setAttribute('aria-label', `Alan Dong, processed by: ${stack.map((l) => LAYERS[l].label).join(', ')}`);
}

const tiles = document.getElementById('tiles');
for (const [id, layer] of Object.entries(LAYERS)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tile';
  btn.textContent = layer.label;
  btn.addEventListener('click', () => applyLayer(id));
  tiles.append(btn);
}
