import { SECTIONS } from './content.js';

// Renders every section from content.js into `root` (all hidden at first)
// and shows each one at a given depth. Content is real HTML text; the
// canvas is decoration only.
export function createSections(root, layers, onMore) {
  const views = {};

  for (const sec of SECTIONS) {
    const label = layers[sec.layer].label;
    const el = h('section', { id: sec.id, class: 'section', hidden: '', 'aria-labelledby': `${sec.id}-title` });
    const tag = h('p', { class: 'section-layer' });
    const title = h('h2', { id: `${sec.id}-title`, class: 'section-title' }, sec.title);
    const list = h('ul', { class: 'items' }, ...sec.items.map(renderItem));
    const more = h('button', { type: 'button', class: 'more' }, `More detail: apply ${label} again`);
    more.addEventListener('click', () => onMore(sec.layer));
    el.append(tag, title, list, more);
    root.append(el);

    const depthEls = [...el.querySelectorAll('[data-depth]')];
    const max = Math.max(...depthEls.map((d) => +d.dataset.depth));
    views[sec.id] = { sec, el, tag, more, depthEls, max, label, depth: 0 };
  }

  return {
    sections: SECTIONS,
    maxDepth: (id) => views[id].max,

    // `depths` maps section id → requested depth (0 hides it). Depth past
    // the section's maximum shows everything.
    setDepths(depths) {
      for (const v of Object.values(views)) {
        const d = Math.min(depths[v.sec.id] || 0, v.max);
        if (d === v.depth) continue;
        v.el.hidden = d === 0;
        for (const e of v.depthEls) {
          const show = d >= +e.dataset.depth;
          if (show && e.hidden) enter(e);
          e.hidden = !show;
        }
        if (d > 0 && v.depth === 0) enter(v.el);
        v.tag.textContent = v.max > 1 ? `${v.label} · depth ${d} of ${v.max}` : v.label;
        v.more.hidden = d >= v.max;
        v.depth = d;
      }
    },

    element: (id) => views[id].el,
  };
}

function renderItem(item) {
  const head = item.href
    ? h('a', { class: 'item-meta', href: item.href, ...(item.href.startsWith('http') ? { rel: 'noopener', target: '_blank' } : {}) }, item.meta)
    : h('p', { class: 'item-meta' }, ...rich(item.meta));
  const li = h('li', { class: 'item', 'data-depth': item.depth || 1 },
    h('h3', { class: 'item-title' }, ...rich(item.title)), head);
  if (item.summary) li.append(h('p', { class: 'item-summary', 'data-depth': 2 }, ...rich(item.summary)));
  if (item.details) {
    li.append(h('ul', { class: 'item-details', 'data-depth': 3 },
      ...item.details.map((d) => h('li', {}, ...rich(d)))));
  }
  return li;
}

// Fade/rise in. Skipped under reduced motion (the CSS animation is off).
function enter(el) {
  el.classList.remove('entering');
  void el.offsetWidth; // restart the animation if it was mid-way
  el.classList.add('entering');
  el.addEventListener('animationend', () => el.classList.remove('entering'), { once: true });
}

// '*text*' → <em>text</em>; everything else as plain text nodes.
function rich(text) {
  return text.split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? h('em', {}, part) : part));
}

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}
