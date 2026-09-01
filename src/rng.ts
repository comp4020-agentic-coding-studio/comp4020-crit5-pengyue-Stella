// mulberry32 --- one small deterministic PRNG shared by every procedural piece
// of the world (layout, obstacles, terrain noise). Threading the same rng
// instance through all three from a single seed is what makes a whole run
// reproducible and lets worldgen.ts retry a bad roll with a derived seed.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
