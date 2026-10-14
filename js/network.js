// 3 × 4 = 12 filters: enough for every conv kernel 3 times (each section
// at full depth). Wider layers rather than more of them keeps the feature
// maps readable, since layers spread across the screen.
export const MAX_LAYERS = 3;
export const MAX_FILTERS = 4;   // per layer
const DRAG_THRESHOLD = 4;       // px before a press on a filter becomes a drag

// The network panel. The input at the top, then each conv layer as a group
// of filters (drawn as plates), then the softmax output if added. Click a
// layer's header to select it: new filters go to the selected layer. Filters
// can be dragged to another layer, or moved with ↑/↓ when focused. Filters
// included in the last run are solid; new ones are dashed; everything lights
// up while the network runs.
export function createNetwork(root, layers, { onRun, onRemove, onReset, onMove, onSelect, onAddLayer }) {
  root.innerHTML = `
    <p class="net-title">Your network</p>
    <div class="net-flow">
      <div class="net-row net-input">
        <span class="plate plate-input" aria-hidden="true"></span>
        <span class="net-label"><span class="net-kind">input · </span>name</span>
      </div>
      <ol class="net-layers" aria-label="Layers"></ol>
      <button type="button" class="net-add">+ Layer</button>
      <div class="net-output"></div>
    </div>
    <button type="button" class="net-run"></button>
    <button type="button" class="net-reset">Reset</button>`;
  const groups = root.querySelector('.net-layers');
  const output = root.querySelector('.net-output');
  const addBtn = root.querySelector('.net-add');
  const runBtn = root.querySelector('.net-run');
  const resetBtn = root.querySelector('.net-reset');
  runBtn.addEventListener('click', onRun);
  resetBtn.addEventListener('click', onReset);
  addBtn.addEventListener('click', onAddLayer);
  const rows = new Map();   // key → row element

  function filterRow({ id, key, applied }, running, where) {
    const row = document.createElement('li');
    row.className = 'net-row';
    row.classList.toggle('is-pending', !applied);
    row.classList.toggle('is-running', running);
    const isConv = !layers[id].output;
    const plate = document.createElement('span');
    plate.className = `plate ${isConv ? '' : 'plate-output'}`;
    plate.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'net-label';
    const [kind, name] = layers[id].label.split(' · ');
    label.innerHTML = '<span class="net-kind"></span>';
    label.firstChild.textContent = `${kind} · `;
    label.append(name);
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'net-remove';
    x.textContent = '×';
    x.setAttribute('aria-label', `Remove ${layers[id].label}${where}`);
    x.disabled = running;
    x.addEventListener('click', () => onRemove(key));
    row.append(plate, label, x);
    if (isConv && !running) {
      row.tabIndex = 0;
      row.classList.add('is-movable');
      row.setAttribute('aria-label', `${layers[id].label}${where}${applied ? '' : ', not run yet'}. Arrow keys move it between layers.`);
      row.addEventListener('keydown', (e) => {
        if (e.target !== row || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        onMove(key, { by: e.key === 'ArrowUp' ? -1 : 1 });
      });
      enableDrag(row, groups, (layer) => onMove(key, { to: layer }));
    }
    rows.set(key, row);
    return row;
  }

  return {
    // state: { filters: [{ id, key, applied, layer }], outputs: [...],
    //          layerCount, active, running, changed }
    render({ filters, outputs, layerCount, active, running, changed }) {
      const focusedKey = [...rows].find(([, r]) => r === document.activeElement)?.[0];
      rows.clear();
      groups.replaceChildren();
      for (let i = 0; i < layerCount; i++) {
        const inLayer = filters.filter((f) => f.layer === i);
        const g = document.createElement('li');
        g.className = 'net-layer';
        g.dataset.layer = i;
        g.classList.toggle('is-active', i === active && !running);
        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'net-layer-head';
        head.textContent = `Layer ${i + 1}`;
        const count = document.createElement('span');
        count.textContent = ` · ${inLayer.length}/${MAX_FILTERS}`;
        head.append(count);
        head.setAttribute('aria-pressed', String(i === active));
        head.setAttribute('aria-label', `Layer ${i + 1}, ${inLayer.length} of ${MAX_FILTERS} filters${i === active ? ', selected' : ''}`);
        head.disabled = running;
        head.addEventListener('click', () => onSelect(i));
        const list = document.createElement('ul');
        list.className = 'net-filters';
        for (const f of inLayer) list.append(filterRow(f, running, `, layer ${i + 1}`));
        if (!inLayer.length) {
          const hint = document.createElement('li');
          hint.className = 'net-layer-empty';
          hint.textContent = 'Drop filters here';
          list.append(hint);
        }
        g.append(head, list);
        groups.append(g);
      }
      output.replaceChildren(...outputs.map((o) => filterRow(o, running, '')));
      if (focusedKey != null) rows.get(focusedKey)?.focus();

      const all = [...filters, ...outputs];
      const needsRun = all.some((l) => !l.applied) || changed;
      addBtn.hidden = layerCount >= MAX_LAYERS;
      addBtn.disabled = running;
      runBtn.disabled = !needsRun || running || !filters.length && !outputs.length;
      runBtn.textContent = running ? 'Running…' : '▶ Run';
      resetBtn.hidden = all.length === 0;
      resetBtn.disabled = running;
    },

    plateRect(key) {
      return rows.get(key)?.querySelector('.plate').getBoundingClientRect();
    },

    // Which layer group is under a viewport point (for tile drops), or null.
    layerAt(x, y) {
      const g = document.elementFromPoint(x, y)?.closest('.net-layer');
      return g && root.contains(g) ? Number(g.dataset.layer) : null;
    },

    focusRun: () => runBtn.focus(),
  };
}

// Drag a filter to another layer group. Calls drop(layerIndex).
function enableDrag(row, groups, drop) {
  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    row.setPointerCapture(e.pointerId);
    const target = (ev) => {
      for (const g of groups.children) {
        const r = g.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) return g;
      }
      return null;
    };
    const onMove = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      dragging = true;
      row.classList.add('is-dragging');
      row.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px)`;
      const over = target(ev);
      for (const g of groups.children) g.classList.toggle('drop-ready', g === over);
    };
    const onUp = (ev) => {
      row.removeEventListener('pointermove', onMove);
      row.removeEventListener('pointerup', onUp);
      row.removeEventListener('pointercancel', onUp);
      row.classList.remove('is-dragging');
      row.style.transform = '';
      for (const g of groups.children) g.classList.remove('drop-ready');
      if (!dragging || ev.type === 'pointercancel') return;
      const over = target(ev);
      if (over) drop(Number(over.dataset.layer));
    };
    row.addEventListener('pointermove', onMove);
    row.addEventListener('pointerup', onUp);
    row.addEventListener('pointercancel', onUp);
  });
}
