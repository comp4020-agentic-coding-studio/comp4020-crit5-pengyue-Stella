import type { Size } from "../types.ts";

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

// Terminal-state overlay --- plain text, no on-screen instructions beyond the
// restart hint (the spec forbids "how to play" copy, not a one-line restart
// prompt). Drawn screen-space, same convention as drawScoreHud above.
export function drawEndScreen(ctx: CanvasRenderingContext2D, viewport: Size, won: boolean, score: number): void {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;

  ctx.save();
  ctx.fillStyle = "rgba(8, 6, 4, 0.72)";
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "700 48px system-ui, sans-serif";
  ctx.fillStyle = won ? "#f2c94c" : "#e0645a";
  ctx.fillText(won ? "You win" : "You lose", cx, cy - 24);

  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillStyle = "#f2ece0";
  ctx.fillText(`Score: ${score}`, cx, cy + 20);

  ctx.font = "400 16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(242, 236, 224, 0.7)";
  ctx.fillText("Tap or press any key to play again", cx, cy + 54);
  ctx.restore();
}
