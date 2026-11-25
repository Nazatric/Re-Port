// Checks the keyless Steam matching rules: exact title, year gate, no ambiguous or unrelated matches.
import assert from "node:assert/strict";
import { pickSteamApp, steamYear } from "./artwork/keyless-steam.mjs";

const det = (map) => async (id) => map[id] ?? null;

// Doom 1993 picks the 1993 app even though the 2016 app has the same title.
let id = await pickSteamApp({ title: "Doom", year: 1993 },
  [{ type: "app", name: "Doom", id: 379720 }, { type: "app", name: "DOOM", id: 2280 }],
  det({ 379720: { type: "game", releaseYear: 2016 }, 2280: { type: "game", releaseYear: 1993 } }));
assert.equal(id, 2280);

// Same title, no catalog year, two candidates: refused.
id = await pickSteamApp({ title: "Doom", year: 0 },
  [{ type: "app", name: "Doom", id: 1 }, { type: "app", name: "Doom", id: 2 }],
  det({ 1: { type: "game", releaseYear: 1993 }, 2: { type: "game", releaseYear: 2016 } }));
assert.equal(id, null);

// A different title is never used, even when it is the first search hit.
id = await pickSteamApp({ title: "Battlefield 2", year: 2005 },
  [{ type: "app", name: "Battlefield 2042", id: 9 }], det({ 9: { type: "game", releaseYear: 2021 } }));
assert.equal(id, null);

// DLC is refused.
id = await pickSteamApp({ title: "Ballance", year: 0 },
  [{ type: "app", name: "Ballance", id: 5 }], det({ 5: { type: "dlc", releaseYear: 2009 } }));
assert.equal(id, null);

// One year of difference is accepted, two years are refused.
id = await pickSteamApp({ title: "Ballance", year: 2008 }, [{ type: "app", name: "Ballance", id: 6 }], det({ 6: { type: "game", releaseYear: 2009 } }));
assert.equal(id, 6);
id = await pickSteamApp({ title: "Ballance", year: 2008 }, [{ type: "app", name: "Ballance", id: 6 }], det({ 6: { type: "game", releaseYear: 2010 } }));
assert.equal(id, null);

assert.equal(steamYear("10 Dec, 1993"), 1993);
assert.equal(steamYear("Coming soon"), null);
console.log("Keyless Steam matching checks passed.");
