// Screen-space overlay, drawn after ctx.restore() like the HUD --- darkens
// everything beyond the player's current effective sight radius so a cave's
// shrink (or a torch's bonus) is felt continuously, not just as a one-time
// zone-entry colour change.
export function drawSightVignette(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  centerX: number,
  centerY: number,
  sightRadius: number,
): void {
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    sightRadius * 0.55,
    centerX,
    centerY,
    sightRadius * 1.15,
  );
  gradient.addColorStop(0, "rgba(4, 8, 14, 0)");
  gradient.addColorStop(1, "rgba(4, 8, 14, 0.55)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  ctx.restore();
}

const CHASE_PULSE_PERIOD = 260;

// Screen-edge red wash, centred on the viewport rather than the player ---
// unlike the sight vignette this isn't about what's visible, it's a HUD-style
// "something is actively hunting you" alert, so it pulses independently of
// player position and stays readable regardless of where on screen the chaser is.
export function drawChaseVignette(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number, now: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(now / CHASE_PULSE_PERIOD);
  const cx = viewportWidth / 2;
  const cy = viewportHeight / 2;
  const inner = Math.min(viewportWidth, viewportHeight) * 0.3;
  const outer = Math.max(viewportWidth, viewportHeight) * 0.62;

  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0, "rgba(178, 24, 20, 0)");
  gradient.addColorStop(1, `rgba(178, 24, 20, ${0.26 + pulse * 0.2})`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  ctx.restore();
}
