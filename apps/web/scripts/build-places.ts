// Makes the places' files from GeoNames and OurAirports (docs/spec/web/places.md §4.5).
//
//     npm run build-places -- <date>
//
// The date, such as 2026-11-14, is the day the files were downloaded, and becomes the list's
// version. Download them first into places-data/<date>/ in this package, which git ignores:
//
// - cities1000.txt, unzipped from https://download.geonames.org/export/dump/cities1000.zip
// - admin1CodesASCII.txt, from https://download.geonames.org/export/dump/admin1CodesASCII.txt
// - airports.csv, from https://davidmegginson.github.io/ourairports-data/airports.csv
//
// It replaces every file in places/, which is committed, and copied into each build of the web app.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlaces } from "./places/build.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message: string): never {
  console.error(`build-places: ${message}`);
  process.exit(1);
}

const version = process.argv[2];
if (!version || !/^\d{4}-\d{2}-\d{2}$/.test(version)) fail("give the date the files were downloaded, such as: npm run build-places -- 2026-11-14");
const source = join(appRoot, "places-data", version);
const read = (name: string) => {
  const path = join(source, name);
  if (!existsSync(path)) fail(`${path} is missing. Download it first, as this script's opening comment says.`);
  return readFileSync(path, "utf8");
};

const built = buildPlaces({
  cities: read("cities1000.txt"),
  regions: read("admin1CodesASCII.txt"),
  airports: read("airports.csv"),
  version,
});

const out = join(appRoot, "places");
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) if (name.endsWith(".json")) rmSync(join(out, name));
let bytes = 0;
for (const [name, text] of built) {
  writeFileSync(join(out, name), text);
  bytes += Buffer.byteLength(text);
}
console.log(`build-places: wrote ${built.size} files, ${Math.round(bytes / 1024)} kilobytes, to ${out}`);
