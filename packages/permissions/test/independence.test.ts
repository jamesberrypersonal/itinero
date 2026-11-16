// ACC:PERMISSIONS-NFR1 — the permissions component gives the same results on a device set to
// English and London time and on one set to Turkish and Tokyo time. The checks on a phone with no
// connection, and in a browser, wait for the web app.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "results.ts");
const run = (lang: string, tz: string) =>
  execFileSync(process.execPath, [script], { env: { ...process.env, LANG: lang, LC_ALL: lang, TZ: tz }, encoding: "utf8" });

test("ACC:PERMISSIONS-NFR1 — levels, seen and authorise give the same under English and Turkish", () => {
  const english = run("en_GB.UTF-8", "Europe/London");
  const turkish = run("tr_TR.UTF-8", "Asia/Tokyo");
  assert.equal(turkish, english);
  assert.ok((JSON.parse(english) as { results: { seen: string[] }[] }).results.some((r) => r.seen.length > 0));
});
