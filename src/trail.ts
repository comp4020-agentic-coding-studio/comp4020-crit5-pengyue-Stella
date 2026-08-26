export interface TrailPoint {
  x: number;
  y: number;
  /** stable perpendicular offset (px), fixed at record time so the ink doesn't shimmer */
  jitter: number;
  /** stable stroke-width multiplier, fixed at record time for the same reason */
  widthJitter: number;
}

export interface Trail {
  points: TrailPoint[];
}

const MIN_SPACING_PX = 10;

export function createTrail(startX: number, startY: number): Trail {
  return { points: [makePoint(startX, startY)] };
}

function makePoint(x: number, y: number): TrailPoint {
  return {
    x,
    y,
    jitter: (Math.random() - 0.5) * 3,
    widthJitter: 0.75 + Math.random() * 0.5,
  };
}

// Only records a new point once the player has moved far enough --- close
// spacing is what would make the line look jagged rather than hand-drawn.
export function maybeRecordPoint(trail: Trail, x: number, y: number): void {
  const last = trail.points[trail.points.length - 1];
  if (!last) {
    trail.points.push(makePoint(x, y));
    return;
  }
  const dx = x - last.x;
  const dy = y - last.y;
  if (dx * dx + dy * dy >= MIN_SPACING_PX * MIN_SPACING_PX) {
    trail.points.push(makePoint(x, y));
  }
}
