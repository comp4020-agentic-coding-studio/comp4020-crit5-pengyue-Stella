# Process overview

## What I built

"X Marks the Spot" — a top-down pirate exploration game on canvas. You spawn
at your ship, explore a beach → jungle → ruins world (plus a cave pocket
tucked inside the ruins) that reveals as a hand-drawn parchment map under a
torchlight-style fog of war, collect three map fragments to reveal the X,
dodge three enemy types with a shared four-state FSM (a leashed skeleton, a
buried sand crab that bursts on approach, and a cave-only ghost pirate),
optionally grab a cursed treasure for a big score bonus at the cost of waking
the whole map, then race the fragment-revealed X back to the ship while
everything gets harder (`escapeBoost`). Touching any enemy loses; reaching the
ship while escaping wins. [`236bfe8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/236bfe8)
is the design doc (`PLAN.md`); every commit after it is that plan built
checkpoint by checkpoint, each gated on a green `pnpm check` before landing.

## The moments that mattered

1. **Splitting the mandatory-test checkpoint off from the enemies that use
   it.** PLAN.md's own loss-rule test needed `Player`/`Enemy` shapes that
   didn't exist yet, so the obvious move was to write it alongside the first
   enemy. Instead I split it: `game-logic.ts` (the progression state machine
   and `checkLoss`) landed as its own commit before any enemy code existed,
   with its test suite covering the loss rule across every active status.
   That kept the single most spec-relevant test small, self-contained, and
   easy to point a marker at directly, rather than buried inside a larger
   enemy-framework diff.
   [`78613a5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/78613a5)

2. **Isolating the restart input primitive as its own commit.** The escape
   climax (checkpoint 10) had three independent pieces — the completable
   fragment→X→ship loop, the escape-boost/beacon/lifeline effects, and
   win/lose + restart — and restart was the one with real edge-case risk: a
   key held into the fatal collision keeps firing OS key-repeat `keydown`
   events, which would dismiss the lose screen before the player even
   registers losing. Rather than land all of checkpoint 10 in one commit and
   risk a follow-up fix touching everything, I split it into 10a/10b/10c so
   the arm-delay logic (`terminalEnteredAt` / `RESTART_ARM_DELAY`, and the
   edge-triggered `consumeActivation`/`clearActivation` pair on
   `InputController`) could be reasoned about and tested in isolation.
   [`bb48dac...2d9834e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/compare/bb48dac...2d9834e)

3. **Tracing the cursed-treasure trap against real coordinates instead of
   trusting the constant.** `ALERT_PULSE_RADIUS = 420` reads like it should
   cover "nearby danger" — it's already well past any single enemy's own
   detection radius. But with no browser available to actually play it, I
   worked through `buildWorldLayout()`'s literal numbers by hand: the cave
   sits in the corner of the map, and both skeleton homes are 1400–1500px
   from the cursed treasure's position. At 420, grabbing the treasure never
   alerted either skeleton — only the crab and ghosts already living in the
   cave ever reacted, so the "big score bonus, big trap" moment was mostly
   invisible. I widened the radius to 1600 so it reaches every enemy home in
   the world. This is the one deliberate tuning change the self-playtest
   (checkpoint 11) was supposed to surface, and it's a real example of a
   number that looked fine in isolation but was wrong once checked against
   the actual layout it runs against.
   [`e52a999`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/e52a999)

## What still needs a human

Two things I deliberately did not fake:

- **Real browser verification.** `agent-browser` and headless-browser
  tooling (chromium/playwright/puppeteer) were unavailable in this
  environment for the whole build. Every checkpoint was verified with
  `pnpm check` (typecheck, build, lint, tests) plus close reading of the
  render code and the actual world coordinates — not by looking at the
  rendered page. The game has never actually been seen running. Before this
  ships, someone needs to open it in a real browser at both 1920×1080 and
  390×844, play a full loop, and confirm the things code review can't: does
  it actually feel readable, does the joystick behave under a real touch
  drag, does anything overlap or clip that the math says shouldn't.
- **Real playtesting.** PLAN.md asks for "someone who hasn't seen the code."
  The checkpoint-11 pass above is a self-playtest via code tracing, which
  found one real balance issue, but it is not a substitute for a first-time
  player's reaction — particularly to difficulty (is the skeleton's leash
  fair, is the cave dark enough to be tense without being frustrating) and to
  the discoverability claims in `PLAN.md` (is the jungle-boundary skeleton
  actually noticed before it's dangerous).
