// BKG:LIST-NFR1 — the bookings list gives the same results on a device set to London time and on
// one set to Tokyo time (spec/bookings/list.md §4.6). Every test file runs with no network code,
// which source.test.ts confirms.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "results.ts");
const run = (tz: string) => execFileSync(process.execPath, [script], { env: { ...process.env, TZ: tz }, encoding: "utf8" });

test("BKG:LIST-NFR1 — the same results under London and Tokyo time", () => {
  const london = run("Europe/London");
  const tokyo = run("Asia/Tokyo");
  assert.ok(JSON.parse(london).touches);
  assert.equal(tokyo, london);
});
