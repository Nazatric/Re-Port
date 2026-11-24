// Checks the artwork title gate against the known bad matches (Doom 1993 vs Doom 2016, unrelated sequels).
// The same composition (scoreCandidate -> sameRelease -> confidentChoice) is used by build-art-bundle.mjs.
import assert from "node:assert/strict";
import { scoreCandidate, confidentChoice, sameRelease } from "./artwork/title-match.mjs";

function pick(query, queryYear, candidates) {
  const scored = candidates
    .map((c) => ({ ...c, ...scoreCandidate(query, c.name, { queryYear, candidateYear: c.year }) }))
    .filter((c) => sameRelease(queryYear, c.year));
  return confidentChoice(scored, { min: 0.95, gap: 0.1 });
}

// Year gate
assert.equal(sameRelease(1993, 2016), false);
assert.equal(sameRelease(2016, 2016), true);
assert.equal(sameRelease(1993, 1994), true, "one year of slack for launch-year differences");
assert.equal(sameRelease(null, 2016), true, "unknown catalog year passes");
assert.equal(sameRelease(1993, null), true, "unknown candidate year passes");

// Doom 1993 must not take the 2016 reboot's art, even though the title is identical.
assert.equal(pick("Doom", 1993, [{ name: "DOOM", year: 2016 }]), null);
// The same title with the right year is accepted.
assert.equal(pick("Doom", 1993, [{ name: "DOOM", year: 1993 }])?.name, "DOOM");
// A sequel is not accepted for the first game.
assert.equal(pick("Doom 3", 2004, [{ name: "Doom", year: 1993 }]), null);
// Two near-identical same-year candidates are refused rather than guessed.
assert.equal(pick("Gunfire", 2001, [{ name: "Gunfire", year: 2001 }, { name: "Gunfire!", year: 2001 }])?.name, "Gunfire");

console.log("Artwork title gate checks passed.");
