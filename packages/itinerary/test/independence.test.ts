// PLN:ITINERARY-NFR1 — the same days of the same trip lay out the same on a device set to London
// time and on one set to Tokyo time (spec §4.8). The checks on a phone with no connection wait for
// the web app.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "results.ts");
const run = (tz: string) => execFileSync(process.execPath, [script], { env: { ...process.env, TZ: tz }, encoding: "utf8" });

test("PLN:ITINERARY-NFR1 — the same layout and text under London and Tokyo time", () => {
  const london = run("Europe/London");
  const tokyo = run("Asia/Tokyo");
  assert.ok(JSON.parse(london).layout.length === 12);
  assert.equal(tokyo, london);
});
