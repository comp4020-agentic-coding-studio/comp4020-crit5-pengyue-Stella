import type { Vec2 } from "../types.ts";

export interface PlayerVisualState {
  pos: Vec2;
  facing: 1 | -1;
  moving: boolean;
  /** seconds, accumulates every frame; drives the bob/swing phase */
  animTime: number;
  /** bandana offset, lerped toward a target each frame so it lags behind the body */
  hatLag: Vec2;
  /** seconds remaining on a "just picked something up" hop; 0 when idle */
  pickupPulse: number;
  /** seconds remaining on a "nearby enemy just noticed me" startle; 0 when idle */
  alertBeat: number;
  /** true while any enemy is actively chasing within notice range */
  chased: boolean;
}

export const PICKUP_PULSE_DURATION = 0.35;
export const ALERT_BEAT_DURATION = 0.4;

const IDLE_FREQ = 1.6;
const RUN_FREQ = 9;
const CHASE_FREQ_BOOST = 1.3;
const CHASE_BOB_BOOST = 1.35;

// Two round eyes stay centred on the head rather than mirroring with facing
// --- a small front-on "face" reads far more expressive at this size than a
// profile eye would, while the limbs/hat/lean below still fully mirror, so
// direction of travel is unambiguous from the body alone.
function drawFace(ctx: CanvasRenderingContext2D, alertProgress: number, worried: boolean, joyful: boolean): void {
  const eyeScale = 1 + alertProgress * 0.5;
  const eyeY = -17 - alertProgress * 1.5;
  for (const ex of [-3.6, 3.6]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 2.6 * eyeScale, 3 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#241a12";
    ctx.beginPath();
    ctx.arc(ex, eyeY + 0.4, 1.3 * eyeScale, 0, Math.PI * 2);
    ctx.fill();
  }

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
  const { pos, facing, moving, animTime, hatLag, pickupPulse, alertBeat, chased } = state;
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
  const lean = moving ? (chaseBoost ? 0.22 : 0.13) : 0;

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

  ctx.fillStyle = "#7a2e2e";
  ctx.beginPath();
  ctx.ellipse(0, 1, 7.5, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a1f1f";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-6.5, 3);
  ctx.lineTo(6.5, 3);
  ctx.stroke();

  ctx.strokeStyle = "#7a2e2e";
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (celebrating) {
    ctx.moveTo(-6, -1);
    ctx.lineTo(-11, -12 + pickupHop * 0.3);
    ctx.moveTo(6, -1);
    ctx.lineTo(11, -12 + pickupHop * 0.3);
  } else {
    const armSwing = moving ? Math.sin(phase + Math.PI) * 5.5 : Math.sin(animTime * IDLE_FREQ) * 1;
    ctx.moveTo(-6.5, -1);
    ctx.lineTo(-10, 5 + armSwing);
    ctx.moveTo(6.5, -1);
    ctx.lineTo(10, 5 - armSwing);
  }
  ctx.stroke();

  if (chaseBoost) drawSpeedLines(ctx, phase);

  ctx.fillStyle = "#e8b98a";
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fill();

  drawFace(ctx, alertProgress, chased && !celebrating, celebrating);

  ctx.save();
  ctx.translate(hatLag.x, hatLag.y - 1);
  if (!moving) ctx.rotate(Math.sin(animTime * IDLE_FREQ) * 0.05);

  ctx.fillStyle = "#3a2a1a";
  ctx.beginPath();
  ctx.ellipse(-9, -24, 3, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#b3241f";
  ctx.beginPath();
  ctx.moveTo(-14, -22);
  ctx.quadraticCurveTo(0, -37, 14, -22);
  ctx.quadraticCurveTo(0, -27, -14, -22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -21);
  ctx.quadraticCurveTo(22, -15, 17, -6);
  ctx.quadraticCurveTo(14, -16, 10, -19);
  ctx.fill();

  ctx.fillStyle = "#e9d9a8";
  ctx.beginPath();
  ctx.arc(-3, -28, 1.6, 0, Math.PI * 2);
  ctx.arc(3, -28, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e9d9a8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3, -26.5);
  ctx.lineTo(-2, -24.5);
  ctx.lineTo(2, -24.5);
  ctx.lineTo(3, -26.5);
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
