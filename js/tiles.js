const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag

// Builds a <button> per layer in `container`. Every way of choosing a tile
// (click, tap, Enter/Space, or dragging it onto `target`) calls apply(id).
// Dragging uses Pointer Events so it works the same for mouse, pen and touch.
export function createTiles(container, layers, target, apply) {
  const buttons = {};

  for (const [id, layer] of Object.entries(layers)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile';
    btn.dataset.id = id;
    btn.append(tileFace(layer));
    enableDrag(btn, target, () => apply(id));
    container.append(btn);
    buttons[id] = btn;
  }

  return {
    // Show how many times each tile is in the stack.
    setCounts(counts) {
      for (const [id, btn] of Object.entries(buttons)) {
        const n = counts[id] || 0;
        btn.classList.toggle('is-applied', n > 0);
        btn.querySelector('.tile-count').textContent = n > 1 ? `×${n}` : '';
        const label = layers[id].label;
        btn.setAttribute('aria-label', n ? `${label}, applied ${n} time${n > 1 ? 's' : ''}` : label);
      }
    },
  };
}

// The tile shows what the layer really is: its 3×3 weights (or, for the
// softmax output layer, a probability vector), its name, and a repeat count.
function tileFace(layer) {
  const face = document.createDocumentFragment();
  const grid = document.createElement('span');
  grid.setAttribute('aria-hidden', 'true');
  if (layer.kernel) {
    grid.className = 'tile-kernel';
    for (const v of layer.kernel) {
      const c = document.createElement('span');
      c.textContent = v;
      grid.append(c);
    }
  } else {
    grid.className = 'tile-kernel tile-probs';
    for (const v of layer.probs) {
      const c = document.createElement('span');
      c.textContent = v;
      grid.append(c);
    }
  }
  const matrix = document.createElement('span');
  matrix.className = 'tile-matrix';
  matrix.append(grid);
  if (layer.divisor) {
    const d = document.createElement('span');
    d.className = 'tile-divisor';
    d.setAttribute('aria-hidden', 'true');
    d.textContent = `÷${layer.divisor}`;
    matrix.append(d);
  }
  const label = document.createElement('span');
  label.className = 'tile-label';
  const [kind, name] = layer.label.split(' · ');
  const kindEl = document.createElement('span');
  kindEl.className = 'tile-kind';
  kindEl.textContent = `${kind} · `;
  label.append(kindEl, name);
  const count = document.createElement('span');
  count.className = 'tile-count';
  count.setAttribute('aria-hidden', 'true');
  face.append(matrix, label, count);
  return face;
}

function enableDrag(btn, target, onApply) {
  let start = null;      // pointerdown position, while the button is pressed
  let ghost = null;      // floating copy that follows the pointer
  let offset = null;     // pointer position inside the tile
  let suppressClick = false;

  btn.addEventListener('click', () => {
    if (suppressClick) suppressClick = false;
    else onApply();
  });

  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    suppressClick = false;
    btn.setPointerCapture(e.pointerId);
  });

  btn.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (!ghost) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
      const r = btn.getBoundingClientRect();
      offset = { x: start.x - r.left, y: start.y - r.top };
      ghost = btn.cloneNode(true);
      ghost.classList.add('tile-ghost');
      ghost.removeAttribute('id');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = r.width + 'px';
      document.body.append(ghost);
      btn.classList.add('is-dragging');
      target.classList.add('drop-armed');
    }
    ghost.style.transform = `translate(${e.clientX - offset.x}px, ${e.clientY - offset.y}px)`;
    target.classList.toggle('drop-ready', isOver(target, e));
  });

  const finish = (e, cancelled) => {
    if (!start) return;
    start = null;
    if (!ghost) return;
    suppressClick = true; // the click that follows a drag is not a tap
    const hit = !cancelled && isOver(target, e);
    target.classList.remove('drop-armed', 'drop-ready');
    btn.classList.remove('is-dragging');
    const g = ghost;
    ghost = null;
    if (hit) {
      onApply();
      fadeOut(g);
    } else {
      flyBack(g, btn);
    }
  };
  btn.addEventListener('pointerup', (e) => finish(e, false));
  btn.addEventListener('pointercancel', (e) => finish(e, true));
}

function isOver(el, e) {
  const r = el.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function fadeOut(g) {
  if (reducedMotion()) return g.remove();
  g.animate([{ opacity: 1 }, { opacity: 0, scale: 0.9 }], { duration: 160, easing: 'ease-out' }).onfinish = () => g.remove();
}

function flyBack(g, btn) {
  if (reducedMotion()) return g.remove();
  const r = btn.getBoundingClientRect();
  g.animate([{ transform: g.style.transform }, { transform: `translate(${r.left}px, ${r.top}px)` }], {
    duration: 220,
    easing: 'cubic-bezier(.2,.8,.2,1)',
  }).onfinish = () => g.remove();
}
