// A stored value keeps its local time when its zone's rules change (SHR:TRIP-TIME-F2, spec §4.12).
// The two fixtures differ for one zone: Paris keeps summer time in one, and has none in the other.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compare, format, parse, rulesVersion, toText } from "../src/index.ts";
import { NEW_YORK, PARIS, exact, loadFixture, ok } from "./helpers.ts";

describe("SHR:TRIP-TIME-F2 — a value keeps its local clock time when its time zone's rules change", () => {
  const style = { clock: "24h", dateOrder: "day-first" } as const;

  test("09:10 on a summer date, Paris time, still reads 09:10, Paris time, once Paris ends summer time", () => {
    loadFixture("summer-time.json");
    const value = exact(PARIS, "2026-06-03", "09:10");
    const stored = toText(value);

    loadFixture("no-summer-time.json");
    assert.equal(rulesVersion(), "test-b");
    assert.equal(toText(value), "2026-06-03T09:10[Europe/Paris]");
    assert.equal(format(value, style), "Wed 3 June 2026, 09:10, Paris time");
    const read = ok(parse(stored));
    assert.deepEqual(read, value);
    assert.equal(format(read, style), "Wed 3 June 2026, 09:10, Paris time");
  });

  test("its order against an exact time in New York follows the new rules", () => {
    // 09:10 in Paris is 07:10 UTC with summer time, and 08:10 UTC without it.
    // 03:40 in New York, on summer time under both, is 07:40 UTC.
    loadFixture("summer-time.json");
    const paris = exact(PARIS, "2026-06-03", "09:10");
    const newYork = exact(NEW_YORK, "2026-06-03", "03:40");
    assert.equal(compare(paris, newYork), -1);

    loadFixture("no-summer-time.json");
    assert.equal(compare(paris, newYork), 1);
  });

  test("a time marked second loses its mark once its hour no longer repeats", () => {
    loadFixture("summer-time.json");
    const stored = toText(exact(PARIS, "2026-10-25", "02:30", true));
    assert.equal(stored, "2026-10-25T02:30+01:00[Europe/Paris]");

    loadFixture("no-summer-time.json");
    assert.deepEqual(ok(parse(stored)), exact(PARIS, "2026-10-25", "02:30"));
  });

  test("a stored time that the new rules skip is read, not refused", () => {
    loadFixture("no-summer-time.json");
    const stored = toText(exact(PARIS, "2026-03-29", "02:30"));
    loadFixture("summer-time.json");
    assert.equal(ok(parse(stored)).date, "2026-03-29");
  });
});
