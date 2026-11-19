// The places' limits (docs/spec/web/places.md §4.6): every file within its size, compressed with
// gzip as it is sent (WEB:PLACES-NFR2), and each answer of typing Springfield, against the towns of
// the United States, within 50 milliseconds on the machine running the tests (WEB:PLACES-NFR1). The
// check on a phone is made by hand before each release.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { searchTowns, TownIndex, type TownsFile } from "../../src/places/search.ts";

const places = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "places");

test("WEB:PLACES-NFR2 — the airports are at most 200 kilobytes, and each country's towns at most 600", () => {
  const files = readdirSync(places).filter((name) => name.endsWith(".json"));
  assert.ok(files.length > 200, "every country is built");
  for (const name of files) {
    const compressed = gzipSync(readFileSync(join(places, name))).length;
    const limit = name === "airports.json" ? 200_000 : 600_000;
    assert.ok(compressed <= limit, `${name} is ${compressed} bytes compressed, over ${limit}`);
  }
});

test("WEB:PLACES-NFR1 — each letter of Springfield is answered within 50 milliseconds", () => {
  const unitedStates = new TownIndex(JSON.parse(readFileSync(join(places, "US.json"), "utf8")) as TownsFile);
  const word = "Springfield";
  const times: number[] = [];
  for (let letters = 1; letters <= word.length; letters++) {
    const started = performance.now();
    const found = searchTowns([unitedStates], word.slice(0, letters));
    times.push(performance.now() - started);
    assert.ok(found.length > 0);
  }
  assert.equal(searchTowns([unitedStates], word)[0]?.name, "Springfield");
  for (const time of times) assert.ok(time < 50, `an answer took ${time.toFixed(1)} milliseconds`);
});
