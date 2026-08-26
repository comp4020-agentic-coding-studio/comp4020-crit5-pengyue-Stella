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
