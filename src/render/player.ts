import type { Vec2 } from "../types.ts";

export interface PlayerVisualState {
  pos: Vec2;
  facing: 1 | -1;
  moving: boolean;
  /** seconds, accumulates every frame; drives the bob/swing phase */
  animTime: number;
  /** hat offset, lerped toward a target each frame so it lags behind the body */
  hatLag: Vec2;
  /** seconds remaining on a "just picked something up" hop; 0 when idle */
  pickupPulse: number;
  /** seconds remaining on a "nearby enemy just noticed me" startle; 0 when idle */
  alertBeat: number;
  /** true while any enemy is actively chasing within notice range */
  chased: boolean;
  /** true while escaping with the final treasure --- swaps the run pose to a two-handed carry */
  carryingTreasure: boolean;
}

export const PICKUP_PULSE_DURATION = 0.35;
export const ALERT_BEAT_DURATION = 0.4;

const IDLE_FREQ = 1.6;
const RUN_FREQ = 9;
const CHASE_FREQ_BOOST = 1.45;
const CHASE_BOB_BOOST = 1.55;
const CHASE_ARM_BOOST = 1.3;

// A front-on face reads far more expressive at this size than a profile eye
// would, while the limbs/hat/lean below still fully mirror with facing, so
// direction of travel is unambiguous from the body alone. One eye stays a
// plain patch (the clearest single "pirate" cue after the hat), which also
// means the emotive eye-widen/brow-lift below only has one eye to animate.
function drawFace(ctx: CanvasRenderingContext2D, alertProgress: number, worried: boolean, joyful: boolean): void {
  const eyeScale = 1 + alertProgress * 0.5;
  const eyeY = -17 - alertProgress * 1.5;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(3.6, eyeY, 2.6 * eyeScale, 3 * eyeScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241a12";
  ctx.beginPath();
  ctx.arc(3.6, eyeY + 0.4, 1.3 * eyeScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1310";
  ctx.beginPath();
  ctx.ellipse(-3.6, -17, 3.1, 3.6, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a1310";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-6.6, -19.5);
  ctx.lineTo(9, -22);
  ctx.stroke();

  ctx.strokeStyle = "#241a12";
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (worried) {
    ctx.moveTo(-6, -21.5);
    ctx.lineTo(-2, -20);
    ctx.moveTo(6, -21.5);
    ctx.lineTo(2, -20);
  } else {
    const browLift = alertProgress * 1.5;
    ctx.moveTo(-6, -21 - browLift);
    ctx.lineTo(-1.5, -21.5 - browLift);
    ctx.moveTo(6, -21 - browLift);
    ctx.lineTo(1.5, -21.5 - browLift);
  }
  ctx.stroke();

  ctx.fillStyle = "#c97a63";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(-6.5, -13.5, 1.7, 0, Math.PI * 2);
  ctx.arc(6.5, -13.5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  if (worried) {
    ctx.strokeStyle = "#241a12";
    ctx.lineWidth = 1;
    ctx.arc(0, -11.5, 1.3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (joyful) {
    ctx.strokeStyle = "#241a12";
    ctx.lineWidth = 1.2;
    ctx.arc(0, -12.5, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#241a12";
    ctx.lineWidth = 1;
    ctx.arc(0, -12, 1.8, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, phase: number): void {
  ctx.strokeStyle = "rgba(240, 240, 235, 0.55)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const y = -4 + i * 6;
    const flicker = Math.sin(phase * 2 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(-13 - i * 2, y + flicker);
    ctx.lineTo(-19 - i * 2, y + flicker);
    ctx.stroke();
  }
}

function drawSparkles(ctx: CanvasRenderingContext2D, progress: number): void {
  const spin = progress * Math.PI * 1.5;
  const radius = 15 + progress * 5;
  ctx.fillStyle = "#ffd75e";
  for (let i = 0; i < 3; i++) {
    const a = spin + (i / 3) * Math.PI * 2;
    const sx = Math.cos(a) * radius;
    const sy = -22 + Math.sin(a) * radius * 0.6;
    const s = 2.2 * (1 - progress);
    if (s <= 0) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.6);
    ctx.lineTo(s * 0.5, 0);
    ctx.lineTo(0, s * 1.6);
    ctx.lineTo(-s * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// A strong chibi pirate: an oversized head/hat over a small body and legs,
// no image assets. Direction reads from the mirrored body/limbs/hat, not the
// (deliberately front-facing) eyes; state reads from face + gesture, not text.
export function drawPirate(ctx: CanvasRenderingContext2D, state: PlayerVisualState): void {
  const { pos, facing, moving, animTime, hatLag, pickupPulse, alertBeat, chased, carryingTreasure } = state;
  const chaseBoost = moving && chased;
  const celebrating = pickupPulse > 0;
  const freq = (moving ? RUN_FREQ : IDLE_FREQ) * (chaseBoost ? CHASE_FREQ_BOOST : 1);
  const phase = animTime * freq;
  const bob = Math.sin(phase) * (moving ? 5 : 1.5) * (chaseBoost ? CHASE_BOB_BOOST : 1);
  const squash = 1 + Math.sin(phase) * (moving ? 0.1 : 0.02);
  const pickupProgress = celebrating ? 1 - pickupPulse / PICKUP_PULSE_DURATION : 0;
  const pickupHop = celebrating ? Math.sin(pickupProgress * Math.PI) * 9 : 0;
  const alertProgress = alertBeat / ALERT_BEAT_DURATION;
  const alertShake = alertBeat > 0 ? Math.sin(alertProgress * Math.PI * 4) * 3 * alertProgress : 0;
  const lean = moving ? (chaseBoost ? 0.3 : 0.13) : 0;

  ctx.save();
  ctx.translate(pos.x + alertShake, pos.y + bob - pickupHop);
  ctx.scale(facing * squash, 1 / squash);
  ctx.rotate(lean);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 16, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const legSwing = moving ? Math.sin(phase) * 5 : 0;
  ctx.fillStyle = "#4a3220";
  ctx.fillRect(-4.5 + legSwing * 0.35, 6, 3, 7);
  ctx.fillRect(1.5 - legSwing * 0.35, 6, 3, 7);
  ctx.fillStyle = "#1c1712";
  ctx.fillRect(-5 + legSwing * 0.35, 11.5, 4, 2.5);
  ctx.fillRect(1 - legSwing * 0.35, 11.5, 4, 2.5);
  ctx.fillStyle = "#8a6b42";
  ctx.fillRect(-5 + legSwing * 0.35, 11.5, 4, 1);
  ctx.fillRect(1 - legSwing * 0.35, 11.5, 4, 1);

  // Coat-tail flaps hang from the vest's waist and swing opposite the legs ---
  // drawn before the torso/vest so they read as *behind* the body, not on it.
  ctx.fillStyle = "#3a2412";
  ctx.beginPath();
  ctx.moveTo(-4.5, 6);
  ctx.quadraticCurveTo(-6 + legSwing * 0.3, 12, -2.5 + legSwing * 0.4, 14);
  ctx.lineTo(-1.5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4.5, 6);
  ctx.quadraticCurveTo(6 - legSwing * 0.3, 12, 2.5 - legSwing * 0.4, 14);
  ctx.lineTo(1.5, 7);
  ctx.closePath();
  ctx.fill();

  // Leather vest over a shirt --- a cream collar sliver + button dots read as
  // "open vest over shirt" without needing two full overlapping torso shapes.
  ctx.fillStyle = "#5a3a22";
  ctx.beginPath();
  ctx.ellipse(0, 1, 7.5, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d8c9a3";
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(-2.6, 1);
  ctx.lineTo(2.6, 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3a2412";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-6.5, 3);
  ctx.lineTo(6.5, 3);
  ctx.stroke();
  ctx.fillStyle = "#e9d9a8";
  ctx.beginPath();
  ctx.arc(0, 3.5, 0.9, 0, Math.PI * 2);
  ctx.arc(0, 6.5, 0.9, 0, Math.PI * 2);
  ctx.fill();

  const carryBob = Math.sin(phase) * 1.2;
  ctx.strokeStyle = "#5a3a22";
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (carryingTreasure) {
    ctx.moveTo(-6.5, -1);
    ctx.lineTo(-4, 4 + carryBob);
    ctx.moveTo(6.5, -1);
    ctx.lineTo(4, 4 + carryBob);
  } else if (celebrating) {
    ctx.moveTo(-6, -1);
    ctx.lineTo(-11, -12 + pickupHop * 0.3);
    ctx.moveTo(6, -1);
    ctx.lineTo(11, -12 + pickupHop * 0.3);
  } else {
    const armSwing = (moving ? Math.sin(phase + Math.PI) * 5.5 : Math.sin(animTime * IDLE_FREQ) * 1) * (chaseBoost ? CHASE_ARM_BOOST : 1);
    ctx.moveTo(-6.5, -1);
    ctx.lineTo(-10, 5 + armSwing);
    ctx.moveTo(6.5, -1);
    ctx.lineTo(10, 5 - armSwing);
  }
  ctx.stroke();

  if (carryingTreasure) {
    ctx.save();
    ctx.translate(0, 3 + carryBob);
    ctx.fillStyle = "#caa227";
    ctx.fillRect(-4.5, -3, 9, 6);
    ctx.fillStyle = "#8a6b1a";
    ctx.fillRect(-4.5, -0.5, 9, 1.4);
    ctx.strokeStyle = "#5a4310";
    ctx.lineWidth = 1;
    ctx.strokeRect(-4.5, -3, 9, 6);
    ctx.restore();
  }

  if (chaseBoost) drawSpeedLines(ctx, phase);

  ctx.fillStyle = "#e8b98a";
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fill();

  drawFace(ctx, alertProgress, chased && !celebrating, celebrating);

  ctx.save();
  ctx.translate(hatLag.x, hatLag.y - 1);
  if (!moving) ctx.rotate(Math.sin(animTime * IDLE_FREQ) * 0.05);

  // Large bicorne silhouette --- reads as "pirate captain" before any other
  // detail; deliberately wider than the head (44px vs the 24px head) so it
  // stays an unambiguous hat, not a bandana, at gameplay scale.
  ctx.fillStyle = "#241a12";
  ctx.beginPath();
  ctx.moveTo(-22, -20);
  ctx.quadraticCurveTo(-25, -31, -9, -35);
  ctx.quadraticCurveTo(0, -41, 9, -35);
  ctx.quadraticCurveTo(25, -31, 22, -20);
  ctx.quadraticCurveTo(11, -26, 0, -25);
  ctx.quadraticCurveTo(-11, -26, -22, -20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0f0a06";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "#e9d9a8";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-18, -21.5);
  ctx.quadraticCurveTo(0, -25.5, 18, -21.5);
  ctx.stroke();

  ctx.fillStyle = "#e9d9a8";
  ctx.beginPath();
  ctx.arc(0, -30, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a6b1a";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (alertBeat > ALERT_BEAT_DURATION * 0.4) {
    const t = 1 - (alertBeat - ALERT_BEAT_DURATION * 0.4) / (ALERT_BEAT_DURATION * 0.6);
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.min(t, 1) * Math.PI);
    ctx.fillStyle = "#fff6d8";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.scale(facing, 1);
    ctx.fillText("!", 0, -40 - t * 4);
    ctx.restore();
  }

  if (celebrating) drawSparkles(ctx, pickupProgress);

  ctx.restore();
}
