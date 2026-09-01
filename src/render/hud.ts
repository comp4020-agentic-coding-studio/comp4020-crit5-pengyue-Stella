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

const FRAGMENT_HUD_X0 = 20;
const FRAGMENT_HUD_Y = 58;
const FRAGMENT_HUD_SPACING = 24;

// A persistent 1-per-fragment readout, filled in as each is collected --- the
// playtest found the win condition unclear moment-to-moment; this is the
// "how close am I" answer that a transient callout alone can't give.
export function drawFragmentHud(ctx: CanvasRenderingContext2D, collected: number, total: number): void {
  ctx.save();
  for (let i = 0; i < total; i++) {
    const cx = FRAGMENT_HUD_X0 + i * FRAGMENT_HUD_SPACING;
    const filled = i < collected;
    ctx.save();
    ctx.translate(cx, FRAGMENT_HUD_Y);
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.lineTo(6, -6);
    ctx.lineTo(7, 5);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.fillStyle = filled ? "#c9a86b" : "rgba(242, 236, 224, 0.18)";
    ctx.strokeStyle = filled ? "#5a4a30" : "rgba(242, 236, 224, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// Longer and louder than the ambient danger callouts (render/callout.ts) ---
// these mark the three progression beats (X revealed, treasure secured, and
// the escape-mode swap that follows) as one-time events the player can't miss
// regardless of where the camera happens to be looking.
export const STORY_BANNER_DURATION = 2.6;
const BANNER_FADE_IN = 0.3;
const BANNER_FADE_OUT = 0.7;

const BANNER_MAX_FONT = 24;
const BANNER_MIN_FONT = 14;
const BANNER_SIDE_MARGIN = 16;

// Phone viewport (390px) is narrower than a 24px banner can fit the longer
// progression lines into --- shrink the font down (never wrap) until the box
// clears the screen edges, bottoming out at BANNER_MIN_FONT rather than
// growing past the viewport.
export function drawStoryBanner(ctx: CanvasRenderingContext2D, viewport: Size, text: string, timer: number): void {
  const age = STORY_BANNER_DURATION - timer;
  const alpha = Math.min(1, age / BANNER_FADE_IN, timer / BANNER_FADE_OUT);
  if (alpha <= 0) return;

  const cx = viewport.width / 2;
  const y = 64;
  const maxTextWidth = viewport.width - BANNER_SIDE_MARGIN * 2 - 40;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = BANNER_MAX_FONT;
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  let width = ctx.measureText(text).width;
  if (width > maxTextWidth) {
    fontSize = Math.max(BANNER_MIN_FONT, Math.floor((fontSize * maxTextWidth) / width));
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    width = ctx.measureText(text).width;
  }

  const boxX = cx - width / 2 - 20;
  const boxY = y - 24;
  const boxW = width + 40;
  const boxH = 48;

  ctx.fillStyle = "rgba(20, 14, 8, 0.7)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = "rgba(242, 201, 76, 0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#f2c94c";
  ctx.fillText(text, cx, y);
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
