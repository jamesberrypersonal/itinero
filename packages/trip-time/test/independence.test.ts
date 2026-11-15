// SHR:TRIP-TIME-NFR2 — a value reads and sorts the same on every device, whatever time zone the
// device is set to (spec §4.12). The same values are written, sorted and measured in two
// processes, one with the device set to London time and one to Tokyo time.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "results.ts");
const resultsIn = (tz: string) => {
  const out = execFileSync(process.execPath, [script], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
  return JSON.parse(out) as { text: string[][]; order: string[]; spans: string[] };
};

describe("SHR:TRIP-TIME-NFR2 — a value reads and sorts the same, whatever time zone the device is set to", () => {
  const london = resultsIn("Europe/London");
  const tokyo = resultsIn("Asia/Tokyo");

  test("the two devices really are set to different time zones", () => {
    const offsetIn = (tz: string) =>
      execFileSync(process.execPath, ["-e", "console.log(new Date(Date.UTC(2026, 5, 3)).getTimezoneOffset())"], {
        env: { ...process.env, TZ: tz },
        encoding: "utf8",
      }).trim();
    assert.notEqual(offsetIn("Europe/London"), offsetIn("Asia/Tokyo"));
  });

  test("the same values are written as the same text", () => {
    assert.ok(london.text.length > 100);
    assert.deepEqual(tokyo.text, london.text);
  });

  test("the same values sort into the same order", () => {
    assert.deepEqual(tokyo.order, london.order);
  });

  test("the same spans measure the same durations", () => {
    assert.deepEqual(tokyo.spans, london.spans);
  });
});
