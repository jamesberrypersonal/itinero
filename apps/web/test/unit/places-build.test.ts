// The build of the places' files (docs/spec/web/places.md §4.5, §4.6), on a small sample of each
// dataset: what it writes, and that a second run gives the same bytes.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildPlaces, readCsv } from "../../scripts/places/build.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "places");
const sources = {
  cities: readFileSync(join(fixtures, "cities1000.txt"), "utf8"),
  regions: readFileSync(join(fixtures, "admin1CodesASCII.txt"), "utf8"),
  airports: readFileSync(join(fixtures, "airports.csv"), "utf8"),
  version: "2026-11-14",
};
const built = buildPlaces(sources);
const read = (name: string): unknown => JSON.parse(built.get(name)!);

test("it writes one file for each country with towns, the airports, and the index", () => {
  assert.deepEqual([...built.keys()], ["CL.json", "DO.json", "ES.json", "airports.json", "index.json"]);
});

test("a country's towns are ordered by population, largest first, each naming its zone once", () => {
  assert.equal(
    built.get("CL.json"),
    '{"country":"CL","towns":[["Santiago","Santiago Metropolitan",0,4837295],["Valparaíso","Valparaíso",0,282448],' +
      '["Punta Arenas","Magallanes",1,117430],["Puerto Natales","Magallanes",1,18505]],' +
      '"version":"2026-11-14","zones":["America/Santiago","America/Punta_Arenas"]}',
  );
});

test("each airport with an IATA code takes the zone of the nearest town in its country", () => {
  assert.deepEqual(read("airports.json"), {
    airports: [
      ["MAD", "Adolfo Suárez Madrid–Barajas Airport", "Madrid", "ES", 0],
      ["PUQ", "President Carlos Ibáñez International Airport", "Punta Arenas", "CL", 1],
      ["SCL", "Comodoro Arturo Merino Benítez International Airport", "Santiago", "CL", 2],
    ],
    version: "2026-11-14",
    zones: ["Europe/Madrid", "America/Punta_Arenas", "America/Santiago"],
  });
});

test("a closed airport, one with no code, and one in a country with no towns are left out", () => {
  const codes = (read("airports.json") as { airports: string[][] }).airports.map((row) => row[0]);
  assert.ok(!codes.includes("OLD"));
  assert.ok(!codes.includes("LIM"));
  assert.equal(codes.length, 3);
});

test("of two airports given one code, the one with scheduled flights is kept", () => {
  const scl = (read("airports.json") as { airports: string[][] }).airports.find((row) => row[0] === "SCL")!;
  assert.equal(scl[1], "Comodoro Arturo Merino Benítez International Airport");
});

test("the index gives the version, and each country's file size", () => {
  assert.deepEqual(read("index.json"), {
    countries: {
      CL: Buffer.byteLength(built.get("CL.json")!),
      DO: Buffer.byteLength(built.get("DO.json")!),
      ES: Buffer.byteLength(built.get("ES.json")!),
    },
    version: "2026-11-14",
  });
});

test("the same downloaded files give the same bytes", () => {
  const again = buildPlaces(sources);
  assert.deepEqual([...again.entries()], [...built.entries()]);
  const shuffled = buildPlaces({ ...sources, cities: sources.cities.trim().split("\n").reverse().join("\n") });
  assert.deepEqual([...shuffled.entries()], [...built.entries()]);
});

test("a version that is not a date is refused", () => {
  assert.throws(() => buildPlaces({ ...sources, version: "latest" }));
});

test("CSV fields in quotes may hold commas, doubled quotes and newlines", () => {
  assert.deepEqual(readCsv('a,"b, c","say ""hi""","two\nlines"\r\nd,,e\n'), [
    ["a", "b, c", 'say "hi"', "two\nlines"],
    ["d", "", "e"],
  ]);
});
