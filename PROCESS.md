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

4. **A real first playtest surfaced bugs code review never would have.**
   Playwright became available, so I actually opened the deployed-shape dev
   build in a browser at both marked viewports and played it, instead of
   reasoning about coordinates on paper. That surfaced three real problems
   the whole `pnpm check`-green history above had missed: restart never
   armed on either keyboard or touch, because the lose-screen listener was
   never actually wired to a reset call
   ([`be2321f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/be2321f));
   the world had no collision at all, so "trees" and "rocks" were paint
   with nothing behind them, and treasure was scattered evenly instead of
   clustered around anything worth finding
   ([`36b44ad`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/36b44ad));
   and, worst, the terrain still visibly read as a printed grid of stamped
   icons even after that same commit's message claimed it was fixed —
   caught only by screenshotting rendered pixels and looking at them, not by
   trusting my own commit description. Fixing it for real took thinning
   glyph density per terrain kind and jittering both glyph and colour-blob
   placement per cell, alongside a new ground-trap FSM and denser,
   overlapping enemy coverage in jungle/ruins/cave
   ([`7ac7511`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/7ac7511)).
   The lesson: a passing check roster and a confident commit message are
   claims, not proof — looking at the actual rendered page is a different
   and necessary kind of verification.

5. **Redesigning the pirate as a real character, then adding combat, off the
   same playtest.** The same first playtest that found the restart/terrain/
   density bugs above also judged the player sprite itself as flat placeholder
   geometry and the loss condition ("just touch anything and die") as a dead
   end with no way to fight back. The pirate became a chibi character —
   oversized hat, small body, bounce on run, a startle hop on alert, a pose for
   being chased — via `PlayerVisualState`
   ([`ff1381f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/ff1381f)),
   and a short-range sword swing (`src/combat.ts`) was wired into the existing
   enemy FSM as a new `"defeated"` state rather than a separate kill system —
   an enemy knocked back stays excluded from the loss check while down, then
   walks itself home via the FSM's own `"return"` state once stunned
   ([`7da1602`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/7da1602)).
   That combat commit is also where the "look at rendered pixels, don't trust
   the commit message" lesson from moment 4 paid off a second time: a scripted
   Playwright approach kept dying before a swing ever landed, and screenshot
   timing alone couldn't tell me why. The fix was a temporary debug hook
   exposing live player/enemy state to the test script (added, used to verify,
   then removed before committing) — it showed the skeleton's actual
   detection radius was smaller than I'd assumed and that it holds position
   during its alert telegraph rather than already closing distance, which the
   screenshot timing alone had made look the opposite way. With real numbers
   instead of a guess, the same approach landed a confirmed hit: swing lands
   at 33px (inside the 56px range), the skeleton flips to `"defeated"` with a
   visible knockback displacement, the player survives, and it's back to
   `"return"` and walking home about 1.6s later.

6. **First-encounter callouts, kept deliberately name-only.** The same
   playtest that drove moments 4–5 also flagged the danger roster (skeleton,
   crab, ghost, traps, cursed hoard) as unintroduced — a new player has no way
   to know what they're looking at until it already hurts them, but the
   no-tutorial rule rules out any actual how-to-play text. The fix
   (`src/render/callout.ts`) is a floating name-tag — "Skeleton", "Sand Crab",
   "Ghost Pirate", "Trap!", "Cursed Hoard" — that appears once per kind the
   first time it enters the player's own sight radius, then fades on its own;
   it says what the thing is and nothing about what to do about it, so the
   actual teaching still happens through the enemy's alert/chase animation and
   the consequence of touching it, not through the label
   ([`06fa57a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/06fa57a)).
   Verified the same debug-hook way as moment 5: a scripted approach that just
   waited a fixed duration kept either dying (the callout never gets to fade
   because `update()` freezes on loss) or missing the encounter entirely
   (patrol wander is randomised, so a fixed-timing script sometimes never
   brings the player into sight range at all). Polling
   `window.__debugState()` every 30ms and reacting the instant a callout
   appeared — retreating immediately rather than guessing when it was safe
   to — finally confirmed the real behaviour: the label attaches to the live
   skeleton, fades after ~1.6–1.8s on its own, and the player survives the
   whole encounter.

7. **A second playtest round, closed out in three gated groups instead of one
   dump.** A later playtest raised four distinct complaints — restart wasn't
   really fresh, every run had the same map, the win/loss progression was
   illegible moment-to-moment, and the pirate sprite itself was weaker than an
   earlier version — and each became its own commit, gated on a green
   `pnpm check` and genuine in-browser verification before landing, rather
   than one large diff at the end:
   - **Restart + map variation**: `resetGame()` used to leave the layout,
     obstacles, and fog-of-war untouched, so a "new run" was cosmetically new
     entities on the same map. `src/rng.ts` (seeded mulberry32) lets
     `buildWorldLayout()` rejection-sample every point of interest per zone
     while keeping the band/cave/ship structure fixed, and `worldgen.ts`'s
     `generateWorld(seed)` retries with a derived seed (up to 12 attempts, with
     a no-obstacle fallback) against a real flood-fill reachability check, so
     every generated run is provably completable, not just probably.
     [`6682d47`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/6682d47)
   - **Win/loss progression**: the escape climax already existed (enemy
     aggression boost, trail lifeline, ship beacon), but nothing on screen told
     the player *why* — no fragment counter, no announcement when the X
     revealed or when the treasure was secured, and reaching X granted no
     points despite a doc comment claiming it did. Added a fragment-progress
     HUD, one-shot story banners on each transition, an X-direction arrow
     (reusing the same offscreen-arrow math already built for the ship), and
     wired the missing score bonus. Playwright caught a real bug this pass:
     the banner's fixed font size overflowed both edges of the 390px phone
     viewport, invisible at 1920×1080.
     [`03bda4d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/03bda4d)
   - **Pirate redesign**: the brief asked for silhouette-first, then cute —
     large hat, eye patch, small coat/vest, boots, oversized head. Replaced
     the old bandana with a bicorne wide enough to be unambiguous at gameplay
     scale, swapped one eye for a patch with a strap, rebuilt the torso as a
     vest with coat-tails over the old plain ellipse, and added a
     `carryingTreasure` animation state (two-handed pose plus a rendered
     chest) for the escape phase. Verifying this one needed a step beyond the
     usual debug-hook teleport: the chibi character is only 40–60px tall in a
     full-viewport screenshot, too small to actually judge a hat shape or a
     patch strap by eye. Added a `screenPos` field to the debug hook (backed
     by a `lastCamera` capture in `render()`, both removed before committing)
     so Playwright could clip a precise, tightly-cropped screenshot centered
     on the character — the only way any of this was actually confirmed
     legible rather than assumed legible from source code.
     [`e60a077`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/e60a077)

8. **Finding a structural bug by tracing what "1-hit sneak kill" actually
   required, not just reading the code.** A later request asked for real
   combat — HP instead of a single always-"defeated" knockdown, a defeat
   score, hit-flash/shake, and denser, overlapping danger zones — and named
   the exact hit counts: skeletons and ghosts take 2 hits, a crab caught
   still buried takes 1. That last rule couldn't actually fire. `updateEnemies`
   (which runs a crab's own proximity-triggered patrol→alert transition) runs
   before the attack-processing block in `main.ts`'s frame loop, and
   `CRAB_AMBUSH_RADIUS` (70px) was larger than `combat.ts`'s own
   `ATTACK_RANGE` (56px) — so a player could never be within striking
   distance of a buried crab without the crab having already noticed them on
   that same frame. The "sneak kill while still patrol" reward was
   unreachable in normal play, not just untested. Confirmed this by writing a
   small isolated Playwright repro against a temporary debug hook
   (`window.__debugState`/`__debugTeleportPlayer`, added, used, then removed
   before committing) before changing anything, rather than guessing from the
   constants alone. Fixed by shrinking the ambush radius to 40, opening a
   real 40–56px sneak window, and verified end to end in-browser at both
   marked viewports: keyboard and pointer/touch attacks landing hits and
   respecting cooldown, a skeleton dying on its 2nd hit and getting pruned
   after its fade, the crab sneak-kill actually landing, ghost vulnerability
   holding on both the without-torch and with-torch branches, collision loss
   still firing, and restart still producing a fresh run.
   [`1fb3912`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-pengyue-Stella/commit/1fb3912)

## What still needs a human

- **Real playtesting by someone who hasn't seen the code.** The pass above
  is real browser verification (Playwright, both marked viewports, actual
  screenshots, actual bugs found and fixed), which is a genuine step up from
  the checkpoint-11 self-playtest-by-code-tracing this file used to describe
  here. But it's still me driving the browser, primed by having written every
  system. It is not a substitute for a first-time player's reaction —
  particularly to difficulty (is the skeleton's leash fair, is the cave dark
  enough to be tense without being frustrating) and to the discoverability
  claims in `PLAN.md` (is the jungle-boundary skeleton actually noticed
  before it's dangerous, is a trap's anticipation tell readable in the
  moment rather than only in slow-motion screenshot review).
