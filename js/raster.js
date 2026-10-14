import { theme, luminance } from './paint.js';

// Rasterizes what is visible of `root` inside the viewport rectangle `r`
// (canvases and text) into an ink buffer: 0 = background, 1 = full ink.
//
// Text is redrawn word by word at the exact positions the browser laid it
// out (via Range.getClientRects), in the same font and color. This avoids the
// SVG <foreignObject> trick, which taints the canvas in Safari.
export function rasterize(root, r, scale) {
  const w = Math.max(1, Math.round(r.width * scale));
  const h = Math.max(1, Math.round(r.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const { bg, ink } = theme();
  ctx.fillStyle = `rgb(${bg})`;
  ctx.fillRect(0, 0, w, h);
  ctx.scale(scale, scale);
  ctx.translate(-r.left, -r.top);

  const inside = (b) => b.width > 1 && b.bottom > r.top && b.top < r.bottom && b.right > r.left && b.left < r.right;

  for (const cv of root.querySelectorAll('canvas')) {
    const b = cv.getBoundingClientRect();
    if (inside(b) && cv.offsetParent) ctx.drawImage(cv, b.left, b.top, b.width, b.height);
  }

  // Borders (chips, buttons, section rules), so they don't vanish mid-sweep.
  for (const el of root.querySelectorAll('*')) {
    if (!el.offsetParent) continue;
    const cs = getComputedStyle(el);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`border${s}Width`]));
    if (!bw.some((v) => v > 0) || cs.borderTopStyle === 'none' && cs.borderLeftStyle === 'none') continue;
    const b = el.getBoundingClientRect();
    if (!inside(b)) continue;
    ctx.strokeStyle = cs.borderTopColor;
    ctx.lineWidth = Math.max(...bw);
    ctx.setLineDash(cs.borderTopStyle === 'dashed' ? [4, 3] : []);
    ctx.beginPath();
    if (bw.every((v) => v > 0)) {
      const inset = ctx.lineWidth / 2;
      ctx.roundRect(b.left + inset, b.top + inset, b.width - 2 * inset, b.height - 2 * inset, parseFloat(cs.borderTopLeftRadius) || 0);
    } else if (bw[0] > 0) {
      ctx.moveTo(b.left, b.top + bw[0] / 2);
      ctx.lineTo(b.right, b.top + bw[0] / 2);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const range = document.createRange();
  const styles = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node; (node = walker.nextNode());) {
    const el = node.parentElement;
    if (!node.data.trim() || !el.offsetParent) continue;
    let st = styles.get(el);
    if (!st) {
      const cs = getComputedStyle(el);
      st = {
        font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
        color: cs.color,
        spacing: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing,
      };
      styles.set(el, st);
    }
    ctx.font = st.font;
    ctx.fillStyle = st.color;
    if ('letterSpacing' in ctx) ctx.letterSpacing = st.spacing;

    for (const m of node.data.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const rects = range.getClientRects();
      if (!rects.length || !inside(rects[0])) continue;
      if (rects.length === 1) drawWord(ctx, m[0], rects[0]);
      else {
        // A word broken across lines (e.g. at a hyphen): place each character.
        for (let k = 0; k < m[0].length; k++) {
          range.setStart(node, m.index + k);
          range.setEnd(node, m.index + k + 1);
          const cr = range.getClientRects()[0];
          if (cr) drawWord(ctx, m[0][k], cr);
        }
      }
    }
  }

  // Pixels → ink: how far each pixel's luminance moved from the background
  // toward the ink color. Handles light/dark themes and muted text alike.
  const px = ctx.getImageData(0, 0, w, h).data;
  const lb = luminance(bg);
  const span = luminance(ink) - lb;
  const out = new Float32Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    const v = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2] - lb) / span;
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return { buf: out, w, h };
}

// Draw `text` so its glyphs sit where the browser put them in `rect`.
function drawWord(ctx, text, rect) {
  const m = ctx.measureText(text);
  const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
  const baseline = rect.top + (rect.height - (asc + desc)) / 2 + asc;
  ctx.fillText(text, rect.left, baseline);
}

