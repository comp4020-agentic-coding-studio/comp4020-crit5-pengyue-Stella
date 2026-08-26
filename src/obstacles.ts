import type { Vec2 } from "./types.ts";
import type { WorldLayout, Zone } from "./world.ts";
import { WORLD_HEIGHT, WORLD_WIDTH, zoneAt } from "./world.ts";

// The five kinds the brief names explicitly: trees, rocks, ruins, water and
// wreckage. Every kind blocks movement identically (resolveObstacleCollision
// below doesn't distinguish between them) --- the difference is purely what
// the world looks and feels like to walk past.
export type ObstacleKind = "tree" | "rock" | "ruinPillar" | "water" | "wreckage";

export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  pos: Vec2;
  radius: number;
  /** stable per-obstacle random value, used to vary render shape/rotation */
  seed: number;
}

// No obstacle may spawn this close to any fixed point of interest, or the
// world's own pickups/enemy-homes/ship could end up unreachable or buried.
const CLEARANCE_RADIUS = 78;
// The spawn point gets extra breathing room in every direction.
const SHIP_CLEARANCE_RADIUS = 170;
const WORLD_MARGIN = 40;

interface KindWeight {
  kind: ObstacleKind;
  weight: number;
  radius: [number, number];
}

interface ZoneClusterSpec {
  zone: Zone;
  clusters: number;
  perCluster: [number, number];
  clusterRadius: number;
  kinds: KindWeight[];
}

// Obstacles are placed as clusters (a grove, a rockfall, a wreck site) rather
// than spread evenly --- clumps read as places, and leave clear lanes between
// them for the reachability test below to actually find.
const ZONE_SPECS: ZoneClusterSpec[] = [
  {
    zone: "beach",
    clusters: 5,
    perCluster: [2, 4],
    clusterRadius: 100,
    kinds: [
      { kind: "wreckage", weight: 0.6, radius: [16, 26] },
      { kind: "rock", weight: 0.4, radius: [12, 20] },
    ],
  },
  {
    zone: "jungle",
    clusters: 9,
    perCluster: [3, 6],
    clusterRadius: 130,
    kinds: [
      { kind: "tree", weight: 0.75, radius: [16, 28] },
      { kind: "rock", weight: 0.25, radius: [12, 18] },
    ],
  },
  {
    zone: "ruins",
    clusters: 8,
    perCluster: [3, 5],
    clusterRadius: 120,
    kinds: [
      { kind: "ruinPillar", weight: 0.55, radius: [16, 24] },
      { kind: "rock", weight: 0.3, radius: [12, 20] },
      { kind: "water", weight: 0.15, radius: [30, 46] },
    ],
  },
  {
    zone: "cave",
    clusters: 4,
    perCluster: [2, 4],
    clusterRadius: 80,
    kinds: [
      { kind: "rock", weight: 0.8, radius: [14, 22] },
      { kind: "water", weight: 0.2, radius: [26, 38] },
    ],
  },
];

// mulberry32 --- placement has to be stable across reloads (and the
// reachability test below only means something if it is), not literally
// random each run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collectProtectedPoints(layout: WorldLayout): Vec2[] {
  return [
    layout.xPos,
    layout.cursedTreasurePos,
    layout.torchPos,
    layout.speedBoostPos,
    ...layout.fragmentPositions,
    ...layout.coinPositions,
    ...layout.gemPositions,
    ...layout.skeletonHomes,
    ...layout.crabAmbushPoints,
    ...layout.ghostSpawnPoints,
  ];
}

function sampleZonePoint(zone: Zone, layout: WorldLayout, rng: () => number): Vec2 | null {
  for (let attempt = 0; attempt < 24; attempt++) {
    let x: number;
    let y: number;
    if (zone === "cave") {
      x = layout.caveRect.x + rng() * layout.caveRect.width;
      y = layout.caveRect.y + rng() * layout.caveRect.height;
    } else if (zone === "beach") {
      x = rng() * WORLD_WIDTH;
      y = layout.beachStartY + rng() * (WORLD_HEIGHT - layout.beachStartY);
    } else if (zone === "jungle") {
      x = rng() * WORLD_WIDTH;
      y = layout.jungleStartY + rng() * (layout.beachStartY - layout.jungleStartY);
    } else {
      x = rng() * WORLD_WIDTH;
      y = rng() * layout.jungleStartY;
    }
    if (zoneAt(layout, x, y) === zone) return { x, y };
  }
  return null;
}

function pickKind(spec: ZoneClusterSpec, rng: () => number): KindWeight {
  const total = spec.kinds.reduce((sum, k) => sum + k.weight, 0);
  let roll = rng() * total;
  for (const k of spec.kinds) {
    if (roll < k.weight) return k;
    roll -= k.weight;
  }
  return spec.kinds[spec.kinds.length - 1];
}

function isClear(pos: Vec2, protectedPoints: Vec2[], shipPos: Vec2): boolean {
  const dxShip = pos.x - shipPos.x;
  const dyShip = pos.y - shipPos.y;
  if (dxShip * dxShip + dyShip * dyShip < SHIP_CLEARANCE_RADIUS * SHIP_CLEARANCE_RADIUS) return false;
  for (const p of protectedPoints) {
    const dx = pos.x - p.x;
    const dy = pos.y - p.y;
    if (dx * dx + dy * dy < CLEARANCE_RADIUS * CLEARANCE_RADIUS) return false;
  }
  return true;
}

// Fixed seed: obstacle placement is part of the world layout, not something
// that should reshuffle underfoot between reloads or resets.
const DEFAULT_SEED = 20260826;

export function createObstacles(layout: WorldLayout, seed: number = DEFAULT_SEED): Obstacle[] {
  const rng = mulberry32(seed);
  const protectedPoints = collectProtectedPoints(layout);
  const obstacles: Obstacle[] = [];
  let nextId = 0;

  for (const spec of ZONE_SPECS) {
    for (let c = 0; c < spec.clusters; c++) {
      const center = sampleZonePoint(spec.zone, layout, rng);
      if (!center) continue;
      const perCluster = spec.perCluster[0] + Math.floor(rng() * (spec.perCluster[1] - spec.perCluster[0] + 1));
      for (let i = 0; i < perCluster; i++) {
        const angle = rng() * Math.PI * 2;
        // sqrt bias: obstacles thin out toward the cluster's edge instead of
        // an even disc, which is what a naturally-grown clump looks like.
        const dist = Math.sqrt(rng()) * spec.clusterRadius;
        const pos = { x: center.x + Math.cos(angle) * dist, y: center.y + Math.sin(angle) * dist };
        if (pos.x < WORLD_MARGIN || pos.x > WORLD_WIDTH - WORLD_MARGIN) continue;
        if (pos.y < WORLD_MARGIN || pos.y > WORLD_HEIGHT - WORLD_MARGIN) continue;
        if (!isClear(pos, protectedPoints, layout.shipPos)) continue;
        const picked = pickKind(spec, rng);
        const radius = picked.radius[0] + rng() * (picked.radius[1] - picked.radius[0]);
        obstacles.push({ id: `obstacle-${nextId++}`, kind: picked.kind, pos, radius, seed: rng() });
      }
    }
  }

  return obstacles;
}

// Pushes a circle (player or enemy) back out of any obstacle it's overlapping
// --- called every frame, so a single pass per obstacle is enough; residual
// overlap between simultaneously-touched obstacles resolves within a frame
// or two rather than needing an iterative solver.
export function resolveObstacleCollision(pos: Vec2, radius: number, obstacles: Obstacle[]): Vec2 {
  let x = pos.x;
  let y = pos.y;
  for (const obstacle of obstacles) {
    const dx = x - obstacle.pos.x;
    const dy = y - obstacle.pos.y;
    const minDist = radius + obstacle.radius;
    const dist = Math.hypot(dx, dy);
    if (dist >= minDist) continue;
    if (dist < 0.0001) {
      x += minDist;
      continue;
    }
    const push = (minDist - dist) / dist;
    x += dx * push;
    y += dy * push;
  }
  return { x, y };
}

export function isBlocked(pos: Vec2, radius: number, obstacles: Obstacle[]): boolean {
  for (const obstacle of obstacles) {
    const dx = pos.x - obstacle.pos.x;
    const dy = pos.y - obstacle.pos.y;
    const minDist = radius + obstacle.radius;
    if (dx * dx + dy * dy < minDist * minDist) return true;
  }
  return false;
}
