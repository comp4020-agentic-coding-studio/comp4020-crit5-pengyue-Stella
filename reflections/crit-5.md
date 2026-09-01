# Crit 5 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was getting a real browser to test the game, not just
trusting `pnpm check`. Early on, all my tests passed and every commit message
said things worked. But when I actually played the built game with
Playwright, I found problems the tests never saw. Restart did not really
work, on keyboard or on touch. When it did work, it just reset the enemies on
the same map, so a "new run" still felt like the old one. The world had no
collision, so trees and rocks were paint with nothing behind them. The
terrain still looked like a printed grid even after an earlier commit said it
was fixed. Later, when I added real combat, the sneak attack on a still
buried crab could never happen. The crab's own detection radius was bigger
than the sword's attack range, so it always noticed the player one frame
before the player could get close enough to hit it. No automated test caught
this, because it was two numbers working against each other, not one broken
function.

After finding these, I stopped trusting a green check list by itself. I used
a small debug hook to read the real game state while playing, and I took
screenshots to check real pixels, not just code. This is how I fixed restart,
map variation, obstacle collision, enemy density, trap readability,
progression clarity, and the pirate redesign, one playtest at a time.

## What did this work change about who I want to be as a software developer?

I want to trust real playtesting more than my own confidence in the code. A
passing test suite and a good commit message feel like proof, but they are
only claims until I try the thing myself. I want to keep checking real
behaviour in a real browser before I believe my own work is done.
