// What the source of src/ must never do (spec/bookings/list.md §4, §6): read the device's clock or
// time zone, hold network code, or depend on the device's language (BKG:LIST-NFR1).

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const sources = readdirSync(src)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ file: f, code: readFileSync(join(src, f), "utf8").replace(/\/\/.*$/gm, "") }));

const forbidden: [string, RegExp][] = [
  ["the Date object", /\bDate\b/],
  ["Intl", /\bIntl\b/],
  ["Temporal", /\bTemporal\b/],
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["WebSocket", /\bWebSocket\b/],
  ["a Node module", /from\s+["']node:/],
  ["a package other than @itinero/trip-time", /from\s+["'](?!\.|@itinero\/trip-time["'])/],
  ["toLocaleLowerCase or localeCompare", /\b(toLocaleLowerCase|toLocaleUpperCase|localeCompare|toLocaleString)\b/],
];

for (const [what, pattern] of forbidden) {
  test(`src/ never uses ${what}`, () => {
    for (const { file, code } of sources) assert.doesNotMatch(code, pattern, `src/${file} uses ${what}`);
  });
}
