// The screens' pure parts (docs/spec/web/screens.md §4.9): the home page's day, the default style,
// writing dates, finding a country at positions inside, outside and near the border of a sample of
// countries, and that no HTML in a page's text is drawn (WEB:SCREENS-NR4).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, test } from "node:test";
import { countryAt, type Borders } from "../../src/screens/country.ts";
import { dayOf, dayWords, localToday, utcNow } from "../../src/screens/day.ts";
import { toHtml } from "../../src/screens/markdown.ts";
import { deviceStyle } from "../../src/screens/style.ts";
import { dateWords, datesWords } from "../../src/screens/words.ts";

const mapFile = readFileSync(new URL("../../src/screens/borders.json", import.meta.url));
const borders = JSON.parse(mapFile.toString("utf8")) as Borders;

describe("the home page's day (WEB:SCREENS-F2)", () => {
  const mine = { first: "2026-12-06", last: "2026-12-13" };
  test("on 3 December, 3 days are left", () => assert.equal(dayWords(dayOf("2026-12-03", mine)), "3 days to go"));
  test("the day before, 1 day is left", () => assert.equal(dayWords(dayOf("2026-12-05", mine)), "1 day to go"));
  test("on 9 December, it is day 4 of 8", () => assert.equal(dayWords(dayOf("2026-12-09", mine)), "Day 4 of 8"));
  test("on the first and the last day", () => {
    assert.equal(dayWords(dayOf("2026-12-06", mine)), "Day 1 of 8");
    assert.equal(dayWords(dayOf("2026-12-13", mine)), "Day 8 of 8");
  });
  test("on 14 December, the trip is over", () => assert.equal(dayWords(dayOf("2026-12-14", mine)), "Your trip is over"));
  test("across a month and a year", () => assert.deepEqual(dayOf("2027-01-02", { first: "2026-12-30", last: "2027-01-05" }), { kind: "during", day: 4, of: 7 }));
  test("today is the device's own date, and now is read in UTC", () => {
    const at = new Date(2026, 11, 9, 23, 30);
    assert.equal(localToday(at), "2026-12-09");
    const now = utcNow(new Date(Date.UTC(2026, 11, 9, 2, 5)));
    assert.deepEqual(now, { kind: "exact", zone: "Etc/UTC", date: "2026-12-09", at: { time: "02:05" } });
  });
});

describe("the default style follows the device's language (WEB:SCREENS-F7)", () => {
  test("English in Britain: a 24-hour clock, the day first", () => assert.deepEqual(deviceStyle("en-GB"), { clock: "24h", dateOrder: "day-first" }));
  test("English in the United States: a 12-hour clock, the month first", () => assert.deepEqual(deviceStyle("en-US"), { clock: "12h", dateOrder: "month-first" }));
  test("German: a 24-hour clock, the day first", () => assert.deepEqual(deviceStyle("de-DE"), { clock: "24h", dateOrder: "day-first" }));
});

describe("a date with no zone, in the traveller's order", () => {
  const dayFirst = { clock: "24h", dateOrder: "day-first" } as const;
  const monthFirst = { clock: "12h", dateOrder: "month-first" } as const;
  test("one date", () => {
    assert.equal(dateWords("2026-12-09", dayFirst, { weekday: true }), "Wed 9 Dec");
    assert.equal(dateWords("2026-12-09", monthFirst, { year: true }), "Dec 9, 2026");
  });
  test("a trip's dates", () => {
    assert.equal(datesWords({ first: "2026-12-01", last: "2026-12-20" }, dayFirst), "1 – 20 Dec 2026");
    assert.equal(datesWords({ first: "2026-12-01", last: "2026-12-20" }, monthFirst), "Dec 1 – 20, 2026");
    assert.equal(datesWords({ first: "2026-12-28", last: "2027-01-03" }, dayFirst), "28 Dec 2026 – 3 Jan 2027");
  });
});

describe("finding the country a position is in (WEB-F6)", () => {
  const places: [string, number, number, string | undefined][] = [
    ["Santiago", -70.65, -33.45, "CL"],
    ["Puerto Natales", -72.51, -51.73, "CL"],
    ["Mendoza", -68.84, -32.89, "AR"],
    ["Bariloche", -71.31, -41.13, "AR"],
    ["Madrid", -3.7, 40.42, "ES"],
    ["Lisbon, whose centre the map's coarse coast puts at sea", -9.14, 38.72, "PT"],
    ["Monaco, on the coast", 7.42, 43.74, "MC"],
    ["Strasbourg, on the Rhine", 7.75, 48.58, "FR"],
    ["Kehl, across the Rhine", 7.82, 48.57, "DE"],
    ["Geneva, near the French border", 6.14, 46.2, "CH"],
    ["Tokyo", 139.69, 35.69, "JP"],
    ["Honolulu, on an island", -157.86, 21.31, "US"],
    ["Vatican City, an enclave inside Italy, within its outline as the map draws it", 12.435, 41.905, "VA"],
    ["Rome, around it", 12.5, 41.89, "IT"],
    ["the Pacific, at sea", -120, -30, undefined],
    ["the Atlantic, at sea", -30, 30, undefined],
  ];
  for (const [place, lon, lat, code] of places) {
    test(`${place} is in ${code ?? "no country"}`, () => assert.equal(countryAt(borders, lon, lat), code));
  }

  test("the map holds every country, and is at most 500 kilobytes as sent (WEB:SCREENS-NFR2)", () => {
    assert.ok(Object.keys(borders).length > 230);
    assert.ok(gzipSync(mapFile).length <= 500_000, `${gzipSync(mapFile).length} bytes`);
  });
});

describe("no HTML in a page's text is drawn as HTML (WEB:SCREENS-NR4)", () => {
  const hostile = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    '<iframe src="https://example.com"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
    "[click](javascript:alert(1))",
    "[click](data:text/html,<script>alert(1)</script>)",
    '<div onclick="alert(1)">hi</div>',
    "<svg onload=alert(1)>",
    "<style>body{display:none}</style>",
    '<form action="https://evil.example"><input></form>',
  ];
  for (const text of hostile) {
    test(`not drawn: ${text}`, () => {
      const html = toHtml(text);
      assert.ok(!/<(script|img|iframe|div|svg|style|form|input)\b/i.test(html), html);
      assert.ok(!/javascript:|data:text/i.test(html.replace(/&[a-z]+;/g, "")) || !/href="(javascript|data)/i.test(html), html);
      assert.ok(!/href="(javascript|data):/i.test(html), html);
    });
  }

  test("a table, a link to a page, and a link to a website are drawn", () => {
    const html = toHtml("| A | B |\n|---|---|\n| 1 | 2 |\n\n[Santiago](#page:santiago) and [Bus-Sur](https://bus-sur.cl)");
    assert.match(html, /<table>/);
    assert.match(html, /href="#page:santiago"/);
    assert.match(html, /href="https:\/\/bus-sur.cl"/);
  });
});
