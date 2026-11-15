// POSIX TZ strings, read from the rules file (spec §3.4, §4.2), including the extensions zic writes.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePosix, posixOffsetAt } from "../src/posix.ts";

const utc = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min) / 1000;
const offset = (rule: string, moment: number) => posixOffsetAt(parsePosix(rule)!, moment);

test("a zone with no summer time", () => {
  assert.equal(offset("JST-9", utc(2026, 6, 3)), 9 * 3600);
  assert.equal(offset("<+0530>-5:30", utc(2026, 6, 3)), 5.5 * 3600);
  assert.equal(offset("<-03>3", utc(2026, 6, 3)), -3 * 3600);
});

test("Paris: the last Sundays of March and October, at 01:00 UTC", () => {
  const paris = "CET-1CEST,M3.5.0,M10.5.0/3";
  assert.equal(offset(paris, utc(2026, 3, 29, 0, 59)), 3600);
  assert.equal(offset(paris, utc(2026, 3, 29, 1, 0)), 7200);
  assert.equal(offset(paris, utc(2026, 10, 25, 0, 59)), 7200);
  assert.equal(offset(paris, utc(2026, 10, 25, 1, 0)), 3600);
});

test("the southern hemisphere: summer time across the new year", () => {
  const sydney = "AEST-10AEDT,M10.1.0,M4.1.0/3";
  assert.equal(offset(sydney, utc(2026, 1, 15)), 11 * 3600);
  assert.equal(offset(sydney, utc(2026, 6, 15)), 10 * 3600);
  assert.equal(offset(sydney, utc(2026, 12, 15)), 11 * 3600);
});

test("a half-hour change: Lord Howe Island", () => {
  const lordHowe = "<+1030>-10:30<+11>-11,M10.1.0,M4.1.0";
  assert.equal(offset(lordHowe, utc(2026, 1, 15)), 11 * 3600);
  assert.equal(offset(lordHowe, utc(2026, 6, 15)), 10.5 * 3600);
});

test("a transition time beyond 24 hours: Israel, the Friday before the last Sunday of March", () => {
  // M3.4.4/26 is 02:00 on the day after the fourth Thursday of March.
  const israel = "IST-2IDT,M3.4.4/26,M10.5.0";
  assert.equal(offset(israel, utc(2026, 3, 26, 23, 59)), 2 * 3600);
  assert.equal(offset(israel, utc(2026, 3, 27, 0, 0)), 3 * 3600);
});

test("a negative transition time: Greenland's -1:00", () => {
  const nuuk = "<-02>2<-01>,M3.5.0/-1,M10.5.0/0";
  assert.equal(offset(nuuk, utc(2026, 3, 29, 0, 59)), -2 * 3600);
  assert.equal(offset(nuuk, utc(2026, 3, 29, 1, 0)), -3600);
});

test("summer time all year", () => {
  const allYear = "EST5EDT,0/0,J365/25";
  for (const moment of [utc(2026, 1, 1, 5), utc(2026, 1, 1, 12), utc(2026, 6, 3), utc(2026, 12, 31, 23)]) {
    assert.equal(offset(allYear, moment), -4 * 3600);
  }
});

test("a Julian day never counts 29 February, and a zero-based day does", () => {
  const julian = "AAA0BBB,J60/0,J300/0";
  assert.equal(offset(julian, utc(2028, 2, 29, 12)), 0);
  assert.equal(offset(julian, utc(2028, 3, 1, 12)), 3600);
  const zeroBased = "AAA0BBB,59/0,300/0";
  assert.equal(offset(zeroBased, utc(2028, 2, 29, 12)), 3600);
});

test("text that is not a POSIX TZ string is refused", () => {
  for (const text of ["", "CET", "CET-1CEST", "CET-1CEST,M3.5.0", "CET-1CEST,M13.5.0,M10.5.0", "CET-25", "C-1", "CET-1 "]) {
    assert.equal(parsePosix(text), undefined, text);
  }
});
