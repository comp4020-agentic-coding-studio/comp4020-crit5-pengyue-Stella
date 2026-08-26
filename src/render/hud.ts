// Screen-space readouts only --- drawn after ctx.restore() in main.ts's
// render(), the same convention drawJoystick already uses, never inside the
// translated world-space block.
export function drawScoreHud(ctx: CanvasRenderingContext2D, score: number): void {
  const label = `${score}`;
  ctx.save();
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillText(label, 21, 17);
  ctx.fillStyle = "#f2ece0";
  ctx.fillText(label, 20, 16);
  ctx.restore();
}
