import { InputController } from "./src/input.ts";
import { offscreenArrow, updateCamera } from "./src/camera.ts";
import { advanceReveal, revealAround, worldSize } from "./src/map.ts";
import { createTrail, maybeRecordPoint } from "./src/trail.ts";
import { zoneAt } from "./src/world.ts";
import { generateWorld } from "./src/worldgen.ts";
import { ALERT_PULSE_RADIUS, collectNearby, createPickups } from "./src/pickups.ts";
import { collectFragments, createFragments } from "./src/fragments.ts";
import {
  applySwordHit,
  createEnemies,
  isEnemyVulnerable,
  pruneDeadEnemies,
  triggerAlertPulse,
  updateEnemies,
} from "./src/enemies.ts";
import { checkLoss, collectFragment, computeSightRadius, reachShip, reachX } from "./src/game-logic.ts";
import { ATTACK_KNOCKBACK_SPEED, createCombatState, isWithinAttackArc, tryAttack } from "./src/combat.ts";
import { drawSwordSwing } from "./src/render/combat.ts";
import { drawAttackButton } from "./src/render/attackButton.ts";
import type { ProgressStatus } from "./src/game-logic.ts";
import { resolveObstacleCollision } from "./src/obstacles.ts";
import { createTraps, trapHitCircles, updateTraps } from "./src/traps.ts";
import { drawMap, drawXArrow, drawXMarker } from "./src/render/map.ts";
import { drawObstacles } from "./src/render/obstacles.ts";
import { drawTraps } from "./src/render/traps.ts";
import { drawTrail } from "./src/render/trail.ts";
import { drawPirate, ALERT_BEAT_DURATION, PICKUP_PULSE_DURATION } from "./src/render/player.ts";
import type { PlayerVisualState } from "./src/render/player.ts";
import { drawJoystick } from "./src/render/joystick.ts";
import { drawShip, drawShipArrow } from "./src/render/ship.ts";
import { drawFragments, drawPickups } from "./src/render/pickups.ts";
import { drawEnemies } from "./src/render/enemies.ts";
import { drawEndScreen, drawFragmentHud, drawScoreHud, drawStoryBanner, STORY_BANNER_DURATION } from "./src/render/hud.ts";
import { CALLOUT_DURATION, drawCallout } from "./src/render/callout.ts";
import type { Vec2 } from "./src/types.ts";
import { drawChaseVignette, drawSightVignette } from "./src/render/vignette.ts";

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
const X_REACH_RADIUS = 30;
const SHIP_REACH_RADIUS = 60;

// Regenerated wholesale on every restart (see resetGame) --- a fresh run
// means a fresh world, not just fresh entities placed on the same one.
const initialWorld = generateWorld(Date.now());
let layout = initialWorld.layout;
let map = initialWorld.map;
let obstacles = initialWorld.obstacles;
let world = worldSize(map);

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
  carryingTreasure: false,
};

const trail = createTrail(player.x, player.y);
const input = new InputController(canvas);
let pickups = createPickups(layout);
let fragments = createFragments(layout);
let enemies = createEnemies(layout);
let traps = createTraps(layout);
const combat = createCombatState();
let score = 0;
let status: ProgressStatus = "explore";
let fragmentsCollected = 0;
let xRevealedAt = 0;
let previousAlertIds = new Set<string>();
let playerInCave = false;
let sightRadiusForRender = SIGHT_RADIUS;
let terminalEnteredAt = 0;
const CHASE_NOTICE_RADIUS = 260;

// Reaching the X is the single biggest score moment in the run --- sized
// above the previous top pickup (cursed hoard, 150) so it reads as the actual
// climax, not just another collectible.
const TREASURE_SCORE_BONUS = 300;
// A modest reward for a permanent kill --- everything else in the run gives
// score on contact, so a defeated enemy giving none would read as a dead end.
const ENEMY_DEFEAT_SCORE = 25;

// Brief screen-shake on a landed hit --- decays linearly, applied as a
// world-space jitter in render() only (HUD/vignettes stay put).
const SHAKE_DURATION = 0.15;
const SHAKE_MAGNITUDE = 5;
let shakeTimer = 0;

interface StoryBanner {
  text: string;
  timer: number;
}
let storyBanner: StoryBanner | null = null;

// First-encounter name-tags --- a brief label the first time each kind of
// danger is actually seen, never control/how-to-play text. Keyed by kind (or
// a single flag for the one-off hazards) so each fires exactly once per run.
interface ActiveCallout {
  pos: Vec2;
  text: string;
  timer: number;
}
const ENEMY_CALLOUT_LABEL: Record<string, string> = {
  skeleton: "Skeleton",
  crab: "Sand Crab",
  ghost: "Ghost Pirate",
};
let activeCallouts: ActiveCallout[] = [];
const introducedEnemyKinds = new Set<string>();
let trapIntroduced = false;
let cursedIntroduced = false;

const SPEED_BOOST_MULTIPLIER = 1.6;
// Ignores input for a beat after entering a terminal state --- a key held
// into the fatal collision keeps firing OS key-repeat keydown events, which
// would otherwise dismiss the lose screen before the player registers it.
const RESTART_ARM_DELAY = 500;

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
  if (status === "won" || status === "lost") {
    if (now - terminalEnteredAt < RESTART_ARM_DELAY) {
      input.clearActivation();
    } else if (input.consumeActivation()) {
      resetGame();
    }
    return;
  }

  const move = input.getMovement();
  const moving = move.x !== 0 || move.y !== 0;

  player.speedTimer = Math.max(0, player.speedTimer - dt);
  visual.pickupPulse = Math.max(0, visual.pickupPulse - dt);
  visual.alertBeat = Math.max(0, visual.alertBeat - dt);
  shakeTimer = Math.max(0, shakeTimer - dt);
  if (storyBanner) {
    storyBanner.timer -= dt;
    if (storyBanner.timer <= 0) storyBanner = null;
  }
  const speed = PLAYER_SPEED * (player.speedTimer > 0 ? SPEED_BOOST_MULTIPLIER : 1);

  if (moving) {
    player.x = clamp(player.x + move.x * speed * dt, 0, world.width);
    player.y = clamp(player.y + move.y * speed * dt, 0, world.height);
    if (move.x !== 0) player.facing = move.x > 0 ? 1 : -1;
  }

  const resolved = resolveObstacleCollision({ x: player.x, y: player.y }, PLAYER_COLLISION_RADIUS, obstacles);
  player.x = resolved.x;
  player.y = resolved.y;

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

  const zone = zoneAt(layout, player.x, player.y);
  playerInCave = zone === "cave";
  const sightRadius = computeSightRadius(SIGHT_RADIUS, player.torchBonus, zone);
  sightRadiusForRender = sightRadius;
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
  if (effect.alertPulse) {
    triggerAlertPulse(enemies, layout.cursedTreasurePos, ALERT_PULSE_RADIUS);
  }

  const newFragments = collectFragments(fragments, { x: player.x, y: player.y });
  for (let i = 0; i < newFragments; i++) {
    const result = collectFragment(status, fragmentsCollected);
    fragmentsCollected = result.fragmentsCollected;
    if (result.status !== status) {
      xRevealedAt = now;
      storyBanner = { text: "All fragments found --- the X is revealed!", timer: STORY_BANNER_DURATION };
    }
    status = result.status;
    visual.pickupPulse = PICKUP_PULSE_DURATION;
  }

  if (status === "xRevealed" && distanceTo(layout.xPos) <= X_REACH_RADIUS) {
    const next = reachX(status, fragmentsCollected);
    if (next !== status) {
      score += TREASURE_SCORE_BONUS;
      storyBanner = { text: "Treasure secured --- get back to the ship!", timer: STORY_BANNER_DURATION };
    }
    status = next;
  }
  if (status === "escaping" && distanceTo(layout.shipPos) <= SHIP_REACH_RADIUS) {
    const next = reachShip(status);
    if (next !== status) {
      terminalEnteredAt = now;
      input.clearActivation();
    }
    status = next;
  }

  updateEnemies(enemies, {
    playerPos: { x: player.x, y: player.y },
    playerSightRadius: sightRadius,
    playerInCave,
    escapeBoost: status === "escaping",
    obstacles,
    dt,
  });
  updateTraps(traps, { x: player.x, y: player.y }, dt);

  // A swing hits every live enemy inside the facing-cone at once --- a
  // one-shot check at the instant the swing starts, not sampled across the
  // whole visual sweep, so one tap can't double-hit the same target.
  const attackRequested = input.consumeAttack();
  const swung = tryAttack(combat, attackRequested, dt);
  if (swung) {
    for (const enemy of enemies) {
      if (enemy.state === "defeated" || enemy.state === "dead") continue;
      if (!isEnemyVulnerable(enemy, { playerInCave, hasTorch: player.torchBonus > 0 })) continue;
      if (!isWithinAttackArc({ x: player.x, y: player.y }, player.facing, enemy.pos)) continue;
      applySwordHit(enemy, { x: player.x, y: player.y }, ATTACK_KNOCKBACK_SPEED);
      shakeTimer = SHAKE_DURATION;
      if (enemy.hp <= 0) score += ENEMY_DEFEAT_SCORE;
    }
  }
  enemies = pruneDeadEnemies(enemies);

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

  for (const enemy of enemies) {
    if (enemy.kind === "ghost" && !playerInCave) continue;
    if (introducedEnemyKinds.has(enemy.kind)) continue;
    if (distanceTo(enemy.pos) > sightRadius) continue;
    introducedEnemyKinds.add(enemy.kind);
    activeCallouts.push({ pos: enemy.pos, text: ENEMY_CALLOUT_LABEL[enemy.kind], timer: CALLOUT_DURATION });
  }
  if (!trapIntroduced) {
    const anticipating = traps.find((t) => t.state === "anticipating");
    if (anticipating) {
      trapIntroduced = true;
      activeCallouts.push({ pos: anticipating.pos, text: "Trap!", timer: CALLOUT_DURATION });
    }
  }
  if (!cursedIntroduced) {
    const cursedPickup = pickups.find((p) => p.kind === "cursed" && !p.collected);
    if (cursedPickup && distanceTo(cursedPickup.pos) <= sightRadius) {
      cursedIntroduced = true;
      activeCallouts.push({ pos: cursedPickup.pos, text: "Cursed Hoard", timer: CALLOUT_DURATION });
    }
  }
  for (const callout of activeCallouts) callout.timer -= dt;
  activeCallouts = activeCallouts.filter((c) => c.timer > 0);

  // checkLoss runs last so a fatal touch doesn't leave one extra reveal/trail
  // tick recorded past the moment of contact. A triggered trap is a hazard
  // circle exactly like an enemy --- folded into the same list rather than
  // given its own loss rule.
  const afterLoss = checkLoss({
    status,
    player: { pos: { x: player.x, y: player.y }, radius: PLAYER_COLLISION_RADIUS },
    enemies: [
      ...enemies
        .filter((enemy) => enemy.state !== "defeated" && enemy.state !== "dead")
        .map((enemy) => ({ pos: enemy.pos, radius: ENEMY_COLLISION_RADIUS })),
      ...trapHitCircles(traps),
    ],
  });
  if (afterLoss !== status) {
    terminalEnteredAt = now;
    input.clearActivation();
  }
  status = afterLoss;
  visual.carryingTreasure = status === "escaping";
}

// A restart is a completely fresh run, not just fresh entities on the same
// map: the whole world (layout, obstacles, terrain/fog-of-war) is regenerated
// first, so explored/revealed state, obstacle placement, and every point of
// interest are all different from the run that just ended. Pickups, fragments
// and enemies are then recreated from the *new* layout; player/visual/trail
// are mutated in place since nothing external holds a reference to a
// *different* object for them.
function resetGame(): void {
  const fresh = generateWorld(Date.now());
  layout = fresh.layout;
  map = fresh.map;
  obstacles = fresh.obstacles;
  world = worldSize(map);

  player.x = layout.shipPos.x;
  player.y = layout.shipPos.y;
  player.facing = 1;
  player.torchBonus = 0;
  player.speedTimer = 0;

  revealAround(map, player.x, player.y, SIGHT_RADIUS, performance.now());

  visual.pos.x = player.x;
  visual.pos.y = player.y;
  visual.facing = 1;
  visual.moving = false;
  visual.animTime = 0;
  visual.hatLag.x = 0;
  visual.hatLag.y = 0;
  visual.pickupPulse = 0;
  visual.alertBeat = 0;
  visual.chased = false;
  visual.carryingTreasure = false;

  trail.points = createTrail(player.x, player.y).points;

  pickups = createPickups(layout);
  fragments = createFragments(layout);
  enemies = createEnemies(layout);
  traps = createTraps(layout);
  combat.cooldown = 0;
  combat.swingTimer = 0;

  score = 0;
  status = "explore";
  fragmentsCollected = 0;
  xRevealedAt = 0;
  previousAlertIds = new Set<string>();
  playerInCave = false;
  sightRadiusForRender = SIGHT_RADIUS;
  terminalEnteredAt = 0;
  shakeTimer = 0;

  activeCallouts = [];
  introducedEnemyKinds.clear();
  trapIntroduced = false;
  cursedIntroduced = false;
  storyBanner = null;
}

function render(now: number): void {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const camera = updateCamera({ x: player.x, y: player.y }, viewport, world);
  const escaping = status === "escaping";

  const shakeAmount = shakeTimer > 0 ? (shakeTimer / SHAKE_DURATION) * SHAKE_MAGNITUDE : 0;
  const shakeX = shakeAmount ? (Math.random() * 2 - 1) * shakeAmount : 0;
  const shakeY = shakeAmount ? (Math.random() * 2 - 1) * shakeAmount : 0;

  ctx.save();
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);
  drawMap(ctx, map, now, camera.x, camera.y, viewport.width, viewport.height);
  drawObstacles(ctx, obstacles, map, now);
  drawTraps(ctx, traps, map, now);
  drawShip(ctx, layout.shipPos, { beacon: escaping, now });
  drawFragments(ctx, fragments, now);
  drawPickups(ctx, pickups, now);
  if (status !== "explore") drawXMarker(ctx, layout.xPos, now, xRevealedAt);
  drawTrail(ctx, trail, { lifeline: escaping, now });
  drawEnemies(ctx, enemies, now, playerInCave);
  drawPirate(ctx, visual);
  drawSwordSwing(ctx, { x: player.x, y: player.y }, player.facing, combat.swingTimer);
  for (const callout of activeCallouts) drawCallout(ctx, callout.pos, callout.text, callout.timer);
  ctx.restore();

  drawSightVignette(
    ctx,
    viewport.width,
    viewport.height,
    player.x - camera.x,
    player.y - camera.y,
    sightRadiusForRender,
  );
  if (visual.chased && status !== "won" && status !== "lost") {
    drawChaseVignette(ctx, viewport.width, viewport.height, now);
  }
  if (status === "xRevealed") {
    const arrow = offscreenArrow({ x: player.x, y: player.y }, layout.xPos, camera, viewport);
    if (arrow) drawXArrow(ctx, arrow);
  }
  if (escaping) {
    const arrow = offscreenArrow({ x: player.x, y: player.y }, layout.shipPos, camera, viewport);
    if (arrow) drawShipArrow(ctx, arrow);
  }
  drawScoreHud(ctx, score);
  drawFragmentHud(ctx, fragmentsCollected, fragments.length);
  if (storyBanner) drawStoryBanner(ctx, viewport, storyBanner.text, storyBanner.timer);
  drawJoystick(ctx, input.joystick);
  if (status !== "won" && status !== "lost") {
    drawAttackButton(ctx, viewport.width, viewport.height, combat.cooldown);
  }
  if (status === "won" || status === "lost") {
    drawEndScreen(ctx, viewport, status === "won", score);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function distanceTo(target: { x: number; y: number }): number {
  return Math.hypot(player.x - target.x, player.y - target.y);
}

requestAnimationFrame(frame);
