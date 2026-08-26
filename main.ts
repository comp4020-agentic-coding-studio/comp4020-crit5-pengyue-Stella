import { InputController } from "./src/input.ts";
import { updateCamera } from "./src/camera.ts";
import { advanceReveal, createMap, revealAround, worldSize } from "./src/map.ts";
import { createTrail, maybeRecordPoint } from "./src/trail.ts";
import { buildWorldLayout, WORLD_CELL_SIZE, WORLD_COLS, WORLD_ROWS, zoneAt } from "./src/world.ts";
import { collectNearby, createPickups } from "./src/pickups.ts";
import { createEnemies, updateEnemies } from "./src/enemies.ts";
import { checkLoss } from "./src/game-logic.ts";
import type { ProgressStatus } from "./src/game-logic.ts";
import { drawMap } from "./src/render/map.ts";
import { drawTrail } from "./src/render/trail.ts";
import { drawPirate, ALERT_BEAT_DURATION, PICKUP_PULSE_DURATION } from "./src/render/player.ts";
import type { PlayerVisualState } from "./src/render/player.ts";
import { drawJoystick } from "./src/render/joystick.ts";
import { drawShip } from "./src/render/ship.ts";
import { drawPickups } from "./src/render/pickups.ts";
import { drawEnemies } from "./src/render/enemies.ts";
import { drawScoreHud } from "./src/render/hud.ts";

function requireCanvas(): HTMLCanvasElement {
  const el = document.querySelector<HTMLCanvasElement>("#game");
  if (!el) throw new Error("missing #game canvas");
  return el;
}

function requireContext(el: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = el.getContext("2d");
  if (!context) throw new Error("2d context unavailable");
  return context;
}

const canvas = requireCanvas();
const ctx = requireContext(canvas);

const SIGHT_RADIUS = 170;
const PLAYER_SPEED = 190;
const HAT_LAG_DISTANCE = 5;
const HAT_LAG_SMOOTHING = 10;
const PLAYER_COLLISION_RADIUS = 10;
const ENEMY_COLLISION_RADIUS = 12;
const ALERT_NOTICE_RADIUS = 220;

const layout = buildWorldLayout();
const map = createMap(WORLD_COLS, WORLD_ROWS, WORLD_CELL_SIZE, layout);
const world = worldSize(map);

const player = {
  x: layout.shipPos.x,
  y: layout.shipPos.y,
  facing: 1 as 1 | -1,
  torchBonus: 0,
  speedTimer: 0,
};

const visual: PlayerVisualState = {
  pos: { x: player.x, y: player.y },
  facing: 1,
  moving: false,
  animTime: 0,
  hatLag: { x: 0, y: 0 },
  pickupPulse: 0,
  alertBeat: 0,
  chased: false,
};

const trail = createTrail(player.x, player.y);
const input = new InputController(canvas);
const pickups = createPickups(layout);
const enemies = createEnemies(layout);
let score = 0;
let status: ProgressStatus = "explore";
let previousAlertIds = new Set<string>();
let playerInCave = false;
const CHASE_NOTICE_RADIUS = 260;

const SPEED_BOOST_MULTIPLIER = 1.6;

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

revealAround(map, player.x, player.y, SIGHT_RADIUS, performance.now());

let lastTime = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(now, dt);
  render(now);
  requestAnimationFrame(frame);
}

function update(now: number, dt: number): void {
  if (status === "won" || status === "lost") return;

  const move = input.getMovement();
  const moving = move.x !== 0 || move.y !== 0;

  player.speedTimer = Math.max(0, player.speedTimer - dt);
  visual.pickupPulse = Math.max(0, visual.pickupPulse - dt);
  visual.alertBeat = Math.max(0, visual.alertBeat - dt);
  const speed = PLAYER_SPEED * (player.speedTimer > 0 ? SPEED_BOOST_MULTIPLIER : 1);

  if (moving) {
    player.x = clamp(player.x + move.x * speed * dt, 0, world.width);
    player.y = clamp(player.y + move.y * speed * dt, 0, world.height);
    if (move.x !== 0) player.facing = move.x > 0 ? 1 : -1;
  }

  visual.pos.x = player.x;
  visual.pos.y = player.y;
  visual.facing = player.facing;
  visual.moving = moving;
  visual.animTime += dt;

  const lagTargetX = moving ? -move.x * HAT_LAG_DISTANCE : 0;
  const lagTargetY = moving ? -move.y * HAT_LAG_DISTANCE : Math.sin(visual.animTime * 1.6) * 0.6;
  const lerp = Math.min(1, dt * HAT_LAG_SMOOTHING);
  visual.hatLag.x += (lagTargetX - visual.hatLag.x) * lerp;
  visual.hatLag.y += (lagTargetY - visual.hatLag.y) * lerp;

  const sightRadius = SIGHT_RADIUS + player.torchBonus;
  revealAround(map, player.x, player.y, sightRadius, now);
  advanceReveal(map, now);
  maybeRecordPoint(trail, player.x, player.y);

  const effect = collectNearby(pickups, { x: player.x, y: player.y });
  if (effect.scoreDelta !== 0 || effect.torchBonus > 0 || effect.speedTimerSeconds > 0) {
    score += effect.scoreDelta;
    player.torchBonus += effect.torchBonus;
    player.speedTimer += effect.speedTimerSeconds;
    visual.pickupPulse = PICKUP_PULSE_DURATION;
  }

  const zone = zoneAt(layout, player.x, player.y);
  playerInCave = zone === "cave";
  updateEnemies(enemies, {
    playerPos: { x: player.x, y: player.y },
    playerSightRadius: sightRadius,
    playerInCave,
    escapeBoost: status === "escaping",
    dt,
  });

  const currentAlertIds = new Set<string>();
  let startled = false;
  let nearbyChase = false;
  for (const enemy of enemies) {
    const dx = enemy.pos.x - player.x;
    const dy = enemy.pos.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (enemy.state === "chase" && dist <= CHASE_NOTICE_RADIUS) nearbyChase = true;

    if (enemy.state !== "alert") continue;
    currentAlertIds.add(enemy.id);
    if (previousAlertIds.has(enemy.id)) continue;
    if (dist <= ALERT_NOTICE_RADIUS) startled = true;
  }
  previousAlertIds = currentAlertIds;
  if (startled) visual.alertBeat = ALERT_BEAT_DURATION;
  visual.chased = nearbyChase;

  // checkLoss runs last so a fatal touch doesn't leave one extra reveal/trail
  // tick recorded past the moment of contact.
  status = checkLoss({
    status,
    player: { pos: { x: player.x, y: player.y }, radius: PLAYER_COLLISION_RADIUS },
    enemies: enemies.map((enemy) => ({ pos: enemy.pos, radius: ENEMY_COLLISION_RADIUS })),
  });
}

function render(now: number): void {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const camera = updateCamera({ x: player.x, y: player.y }, viewport, world);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawMap(ctx, map, now, camera.x, camera.y, viewport.width, viewport.height);
  drawShip(ctx, layout.shipPos, { beacon: false, now });
  drawPickups(ctx, pickups, now);
  drawTrail(ctx, trail);
  drawEnemies(ctx, enemies, now, playerInCave);
  drawPirate(ctx, visual);
  ctx.restore();

  drawScoreHud(ctx, score);
  drawJoystick(ctx, input.joystick);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

requestAnimationFrame(frame);
