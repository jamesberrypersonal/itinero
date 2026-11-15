// What the source of src/ must never do (spec §4, §6). trip-time never reads the device's clock or
// time zone, uses neither Intl nor Temporal (SHR:TRIP-TIME-NFR2), holds no network code
// (SHR:TRIP-TIME-NFR1), and reads no file.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const sources = readdirSync(src)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ file: f, code: readFileSync(join(src, f), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "") }));

const forbidden: [string, RegExp][] = [
  ["the Date object", /\bDate\b/],
  ["Intl", /\bIntl\b/],
  ["Temporal", /\bTemporal\b/],
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["WebSocket", /\bWebSocket\b/],
  ["EventSource", /\bEventSource\b/],
  ["navigator", /\bnavigator\b/],
  ["process", /\bprocess\b/],
  ["a Node module", /from\s+["']node:/],
  ["a package", /from\s+["'][^."']/],
];

test("src/ holds the package's modules", () => {
  assert.ok(sources.some((s) => s.file === "index.ts"));
});

for (const [what, pattern] of forbidden) {
  test(`src/ never uses ${what}`, () => {
    for (const { file, code } of sources) assert.doesNotMatch(code, pattern, `src/${file} uses ${what}`);
  });
}
