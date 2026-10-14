// Draws one frame of a convolution sweep onto `ctx` (a canvas the same size
// as `input` and `output`). At progress p ∈ [0, 1], a 3×3 window showing the
// kernel's weights has stepped across in raster order: `output` is shown
// where its centre has passed, `input` everywhere else. `k` is device pixels
// per CSS pixel of the canvas as displayed (for sizing the window's text).
export function drawSweep(ctx, input, output, layer, p, k, colors) {
  const W = input.width, H = input.height;
  const bands = Math.max(2, Math.min(9, Math.round(H / k / 60)));
  const cell = H / bands / 3;
  const win = cell * 3;
  const cols = Math.ceil(W / cell);
  const pos = Math.min(p, 0.99999) * bands;
  const band = Math.floor(pos);
  const cx = p < 1 ? (Math.floor((pos - band) * cols) + 0.5) * cell : W;
  const top = p < 1 ? band * win : H;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(input, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, top);
  ctx.rect(0, top, cx, win);
  ctx.clip();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(output, 0, 0);
  ctx.restore();
  if (p >= 1) return;

  const x = Math.min(Math.max(cx - win / 2, 0), W - win), y = top;
  const { ink, bg } = colors;
  ctx.fillStyle = `rgba(${bg}, 0.55)`;
  ctx.fillRect(x, y, win, win);
  ctx.strokeStyle = `rgb(${ink})`;
  ctx.lineWidth = k;
  ctx.beginPath();
  for (let i = 0; i <= 3; i++) {
    ctx.moveTo(x + i * cell, y); ctx.lineTo(x + i * cell, y + win);
    ctx.moveTo(x, y + i * cell); ctx.lineTo(x + win, y + i * cell);
  }
  ctx.stroke();
  if (layer.kernel && cell / k >= 12) {
    ctx.fillStyle = `rgb(${ink})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.min(13 * k, cell * 0.45)}px ui-monospace, Menlo, monospace`;
    layer.kernel.forEach((v, i) => {
      ctx.fillText(String(v), x + (i % 3 + 0.5) * cell, y + (Math.floor(i / 3) + 0.5) * cell);
    });
  }
}
