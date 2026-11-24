// PLN:CHECKLISTS-NFR1 — the same changes give the same checklists on a device set to English and
// London time and on one set to Turkish and Tokyo time (spec §4.7). The checks on a phone with no
// connection wait for the web app.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "results.ts");
const run = (lang: string, tz: string) =>
  execFileSync(process.execPath, [script], { env: { ...process.env, LANG: lang, LC_ALL: lang, TZ: tz }, encoding: "utf8" });

test("PLN:CHECKLISTS-NFR1 — the same changes give the same checklist under English and Turkish", () => {
  const english = run("en_GB.UTF-8", "Europe/London");
  const turkish = run("tr_TR.UTF-8", "Asia/Tokyo");
  assert.equal(turkish, english);
  assert.match(english, /İstanbul, then Kadıköy/);
});
