// Theme colors as [r, g, b], read from the CSS custom properties.
export function theme() {
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: parseColor(cs.getPropertyValue('--bg')),
    ink: parseColor(cs.getPropertyValue('--ink')),
    shadow: parseColor(cs.getPropertyValue('--shadow')),
  };
}

// Ink buffer → canvas. Positive values draw as ink, negative as shadow; the
// canvas stays transparent so the page background shows through.
export function paint(buf, w, h, colors = theme()) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const { ink, shadow } = colors;
  for (let i = 0, j = 0; i < buf.length; i++, j += 4) {
    const v = buf[i];
    const col = v >= 0 ? ink : shadow;
    d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2];
    d[j + 3] = Math.min(Math.abs(v), 1) * 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// '#rrggbb' or 'rgb(r, g, b)' → [r, g, b]
export function parseColor(str) {
  str = str.trim();
  if (str.startsWith('#')) {
    const n = parseInt(str.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return str.match(/[\d.]+/g).slice(0, 3).map(Number);
}

export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
