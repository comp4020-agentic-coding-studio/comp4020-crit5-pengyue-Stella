import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Mechanically-checkable lines from the crit-5 ("A game") spec:
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/
//
// Most of the brief only a person can judge, or only playing can prove: whether
// a wrong move is truly possible and play ends somewhere, whether a stranger
// reaches an ending inside five minutes, and one rule under a focused automated
// test of its own (yours to add once the mechanic exists, alongside the note in
// PROCESS.md about the change playing it made you make). No test can hold
// those; see PROCESS.md for how that gets demonstrated instead.
const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files();
const htmlPages = shipped
  .filter((path) => path.endsWith(".html"))
  .map((path) => ({
    path,
    doc: new JSDOM(readFileSync(path, "utf8")).window.document,
  }));

describe("crit-5: a game", () => {
  it("has no on-screen instructions, how-to-play text or tutorial", () => {
    const instructional = /how\s*(-|to )\s*play|instructions|tutorial/i;
    for (const { path, doc } of htmlPages) {
      const text = doc.body?.textContent ?? "";
      expect(
        instructional.test(text),
        `${path} contains what reads like on-screen instructions --- the opening screen has to make the first move obvious on its own, not explain it`,
      ).toBe(false);
    }
  });

  it("ships no separate instructions/help/tutorial page", () => {
    const helpPage = /(^|\/)(help|instructions|how-?to-?play|tutorial|rules)\.html$/i;
    const offender = shipped.find((path) => helpPage.test(path));
    expect(
      offender,
      "a page like this stands in for the on-screen tutorial the brief rules out --- fold whatever it explains into the opening screen instead",
    ).toBeUndefined();
  });
});
