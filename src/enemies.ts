import type { Vec2 } from "./types.ts";
import type { WorldLayout } from "./world.ts";

// One shared FSM across all three enemy kinds --- a crab's "buried" rest and
// a ghost's ambient drift both map onto "patrol".
export type FsmState = "patrol" | "alert" | "chase" | "return";

interface EnemyBase {
  id: string;
  pos: Vec2;
  state: FsmState;
  stateTimer: number;
  homePos: Vec2;
  facing: 1 | -1;
}

// A discriminated union rather than one flat interface with optional
// per-kind fields --- tsconfig's strict mode would otherwise force every read
// site to fall back on a value that's actually always present for that kind.
export interface SkeletonEnemy extends EnemyBase {
  kind: "skeleton";
  leash: number;
  detectionRadius: number;
  wanderTarget: Vec2;
}

export interface CrabEnemy extends EnemyBase {
  kind: "crab";
  ambushRadius: number;
  burstTimer: number;
}

export interface GhostEnemy extends EnemyBase {
  kind: "ghost";
  driftTarget: Vec2;
}

export type Enemy = SkeletonEnemy | CrabEnemy | GhostEnemy;

export interface EnemyUpdateContext {
  playerPos: Vec2;
  playerSightRadius: number;
  playerInCave: boolean;
  escapeBoost: boolean;
  dt: number;
}

const SKELETON_LEASH = 220;
const SKELETON_DETECTION_RADIUS = 150;
const SKELETON_PATROL_SPEED = 55;
const SKELETON_CHASE_SPEED = 230;
const SKELETON_ALERT_DURATION = 0.3;
const SKELETON_RETURN_ARRIVE_DIST = 12;
const SKELETON_WANDER_ARRIVE_DIST = 8;
const SKELETON_WANDER_PAUSE = 1.2;

const CRAB_AMBUSH_RADIUS = 70;
export const CRAB_TELEGRAPH_DURATION = 0.4;
const CRAB_BURST_SPEED = 320;
const CRAB_BURST_DURATION = 1.4;
const CRAB_RETURN_SPEED = 90;
const CRAB_RETURN_ARRIVE_DIST = 10;

const GHOST_AMBIENT_SPEED = 45;
const GHOST_CHASE_SPEED = 95;
const GHOST_DRIFT_RANGE = 70;
const GHOST_DRIFT_ARRIVE_DIST = 8;
const GHOST_LOSE_INTEREST_MULT = 1.3;

const ESCAPE_LEASH_MULT = 1.6;
const ESCAPE_DETECTION_MULT = 1.4;
const ESCAPE_SPEED_MULT = 1.15;

let nextId = 0;
function makeId(kind: string): string {
  nextId += 1;
  return `${kind}-${nextId}`;
}

export function createEnemies(layout: WorldLayout): Enemy[] {
  const enemies: Enemy[] = [];

  for (const home of layout.skeletonHomes) {
    enemies.push({
      id: makeId("skeleton"),
      kind: "skeleton",
      pos: { ...home },
      homePos: { ...home },
      state: "patrol",
      stateTimer: 0,
      facing: 1,
      leash: SKELETON_LEASH,
      detectionRadius: SKELETON_DETECTION_RADIUS,
      wanderTarget: { ...home },
    });
  }

  for (const spot of layout.crabAmbushPoints) {
    enemies.push({
      id: makeId("crab"),
      kind: "crab",
      pos: { ...spot },
      homePos: { ...spot },
      state: "patrol",
      stateTimer: 0,
      facing: 1,
      ambushRadius: CRAB_AMBUSH_RADIUS,
      burstTimer: 0,
    });
  }

  for (const spot of layout.ghostSpawnPoints) {
    enemies.push({
      id: makeId("ghost"),
      kind: "ghost",
      pos: { ...spot },
      homePos: { ...spot },
      state: "patrol",
      stateTimer: 0,
      facing: 1,
      driftTarget: { ...spot },
    });
  }

  return enemies;
}

export function updateEnemies(enemies: Enemy[], ctx: EnemyUpdateContext): void {
  for (const enemy of enemies) {
    switch (enemy.kind) {
      case "skeleton":
        updateSkeleton(enemy, ctx);
        break;
      case "crab":
        updateSandCrab(enemy, ctx);
        break;
      case "ghost":
        updateGhostPirate(enemy, ctx);
        break;
      default:
        assertNever(enemy);
    }
  }
}

// Forces every enemy within `radius` of `origin` straight into chase,
// regardless of distance to the player --- the cursed-treasure trap.
export function triggerAlertPulse(enemies: Enemy[], origin: Vec2, radius: number): void {
  for (const enemy of enemies) {
    if (distance(enemy.pos, origin) > radius) continue;
    enemy.state = "chase";
    enemy.stateTimer = 0;
  }
}

function updateSkeleton(enemy: SkeletonEnemy, ctx: EnemyUpdateContext): void {
  enemy.stateTimer += ctx.dt;
  const detectionRadius = ctx.escapeBoost ? enemy.detectionRadius * ESCAPE_DETECTION_MULT : enemy.detectionRadius;
  const leash = ctx.escapeBoost ? enemy.leash * ESCAPE_LEASH_MULT : enemy.leash;
  const chaseSpeed = ctx.escapeBoost ? SKELETON_CHASE_SPEED * ESCAPE_SPEED_MULT : SKELETON_CHASE_SPEED;

  switch (enemy.state) {
    case "patrol": {
      if (distance(enemy.pos, ctx.playerPos) <= detectionRadius) {
        enemy.state = "alert";
        enemy.stateTimer = 0;
        break;
      }
      if (distance(enemy.pos, enemy.wanderTarget) <= SKELETON_WANDER_ARRIVE_DIST) {
        if (enemy.stateTimer >= SKELETON_WANDER_PAUSE) {
          enemy.wanderTarget = randomPointWithin(enemy.homePos, enemy.leash);
          enemy.stateTimer = 0;
        }
      } else {
        moveToward(enemy, enemy.wanderTarget, SKELETON_PATROL_SPEED, ctx.dt);
      }
      break;
    }
    case "alert": {
      // A brief transitional commit --- no re-checking the player's distance,
      // it always resolves to chase once the timer runs out.
      faceToward(enemy, ctx.playerPos);
      if (enemy.stateTimer >= SKELETON_ALERT_DURATION) {
        enemy.state = "chase";
        enemy.stateTimer = 0;
      }
      break;
    }
    case "chase": {
      const distToPlayer = distance(enemy.pos, ctx.playerPos);
      const distFromHome = distance(enemy.pos, enemy.homePos);
      if (distToPlayer > detectionRadius || distFromHome > leash + detectionRadius) {
        enemy.state = "return";
        enemy.stateTimer = 0;
        break;
      }
      moveToward(enemy, ctx.playerPos, chaseSpeed, ctx.dt);
      break;
    }
    case "return": {
      if (distance(enemy.pos, enemy.homePos) <= SKELETON_RETURN_ARRIVE_DIST) {
        enemy.state = "patrol";
        enemy.stateTimer = 0;
        enemy.wanderTarget = { ...enemy.homePos };
        break;
      }
      moveToward(enemy, enemy.homePos, SKELETON_PATROL_SPEED, ctx.dt);
      break;
    }
  }
}

function updateSandCrab(enemy: CrabEnemy, ctx: EnemyUpdateContext): void {
  enemy.stateTimer += ctx.dt;

  switch (enemy.state) {
    case "patrol": {
      if (distance(enemy.pos, ctx.playerPos) <= enemy.ambushRadius) {
        enemy.state = "alert";
        enemy.stateTimer = 0;
        enemy.burstTimer = 0;
      }
      break;
    }
    case "alert": {
      // Telegraph window --- burstTimer is the render layer's own clock for
      // the sand-ripple, kept separate from stateTimer on principle even
      // though they run in lockstep here.
      faceToward(enemy, ctx.playerPos);
      enemy.burstTimer += ctx.dt;
      if (enemy.stateTimer >= CRAB_TELEGRAPH_DURATION) {
        enemy.state = "chase";
        enemy.stateTimer = 0;
      }
      break;
    }
    case "chase": {
      moveToward(enemy, ctx.playerPos, CRAB_BURST_SPEED, ctx.dt);
      // escapeBoost: stay surfaced and chasing instead of capping the burst.
      if (!ctx.escapeBoost && enemy.stateTimer >= CRAB_BURST_DURATION) {
        enemy.state = "return";
        enemy.stateTimer = 0;
      }
      break;
    }
    case "return": {
      if (ctx.escapeBoost) {
        enemy.state = "chase";
        enemy.stateTimer = 0;
        break;
      }
      if (distance(enemy.pos, enemy.homePos) <= CRAB_RETURN_ARRIVE_DIST) {
        // Re-buries regardless of whether the burst caught the player.
        enemy.state = "patrol";
        enemy.stateTimer = 0;
        break;
      }
      moveToward(enemy, enemy.homePos, CRAB_RETURN_SPEED, ctx.dt);
      break;
    }
  }
}

function updateGhostPirate(enemy: GhostEnemy, ctx: EnemyUpdateContext): void {
  // Ghosts don't exist outside the cave --- no update, and render skips them
  // too, per the "invisible in daylight zones" design.
  if (!ctx.playerInCave) return;

  enemy.stateTimer += ctx.dt;
  const detectionRadius = ctx.escapeBoost
    ? ctx.playerSightRadius * ESCAPE_DETECTION_MULT
    : ctx.playerSightRadius;
  const chaseSpeed = ctx.escapeBoost ? GHOST_CHASE_SPEED * ESCAPE_SPEED_MULT : GHOST_CHASE_SPEED;
  const distToPlayer = distance(enemy.pos, ctx.playerPos);

  if (distToPlayer <= detectionRadius) {
    enemy.state = "chase";
  } else if (enemy.state === "chase" && distToPlayer > detectionRadius * GHOST_LOSE_INTEREST_MULT) {
    enemy.state = "patrol";
  }

  if (enemy.state === "chase") {
    moveToward(enemy, ctx.playerPos, chaseSpeed, ctx.dt);
    return;
  }

  if (distance(enemy.pos, enemy.driftTarget) <= GHOST_DRIFT_ARRIVE_DIST) {
    enemy.driftTarget = randomPointWithin(enemy.homePos, GHOST_DRIFT_RANGE);
  }
  moveToward(enemy, enemy.driftTarget, GHOST_AMBIENT_SPEED, ctx.dt);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveToward(enemy: EnemyBase, target: Vec2, speed: number, dt: number): void {
  const dx = target.x - enemy.pos.x;
  const dy = target.y - enemy.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return;
  const step = Math.min(dist, speed * dt);
  enemy.pos.x += (dx / dist) * step;
  enemy.pos.y += (dy / dist) * step;
  if (dx !== 0) enemy.facing = dx > 0 ? 1 : -1;
}

function faceToward(enemy: EnemyBase, target: Vec2): void {
  const dx = target.x - enemy.pos.x;
  if (dx !== 0) enemy.facing = dx > 0 ? 1 : -1;
}

function randomPointWithin(center: Vec2, radius: number): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled enemy kind: ${JSON.stringify(value)}`);
}
