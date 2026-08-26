# PLAN — "X Marks the Spot"

A top-down chibi-pirate exploration game on a hand-drawn treasure map. The
player uncovers the map by walking it, leaves a red ink trail behind them,
and has to balance greed (cursed treasure, detours for gems) against risk
(enemies that notice, chase, and end the run on contact).

This plan answers the crit-5 spec
(https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/):
deployed and losable, self-teaching with zero instructions, a five-minute
stranger-proof loop, one rule under a focused automated test, and a change
that playing (not reading code) produced. Nothing here is built yet — this
is the design to build against.

## Core loop

Explore → find 3 map fragments → all 3 reveal a red X → reach the X → grab
the final treasure → escape phase → return to the ship → **win**. Any enemy
contact at any point → **lose**. This isn't a single mechanic wearing
different costumes — it's four systems that lean on each other:
**cartography** (the map draws itself in as you explore it), **risk
management** (enemies with readable territories and a genuine greed trap in
cursed treasure), **collection** (fragments gate progress, coins/gems
reward wandering, torch/speed reshape how you move), and a **climax
escape** that inverts the board once you're committed. Losing any one of
them would flatten this into something thinner than the adventure it's
meant to be.

## Game systems

- **Map drawing, not a fog mask.** The map is a grid (see below) starting as
  blank parchment. When the player comes within a reveal radius of a cell,
  it doesn't just snap visible — it **draws itself in**: a quick pen-stroke
  sketch of the terrain outline animates first (coastline, tree clumps,
  ruin edges), then a sepia/biome colour wash fills in a beat later, like
  an illustrator sketching then inking a real map in front of the player.
  It should read as *cartography happening live*, not a fog layer
  clearing — this is the primary feedback loop that rewards exploring
  rather than beelining, and it's the single visual idea the whole game's
  identity leans on.
- **Red trail.** Every N pixels of movement, record the player's position.
  Render the recorded points as a hand-drawn, slightly-wobbly red stroke
  (a wobble jitter, not a straight line, is what makes it read as "hand
  drawn" rather than "debug line"). The trail never fades — it's the
  player's own map-of-the-map, and it is what makes dark zones survivable
  (see Visibility below). It's this system, more than any other, that ties
  exploring and finding your way back into one continuous thread — and it's
  what turns, at the climax, from a quiet memory-aid into the escape's
  lifeline (see Progression).
- **Visibility.** The player has a sight radius that shrinks in dark zones
  (cave/fog) and expands with the torch pickup. Fog-of-war reveal always
  uses the *current* sight radius, so dark zones reveal less per step and
  feel more dangerous. The red trail is always fully visible regardless of
  sight radius — it's drawn in absolute world space, not masked by fog —
  which is what lets a player retrace their steps blind.
- **Detection.** Every enemy has a `detectionRadius` (line-of-sight, not
  blocked by geometry for v1 — simplicity over realism) and a per-type
  state machine (see Enemy behaviour). Distance check runs every frame
  against the player's world position.
- **Pickups.** World objects the player walks over; effects apply
  immediately, no inventory screen:
  - **Coin / gem** — score only, no gameplay effect. These exist to reward
    wandering off the critical path.
  - **Torch** — expands sight radius for the rest of the run (permanent
    pickup, not a timer — a temporary buff would need a HUD countdown to be
    legible, and the brief rules out on-screen instruction of any kind).
  - **Speed boost** — temporary movement-speed multiplier, timed (a
    short, self-evident burst — the player *feels* it immediately, no
    countdown needed to understand it wore off).
  - **Cursed treasure** — a large score bonus that also triggers an
    **alert pulse**: every enemy within an alert radius of the pickup
    (larger than any enemy's normal detection radius) is forced into
    `chase` immediately, regardless of distance to the player. High
    reward, real cost — this is the game's one deliberate "greed" trap.
- **Progression state.** A single explicit state machine drives the run:
  `explore → xRevealed → escaping → won`, with `lost` reachable from any
  state on enemy contact. `fragmentsCollected` (0–3) gates the
  `explore → xRevealed` transition; reaching the X gates `xRevealed →
  escaping`; reaching the ship while `escaping` gates `escaping → won`.

## Map structure

One continuous world, not separate levels — small enough to finish in five
minutes, big enough that "explore" means something. Rough layout, south to
north:

1. **Ship / beach (spawn).** The starting and returning point. Wide open,
   fully sand-coloured, no enemies — this is the safe zone where the
   opening screen has to teach everything by just *existing* (see
   Discoverability). One fragment is hidden in plain sight nearby, so the
   very first thing the player does is succeed at something.
2. **Jungle.** Denser, sight-blocking foliage tiles (visual only, not a
   vision penalty — that's reserved for cave/fog so it stays a distinct
   threat). Skeleton-pirate territory lives here. Second fragment and most
   of the coin/gem density.
3. **Ruins.** Broken structures, tighter corridors that make territorial
   chasers more threatening (fewer escape routes). Sand crabs ambush along
   the narrow paths. Torch and speed-boost pickups favour this zone, since
   its layout is the hardest to read.
4. **Cave / fog pocket.** A contained dark zone nested off the ruins (not a
   whole map quadrant — it should read as a deliberate detour, not
   unavoidable). Sight radius drops hard here; ghost pirates only exist in
   this zone. Third fragment and the cursed treasure both live here, so the
   game's biggest risk and biggest reward share the same room.
5. **The X**, once all 3 fragments are collected, appears somewhere central
   — reachable from any zone, so the final leg is a deliberate choice of
   route back through whatever the player has already revealed, not a fixed
   corridor.

Grid size is **not locked yet** — cell size (32px is a reasonable starting
point) and grid dimensions get tuned once movement speed and pacing are on
screen and playtestable. Too small trivialises the five areas described
above; too big threatens the five-minute stranger-proof loop the spec
demands. Whatever the final dimensions, one principle holds regardless: the
camera follows the player and clamps to world bounds, and the canvas scales
its visible cell-count to the viewport so the same *amount of world* is
visible at both 1920×1080 and 390×844 — the phone sees a smaller window,
not a zoomed one, so detection ranges and trail readability stay consistent
between the two marked viewports.

## Enemy behaviour

Shared FSM, four states: `rest/patrol → alert → chase → return`. `alert` is
a brief (≈0.3s) transitional state — a visual tell (see Visual direction)
before the enemy actually starts chasing, so contact is never sub-frame
unfair. Per-type parameters:

| Type | Detection | Movement pattern | Chase trigger | Notes |
|---|---|---|---|---|
| **Skeleton pirate** | Medium radius | Patrols a fixed territory (a leash radius around a home point) | Player within detection radius **and** inside territory + small buffer | Gives up and `return`s if the player leaves detection radius *or* the territory buffer, whichever first. The predictable, learnable enemy. |
| **Sand crab** | Small radius, but omnidirectional and sudden | Rests buried/still until triggered | Player within a short ambush radius | Bursts to a short high-speed chase, then re-buries at its ambush point regardless of outcome. The "don't hug corners" enemy. |
| **Ghost pirate** | Tied to the *player's* sight radius, not a fixed number | Drifts slowly toward the player's last-seen position | Active only while the player is inside a dark/fog zone | Invisible in daylight zones (does not spawn/render there at all). Because detection scales with the player's shrunken sight radius, a torch pickup taken *before* the cave measurably lowers the risk — the payoff of exploring earlier zones thoroughly. |

### Reading territory without a UI

No detection-radius circles are ever drawn — the world itself signals where
each enemy operates, so a careful player learns to read danger spatially
instead of being told:

- **Skeleton pirate**: its territory is centred on a visible landmark — a
  half-buried rowboat, a ring of stuck cutlasses, a skull-topped stake —
  and scattered bones thin out toward the territory's edge, so bone
  density is a legible "how close am I to its home" cue.
- **Sand crab**: ambush points show as small telltale mounds with claw
  tracks converging on them, and a faint ripple in the sand half a second
  before it bursts out — foreshadowed, not a jump-scare with zero warning.
- **Ghost pirate**: its territory is wherever the cave/fog zone already is,
  so the environmental clue *is* the zone itself — colder colour grading,
  drifting mist, old shipwreck debris. The palette shift alone teaches
  "be careful here" before any ghost is on screen.

All three share one collision rule: **enemy sprite overlapping player
sprite → `lost`**, checked every frame regardless of enemy state. This is
also the rule the automated test below locks down.

## Progression

```
explore (fragments: 0–3)
   │  fragment collected × 3
   ▼
xRevealed  ── enemy contact ──▶ lost
   │  X reached (final treasure granted)
   ▼
escaping  ── enemy contact ──▶ lost
   │  ship reached
   ▼
won
```

`escaping` is the climax, and it has to feel like one. Three concrete things
change the instant it's entered, all visual/behavioural — no timer, no
countdown text required:

1. **Enemies wake up.** Everything currently resting or patrolling
   escalates — territorial chasers widen their leash, sand crabs stay
   surfaced instead of re-burying, ghosts drift faster. The world is
   visibly more hostile the moment the final treasure is grabbed.
2. **The red trail becomes the lifeline.** Its render flips from a quiet
   memory-aid to the thing the player is actively following: it brightens,
   thickens, and gets a subtle pulse/glow running back toward the ship —
   turning "retrace your steps" from a passive option into the obvious
   next move.
3. **The ship becomes a beacon.** It gets a visible marker (a light,
   flag-flare, glow) so it reads on screen from anywhere on the map, and
   the run back has something to visibly aim for.

The state machine and these three effects are fixed; exact magnitudes (how
much wider the leash, how bright the trail glows) are what playtesting
tunes.

## Visual direction

- **Palette**: sepia/parchment base (`#e8d9b5`-ish paper, brown ink lines)
  for anything not-yet-revealed; revealed zones get muted, desaturated
  colour per biome — sandy tan (beach), dusty green (jungle), grey-moss
  (ruins), near-black with a soft vignette (cave/fog).
- **Player**: a simple chibi pirate — 2–3 head-heights tall, oversized head,
  small body, readable at both a 390px-wide phone canvas and a desktop
  window. Simple geometric/vector shapes over pixel art, to keep asset
  production light and scaling clean — but not static. A small
  state-driven animation set is what makes it read as *alive* with zero
  text:
  - **Idle**: a subtle breathing sway, maybe a hat-brim tilt.
  - **Run**: a bouncy squash-and-stretch bob in step with movement, hat and
    coat/bandana lagging a frame or two behind the body so they flap.
  - **Alert reaction**: a startle beat — a small hop, head snapping toward
    the threat — the instant a nearby enemy flips into its `alert` state.
    This is the player-side half of the "oh, it saw me" teaching moment.
  - **Chase reaction**: faster, higher-amplitude run bob, arms pumping,
    hat nearly blown off — visibly more frantic than the normal run.
  - **Pickup reaction**: a quick hop-and-hold-item-up beat on collecting
    anything, longer and more triumphant for the final treasure than for a
    coin.
- **Red trail**: hand-drawn ink aesthetic — jittered stroke, slightly
  varying width, maybe a subtle "compass rose" or "you are here" pirate-map
  flourish at the most recent point.
- **Enemies**: silhouette-first readability — skeleton (bone-white),
  crab (reddish, low to the ground), ghost (translucent blue-white, only
  ever seen against the cave's dark palette). The `alert` transitional
  state gets a shared, unmistakable tell — an exclamation/eye-flash — so a
  first-time player learns "that means run" without being told.
- **The X and final treasure**: the one moment the parchment aesthetic
  breaks convention on purpose — a bold red X, unmissable against the
  muted revealed map, is the single biggest visual beat in the game.

## No-tutorial discoverability

- **Opening screen affordance**: the player spawns already standing next to
  their ship, on an otherwise-uncovered beach — nothing to read, one
  visible chibi character, an obvious unmarked patch of unrevealed
  parchment in front of them. The natural first action (move toward the
  unrevealed edge) is rewarded instantly by fog lifting.
- **Trail teaches itself**: the moment the player takes a few steps, they
  see red ink following them — no explanation needed for "this is where
  I've been."
- **First pickup is close and harmless**: a coin sits a few steps from
  spawn. Walking over it and seeing a small score-tick (icon, not text) in
  a corner teaches "touching things does something" before any enemy
  exists.
- **First enemy is visible before it's dangerous**: the nearest skeleton
  pirate's territory overlaps the jungle entrance the player must cross,
  and it starts in `patrol`, at a distance — the player sees it moving on
  its own before it ever notices them, which is how they learn "these
  things move independently" safely.
- **Danger is taught by a near-miss, not a rule.** The `alert` visual tell
  exists specifically so a player's first close call reads as "oh, it saw
  me" rather than an instant, unexplained loss.
- **No instructional text, ever** — nothing that explains controls or goals
  (no "how to play", no on-screen prompts, no tooltips; this is also what
  `spec/crit-5.test.ts` checks mechanically). Plain **game-state** text is
  fine and doesn't compromise the no-tutorial rule: a small score readout
  and a simple "You win" / "You lose" screen read as the game telling you
  what happened, not how to play it. Fragment count and sight-radius state
  stay non-textual (fragment icons filling in, a screen-edge vignette),
  since those are moment-to-moment feedback rather than end-state
  summaries.

## Automated game-rule tests

Game logic lives in a pure, DOM/canvas-free module (e.g. `game-logic.ts`):
plain functions over plain state objects (`Player`, `Enemy`, `GameState`),
no `requestAnimationFrame`, no canvas context, no event listeners. That
split is what makes the rule below cheaply testable with vitest, the same
way the invariants test the built site rather than simulating a browser
session.

**The one rule with a focused test** (satisfies the spec's "one rule of the
game has a focused automated test"):

> Enemy contact ends the game in a loss, in every progression state.

```ts
// sketch — exact shape TBD once Player/Enemy types exist
it("ends the run in a loss on enemy contact, in any state", () => {
  for (const state of ["explore", "xRevealed", "escaping"] as const) {
    const result = checkLoss(overlappingPlayerAndEnemy(state));
    expect(result).toBe("lost");
  }
});
```

Good candidates for one or two more sensors, once the mechanic exists
(not required by the spec, but cheap confidence — the spec/README notes
there's no minimum count):

- Collecting the third fragment — and only the third — flips `xRevealed`.
- Cursed treasure's alert pulse sets every enemy inside the alert radius to
  `chase`, and leaves enemies outside it untouched.

The **"change from playing"** half of that spec line isn't a test — it's a
tuning decision (radius sizes, the escape-phase difficulty bump, sand-crab
ambush range) that only feels right or wrong once a stranger is actually
being chased around the map. That change and why it happened is what goes
in `PROCESS.md` and `reflections/crit-5.md`, not in `spec/`.

## Implementation checkpoints

Each checkpoint is meant to be a commit (or a few), red until it's done,
green after — the process the repo's history should show.

1. **Scaffold**: canvas sized to the viewport, a game loop, a movable
   placeholder pirate shape, keyboard (arrow/WASD) input. Checkpoint: the
   pirate moves around an empty canvas at both marking viewports.
2. **Touch/pointer input**: drag-to-move or a thumb-anchored virtual stick
   that appears on touch-start, feeding the same movement vector as
   keyboard. Checkpoint: playable one-handed at 390×844.
3. **World + camera**: parchment base layer, world larger than the
   viewport, camera follows and clamps to bounds.
4. **Map drawing + red trail**: grid reveal state; the sketch-then-wash
   reveal animation; trail recording and hand-drawn rendering. Checkpoint:
   exploring visibly draws the map in and leaves a trail.
5. **Zones**: paint beach/jungle/ruins/cave regions with distinct
   treatment; place the ship; scatter each zone's environmental
   territory clues (bones, ambush mounds, cave mist) ahead of the enemies
   that will use them.
6. **Pickups**: coin, gem, torch, speed boost — spawn, collect, apply
   effect, the pickup reaction animation, a small score readout.
7. **Enemy framework + skeleton pirate**: shared FSM, territory/leash,
   rendering, the `alert` tell, the player's alert-reaction animation.
8. **Sand crab + ghost pirate**: ambush burst behaviour; ghost tied to the
   dark-zone visibility system; the player's chase-reaction animation.
9. **Cursed treasure + alert pulse**; torch/visibility interplay finished
   end to end.
10. **Fragments → X → final treasure → escape → ship → win**; enemy-contact
    loss wired in for every state; the escape climax's three effects
    (enemies wake, trail brightens into the lifeline, ship becomes a
    beacon); the "You win" / "You lose" game-state screens. Checkpoint: the
    full loop is completable start to finish.
11. **Automated rule test(s)** written and green; a real playtesting pass
    (ideally with someone who hasn't seen the code) to find the one change
    that playing surfaces.
12. **Polish + verification**: visual juice (chase vignette, X reveal
    beat), `pnpm check` green, both marked viewports checked by hand,
    `PROCESS.md` and `reflections/crit-5.md` written.
