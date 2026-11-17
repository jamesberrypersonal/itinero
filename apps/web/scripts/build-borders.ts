// Makes the map of country borders the home page finds the phone's country in
// (docs/spec/web/screens.md §5.1).
//
//     npm run build-borders
//
// Download Natural Earth's countries at 1:50 million first, and unzip them into borders-data/ in
// this package, which git ignores:
// https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip
//
// It writes src/screens/borders.json, which is committed.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBorders } from "./borders/build.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(appRoot, "borders-data", "ne_50m_admin_0_countries");
if (!existsSync(`${source}.shp`)) {
  console.error(`build-borders: ${source}.shp is missing. Download it first, as this script's opening comment says.`);
  process.exit(1);
}
const borders = buildBorders(readFileSync(`${source}.shp`), readFileSync(`${source}.dbf`));
const target = join(appRoot, "src", "screens", "borders.json");
writeFileSync(target, JSON.stringify(borders));
console.log(`build-borders: wrote ${Object.keys(borders).length} countries to ${target}`);
