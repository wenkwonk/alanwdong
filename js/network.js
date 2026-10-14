// The network panel: the layers you have built, drawn as a stack of plates
// (input at the top, softmax always last), with a Run button that applies
// the pending ones. Plates for layers that have already run are solid;
// pending ones are dashed; all of them light up while the network runs.
export function createNetwork(root, layers, { onRun, onRemove, onReset }) {
  root.innerHTML = `
    <p class="net-title">Your network</p>
    <ol class="net-stack" aria-label="Layers in your network">
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
    render(ordered, running) {
      for (const row of rows.values()) row.remove();
      rows.clear();
      for (const { id, key, applied } of ordered) {
        const li = document.createElement('li');
        li.className = 'net-row';
        li.classList.toggle('is-pending', !applied);
        li.classList.toggle('is-running', running);
        const plate = document.createElement('span');
        plate.className = `plate ${layers[id].output ? 'plate-output' : ''}`;
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
        x.setAttribute('aria-label', `Remove ${layers[id].label}${applied ? '' : ' (not run yet)'}`);
        x.disabled = running;
        x.addEventListener('click', () => onRemove(key));
        li.append(plate, label, x);
        list.append(li);
        rows.set(key, li);
      }
      const pending = ordered.filter((l) => !l.applied).length;
      empty.hidden = ordered.length > 0;
      runBtn.disabled = pending === 0 || running;
      runBtn.textContent = running ? 'Running…'
        : pending ? `▶ Run ${pending} layer${pending > 1 ? 's' : ''}` : '▶ Run';
      resetBtn.hidden = ordered.length === 0;
      resetBtn.disabled = running;
    },

    plateRect(key) {
      return rows.get(key)?.querySelector('.plate').getBoundingClientRect();
    },

    focusRun: () => runBtn.focus(),
  };
}
