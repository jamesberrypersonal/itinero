// Finding a place (docs/spec/web/places.md §4.2, §4.3, §4.6): folding, matching and ordering, with
// the towns of Chile and the United States the build wrote, and airports for a sample of codes,
// with no network. For WEB:PLACES-F1.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { countriesOf } from "../../src/places/needs.ts";
import { findAirport, fold, searchTowns, TownIndex, type AirportsFile, type TownsFile } from "../../src/places/search.ts";

const places = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "places");
const readFile = <T>(name: string): T => JSON.parse(readFileSync(join(places, name), "utf8")) as T;
const airports = readFile<AirportsFile>("airports.json");
const chile = new TownIndex(readFile<TownsFile>("CL.json"));
const unitedStates = new TownIndex(readFile<TownsFile>("US.json"));

test("folding drops accents and capitals", () => {
  assert.equal(fold("Valparaíso"), "valparaiso");
  assert.equal(fold("Ñuñoa"), "nunoa");
  assert.equal(fold("São Paulo"), "sao paulo");
  assert.equal(fold("PUERTO Natales"), "puerto natales");
});

test("SCL gives Santiago's airport, in Chile, in America/Santiago", () => {
  const scl = findAirport(airports, "SCL");
  assert.equal(scl?.kind, "airport");
  assert.equal(scl?.town, "Santiago");
  assert.equal(scl?.country, "CL");
  assert.equal(scl?.zone, "America/Santiago");
  assert.match(scl!.name, /Merino Benítez/);
});

test("MAD gives Madrid's airport, in Europe/Madrid, and a code is read in any case", () => {
  assert.equal(findAirport(airports, "MAD")?.zone, "Europe/Madrid");
  assert.equal(findAirport(airports, "mad")?.code, "MAD");
  assert.equal(findAirport(airports, "PUQ")?.zone, "America/Punta_Arenas");
});

test("a code no airport has, or that is not three letters, gives nothing", () => {
  assert.equal(findAirport(airports, "QQQ"), undefined);
  assert.equal(findAirport(airports, "SC"), undefined);
  assert.equal(findAirport(airports, "SCL1"), undefined);
});

test("Puerto Nat gives Puerto Natales first, in America/Punta_Arenas", () => {
  const [first] = searchTowns([chile], "Puerto Nat");
  assert.equal(first?.name, "Puerto Natales");
  assert.equal(first?.zone, "America/Punta_Arenas");
  assert.equal(first?.country, "CL");
  assert.equal(first?.kind, "town");
});

test("Santiago gives the capital before smaller towns of that name", () => {
  const found = searchTowns([chile, unitedStates], "Santiago");
  assert.equal(found[0]?.name, "Santiago");
  assert.equal(found[0]?.country, "CL");
  assert.equal(found[0]?.region, "Santiago Metropolitan");
});

test("accents and capitals are ignored, and the words may come in any order", () => {
  assert.equal(searchTowns([chile], "puerto natales")[0]?.name, "Puerto Natales");
  assert.equal(searchTowns([chile], "Valparaiso")[0]?.name, "Valparaíso");
  assert.equal(searchTowns([chile], "natales puerto")[0]?.name, "Puerto Natales");
});

test("a town whose name begins with the first word comes before a larger one where it only appears", () => {
  const found = searchTowns([unitedStates], "york", 100).map((place) => place.name);
  const city = found.indexOf("New York City");
  assert.ok(city > 0, "New York City matches");
  assert.ok(found.slice(0, city).every((name) => name.startsWith("York")), "every town before it begins with York");
});

test("a town of a country not held gives nothing", () => {
  assert.deepEqual(searchTowns([chile], "Arequipa"), []);
  assert.deepEqual(searchTowns([chile], ""), []);
});

test("at most ten towns are given, unless another limit is", () => {
  assert.equal(searchTowns([unitedStates], "Spring").length, 10);
  assert.equal(searchTowns([unitedStates], "Spring", 3).length, 3);
});

test("a trip's countries are those of its pages for a country, and of its stretches where it holds the calendar", () => {
  const withCalendar = {
    pages: { pages: [{ country: "CL" }, {}, { country: "AR" }] },
    calendar: { stretches: [{ place: { country: "BO" } }, { place: { country: "CL" } }] },
  };
  const without = { pages: { pages: [{ country: "PE" }] } };
  assert.deepEqual(countriesOf([withCalendar, without]), ["AR", "BO", "CL", "PE"]);
  assert.deepEqual(countriesOf([without], ["UY"]), ["PE", "UY"]);
});
