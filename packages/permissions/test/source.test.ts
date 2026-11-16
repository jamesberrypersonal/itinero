// What the source of src/ must never do (spec §6): hold network code, or read anything from the
// device, so that it works with no connection and the same everywhere (ACC:PERMISSIONS-NFR1).

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
  ["Math.random", /\bMath\.random\b/],
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["WebSocket", /\bWebSocket\b/],
  ["localStorage or indexedDB", /\b(localStorage|indexedDB)\b/],
  ["a Node module", /from\s+["']node:/],
  ["a package other than @itinero/pages", /^import (?!type )[^;]*from\s+["'](?!\.|@itinero\/pages["'])/m],
  ["toLocaleLowerCase or localeCompare", /\b(toLocaleLowerCase|toLocaleUpperCase|localeCompare|toLocaleString)\b/],
];

for (const [what, pattern] of forbidden) {
  test(`src/ never uses ${what}`, () => {
    for (const { file, code } of sources) assert.doesNotMatch(code, pattern, `src/${file} uses ${what}`);
  });
}
