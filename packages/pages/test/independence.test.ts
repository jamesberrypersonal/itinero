// PLN:PAGES-NFR1 — search gives the same results on a device set to English and London time and on
// one set to Turkish and Tokyo time (spec §4.9). The checks on a phone with no connection wait for
// the web app.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "results.ts");
const run = (lang: string, tz: string) =>
  execFileSync(process.execPath, [script], { env: { ...process.env, LANG: lang, LC_ALL: lang, TZ: tz }, encoding: "utf8" });

test("PLN:PAGES-NFR1 — \"İstanbul\" and \"istanbul\" find the same pages under English and Turkish", () => {
  const english = run("en_GB.UTF-8", "Europe/London");
  const turkish = run("tr_TR.UTF-8", "Asia/Tokyo");
  assert.equal(turkish, english);
  const [dotted, plain] = JSON.parse(english) as [unknown[], unknown[]];
  assert.deepEqual(dotted.map((h) => (h as unknown[])[0]), (plain as unknown[]).map((h) => (h as unknown[])[0]));
  assert.ok(dotted.length > 0);
});
