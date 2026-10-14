const DRAG_THRESHOLD = 4; // px before a press on a plate becomes a reorder drag

// The network panel: the layers you have built, drawn as a stack of plates
// (input at the top, softmax always last), with a Run button. Conv plates
// can be reordered by dragging, or with ↑/↓ when focused. Plates for layers
// included in the last run are solid; new ones are dashed; all of them light
// up while the network runs.
export function createNetwork(root, layers, { onRun, onRemove, onReset, onMove }) {
  root.innerHTML = `
    <p class="net-title">Your network</p>
    <ol class="net-stack" aria-label="Layers in your network, in order">
      <li class="net-row net-input">
        <span class="plate plate-input" aria-hidden="true"></span>
        <span class="net-label"><span class="net-kind">input · </span>name</span>
      </li>
    </ol>
    <p class="net-empty">Drop layers here.</p>
    <button type="button" class="net-run"></button>
    <button type="button" class="net-reset">Reset</button>
    <p class="net-note" data-text="networkNote"></p>`;
  const list = root.querySelector('.net-stack');
  const empty = root.querySelector('.net-empty');
  const runBtn = root.querySelector('.net-run');
  const resetBtn = root.querySelector('.net-reset');
  runBtn.addEventListener('click', onRun);
  resetBtn.addEventListener('click', onReset);
  const rows = new Map();   // key → <li>

  return {
    // `ordered`: [{ id, key, applied }] in run order. `running`: a run is on.
    // `changed`: the network differs from the last run (e.g. reordered).
    render(ordered, running, changed) {
      const focusedKey = [...rows].find(([, li]) => li === document.activeElement)?.[0];
      for (const row of rows.values()) row.remove();
      rows.clear();
      const convCount = ordered.filter((l) => !layers[l.id].output).length;
      let position = 0;
      for (const { id, key, applied } of ordered) {
        const isConv = !layers[id].output;
        if (isConv) position++;
        const li = document.createElement('li');
        li.className = 'net-row';
        li.classList.toggle('is-pending', !applied);
        li.classList.toggle('is-running', running);
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
        x.setAttribute('aria-label', `Remove ${layers[id].label}`);
        x.disabled = running;
        x.addEventListener('click', () => onRemove(key));
        li.append(plate, label, x);
        if (isConv && !running) {
          li.tabIndex = 0;
          li.classList.add('is-movable');
          li.setAttribute('aria-label', `${layers[id].label}, layer ${position} of ${convCount}${applied ? '' : ', not run yet'}. Arrow keys move it.`);
          li.addEventListener('keydown', (e) => {
            if (e.target !== li || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
            e.preventDefault();
            onMove(key, e.key === 'ArrowUp' ? -1 : 1);
          });
          enableReorder(li, list, (steps) => onMove(key, steps));
        }
        list.append(li);
        rows.set(key, li);
      }
      if (focusedKey != null) rows.get(focusedKey)?.focus();

      const needsRun = ordered.some((l) => !l.applied) || changed;
      empty.hidden = ordered.length > 0;
      runBtn.disabled = !needsRun || running;
      runBtn.textContent = running ? 'Running…'
        : needsRun ? `▶ Run ${ordered.length} layer${ordered.length > 1 ? 's' : ''}` : '▶ Run';
      resetBtn.hidden = ordered.length === 0;
      resetBtn.disabled = running;
    },

    plateRect(key) {
      return rows.get(key)?.querySelector('.plate').getBoundingClientRect();
    },

    focusRun: () => runBtn.focus(),
  };
}

// Drag a conv plate along the stack (vertical panel or horizontal strip).
// Calls move(steps) with how many places it moved, + toward the output.
function enableReorder(li, list, move) {
  li.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const vertical = getComputedStyle(list).flexDirection.startsWith('column');
    const axis = vertical ? 'clientY' : 'clientX';
    const start = e[axis];
    const siblings = [...list.querySelectorAll('.is-movable')];
    const index = siblings.indexOf(li);
    const mids = siblings.map((s) => {
      const r = s.getBoundingClientRect();
      return vertical ? r.top + r.height / 2 : r.left + r.width / 2;
    });
    let dragging = false;
    li.setPointerCapture(e.pointerId);

    const onMoveEvt = (ev) => {
      const d = ev[axis] - start;
      if (!dragging && Math.abs(d) < DRAG_THRESHOLD) return;
      dragging = true;
      li.classList.add('is-dragging');
      li.style.transform = vertical ? `translateY(${d}px)` : `translateX(${d}px)`;
    };
    const onUp = (ev) => {
      li.removeEventListener('pointermove', onMoveEvt);
      li.removeEventListener('pointerup', onUp);
      li.removeEventListener('pointercancel', onUp);
      li.classList.remove('is-dragging');
      li.style.transform = '';
      if (!dragging || ev.type === 'pointercancel') return;
      // New index: how many other plates' midpoints the pointer has passed.
      const p = mids[index] + (ev[axis] - start);
      let target = 0;
      mids.forEach((m, i) => { if (i !== index && p > m) target++; });
      if (target !== index) move(target - index);
    };
    li.addEventListener('pointermove', onMoveEvt);
    li.addEventListener('pointerup', onUp);
    li.addEventListener('pointercancel', onUp);
  });
}
