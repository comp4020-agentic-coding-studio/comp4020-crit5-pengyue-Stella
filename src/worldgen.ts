import type { GameMap } from "./map.ts";
import { createMap } from "./map.ts";
import type { Obstacle } from "./obstacles.ts";
import { createObstacles, isReachableWorld } from "./obstacles.ts";
import { mulberry32 } from "./rng.ts";
import type { WorldLayout } from "./world.ts";
import { buildWorldLayout, WORLD_CELL_SIZE, WORLD_COLS, WORLD_ROWS } from "./world.ts";

export interface GeneratedWorld {
  layout: WorldLayout;
  obstacles: Obstacle[];
  map: GameMap;
}

const MAX_ATTEMPTS = 12;

// Every generated run must stay completable, so a bad roll (an obstacle
// cluster's random anchor happening to wall off a fragment, the X, or the
// cursed treasure) is retried with a freshly derived seed rather than shipped
// --- the retry re-rolls layout and obstacles together, since either one can
// be the cause. The pathological fallback (every attempt fails) ships with no
// obstacles at all rather than risk an uncompletable run.
export function generateWorld(seed: number): GeneratedWorld {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(seed + attempt * 104729);
    const layout = buildWorldLayout(rng);
    const obstacles = createObstacles(layout, rng);
    if (!isReachableWorld(layout, obstacles)) continue;
    const map = createMap(WORLD_COLS, WORLD_ROWS, WORLD_CELL_SIZE, layout, rng);
    return { layout, obstacles, map };
  }

  const rng = mulberry32(seed);
  const layout = buildWorldLayout(rng);
  const map = createMap(WORLD_COLS, WORLD_ROWS, WORLD_CELL_SIZE, layout, rng);
  return { layout, obstacles: [], map };
}
