// Every check in the verification of each requirement trip-time claims (spec §4.12, §7).
// SHR:TRIP-TIME-F2 is proven in rule-change.test.ts, and SHR:TRIP-TIME-NFR2 in
// independence.test.ts, since each needs a run of its own.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  compare,
  create,
  duration,
  format,
  parse,
  relativeTo,
  sort,
  span,
  toText,
  type TripTime,
} from "../src/index.ts";
import {
  NEW_YORK,
  PARIS,
  TOKYO,
  approx,
  exact,
  loadNewestRules,
  ok,
  part,
  refusal,
  tbd,
  wholeDate,
  windowOf,
} from "./helpers.ts";

before(() => {
  loadNewestRules();
});

describe("SHR:TRIP-TIME-F1 — every value is held in the local time of its place, to the minute", () => {
  const kinds = (zone: string): TripTime[] => [
    { kind: "exact", zone, date: "2026-06-03", at: { time: "09:10" } },
    { kind: "date", zone, date: "2026-06-03" },
    { kind: "tbd", zone, date: "2026-06-03" },
    { kind: "part", zone, date: "2026-06-03", part: "afternoon" },
    { kind: "approx", zone, date: "2026-06-03", at: { time: "14:00" } },
    { kind: "window", zone, date: "2026-06-03", from: { time: "14:00" }, endDate: "2026-06-03", to: { time: "16:00" } },
  ];

  for (const zone of [PARIS, NEW_YORK, TOKYO]) {
    test(`each of the six kinds reads back unchanged, ${zone}`, () => {
      for (const fields of kinds(zone)) {
        const value = ok(create(fields));
        assert.deepEqual(value, fields);
        assert.deepEqual(ok(parse(toText(value))), fields);
      }
    });

    test(`each of the six kinds is refused with an unknown zone, ${zone}`, () => {
      for (const fields of kinds(zone)) {
        const refused = refusal(create({ ...fields, zone: "Mars/Olympus_Mons" }));
        assert.equal(refused.code, "unknown-zone");
        assert.match(refused.message, /Mars\/Olympus_Mons/);
      }
    });
  }
});

describe("SHR:TRIP-TIME-F3 — a local time that never happens is refused, with the nearest valid times", () => {
  test("02:30 on 29 March 2026, Paris time, is refused with the reason", () => {
    const refused = refusal(create({ kind: "exact", zone: PARIS, date: "2026-03-29", at: { time: "02:30" } }));
    assert.equal(refused.code, "skipped-time");
    assert.match(refused.message, /never happens/);
  });

  test("the refusal gives 01:59 and 03:00", () => {
    const refused = refusal(create({ kind: "exact", zone: PARIS, date: "2026-03-29", at: { time: "02:30" } }));
    assert.equal(refused.details?.before, "01:59");
    assert.equal(refused.details?.after, "03:00");
  });

  test("01:59 and 03:00 are both accepted", () => {
    exact(PARIS, "2026-03-29", "01:59");
    exact(PARIS, "2026-03-29", "03:00");
  });

  test("a part of a day and a whole date that hold the skipped hour are accepted", () => {
    part(PARIS, "2026-03-28", "night");
    wholeDate(PARIS, "2026-03-29");
  });
});

describe("SHR:TRIP-TIME-F4 — a local time that happens twice means its first occurrence, unless marked", () => {
  const date = "2026-10-25";

  test("02:30 sorts before 02:15 marked as the second occurrence", () => {
    assert.equal(compare(exact(PARIS, date, "02:30"), exact(PARIS, date, "02:15", true)), -1);
  });

  test("02:30 marked as the second occurrence sorts after the 02:15", () => {
    assert.equal(compare(exact(PARIS, date, "02:30", true), exact(PARIS, date, "02:15", true)), 1);
  });

  test("02:30 on any other date cannot be marked as a second occurrence", () => {
    for (const other of ["2026-10-24", "2026-10-26", "2026-06-03"]) {
      const refused = refusal(create({ kind: "exact", zone: PARIS, date: other, at: { time: "02:30", second: true } }));
      assert.equal(refused.code, "not-repeated");
    }
  });
});

describe("SHR:TRIP-TIME-F5 — a span gives the time that passes between its start and its end", () => {
  const minutes = (start: TripTime, end: TripTime) => duration(ok(span(start, end)));

  test("leaving Paris at 10:00 and landing in New York at 12:30, 3 June 2026: 8 hours 30 minutes", () => {
    assert.deepEqual(minutes(exact(PARIS, "2026-06-03", "10:00"), exact(NEW_YORK, "2026-06-03", "12:30")), {
      shortest: 510,
      longest: 510,
    });
  });

  test("leaving at 01:00 and arriving at 04:00, Paris time, 29 March 2026: 2 hours", () => {
    assert.deepEqual(minutes(exact(PARIS, "2026-03-29", "01:00"), exact(PARIS, "2026-03-29", "04:00")), {
      shortest: 120,
      longest: 120,
    });
  });

  test("leaving in the morning and arriving around 15:00, Paris time, 3 June 2026: 3 to 9 hours", () => {
    assert.deepEqual(minutes(part(PARIS, "2026-06-03", "morning"), approx(PARIS, "2026-06-03", "15:00")), {
      shortest: 180,
      longest: 540,
    });
  });

  test("leaving between 14:00 and 16:00 and arriving at 18:00, Paris time, 3 June 2026: 2 to 4 hours", () => {
    assert.deepEqual(minutes(windowOf(PARIS, "2026-06-03", "14:00", "16:00"), exact(PARIS, "2026-06-03", "18:00")), {
      shortest: 120,
      longest: 240,
    });
  });
});

describe("SHR:TRIP-TIME-F6 — a span that certainly ends before it starts is refused", () => {
  test("leaving Paris at 10:00 and landing in New York at 03:00, 3 June 2026: refused, with the reason", () => {
    const refused = refusal(span(exact(PARIS, "2026-06-03", "10:00"), exact(NEW_YORK, "2026-06-03", "03:00")));
    assert.equal(refused.code, "span-order");
    assert.match(refused.message, /ends before it starts/);
  });

  test("leaving in the morning and arriving around 11:00, Paris time, 3 June 2026: accepted", () => {
    ok(span(part(PARIS, "2026-06-03", "morning"), approx(PARIS, "2026-06-03", "11:00")));
  });

  test("leaving and arriving at 10:00, Paris time, 3 June 2026: accepted", () => {
    ok(span(exact(PARIS, "2026-06-03", "10:00"), exact(PARIS, "2026-06-03", "10:00")));
  });
});

describe("SHR:TRIP-TIME-F7 — values in any mix of time zones sort into one order", () => {
  test("08:00 on 3 June 2026, Paris time, and 09:00 the same day, Tokyo time: Tokyo first", () => {
    const paris = exact(PARIS, "2026-06-03", "08:00");
    const tokyo = exact(TOKYO, "2026-06-03", "09:00");
    assert.deepEqual(sort([paris, tokyo]), [tokyo, paris]);
  });

  test("an exact time of 12:00 and the afternoon of the same date, Paris time: the exact time first", () => {
    const noon = exact(PARIS, "2026-06-03", "12:00");
    const afternoon = part(PARIS, "2026-06-03", "afternoon");
    assert.deepEqual(sort([afternoon, noon]), [noon, afternoon]);
  });

  test("the whole date, an exact time of 00:00 on it, and a date with time to be decided: in that order", () => {
    const date = wholeDate(PARIS, "2026-06-03");
    const midnight = exact(PARIS, "2026-06-03", "00:00");
    const later = tbd(PARIS, "2026-06-03");
    assert.deepEqual(sort([later, midnight, date]), [date, midnight, later]);
    assert.deepEqual(sort([midnight, later, date]), [date, midnight, later]);
  });

  test("the night of 3 June and an exact time of 02:00 on 4 June 2026, Paris time: the night first", () => {
    const night = part(PARIS, "2026-06-03", "night");
    const two = exact(PARIS, "2026-06-04", "02:00");
    assert.deepEqual(sort([two, night]), [night, two]);
  });

  test("two windows that start at the same moment, given in each order: in the order given", () => {
    const a = windowOf(PARIS, "2026-06-03", "14:00", "16:00");
    const b = windowOf(PARIS, "2026-06-03", "14:00", "18:00");
    assert.deepEqual(sort([a, b]), [a, b]);
    assert.deepEqual(sort([b, a]), [b, a]);
  });
});

describe("SHR:TRIP-TIME-F8 — every value is written as text in one form, with its time zone", () => {
  const dayFirst24 = { clock: "24h", dateOrder: "day-first" } as const;
  const all = (): TripTime[] => [
    exact(PARIS, "2026-06-03", "14:30"),
    wholeDate(PARIS, "2026-06-03"),
    tbd(PARIS, "2026-06-03"),
    part(PARIS, "2026-06-03", "afternoon"),
    approx(PARIS, "2026-06-03", "14:00"),
    windowOf(PARIS, "2026-06-03", "14:00", "16:00"),
  ];

  test("each kind is written in one form, which names the value's time zone", () => {
    const texts = all().map((v) => format(v, dayFirst24));
    assert.deepEqual(texts, [
      "Wed 3 June 2026, 14:30, Paris time",
      "Wed 3 June 2026, Paris time",
      "Wed 3 June 2026, time to be decided, Paris time",
      "Wed 3 June 2026, afternoon, Paris time",
      "Wed 3 June 2026, around 14:00, Paris time",
      "Wed 3 June 2026, 14:00–16:00, Paris time",
    ]);
    assert.equal(new Set(texts).size, texts.length);
  });

  test("an exact time reads 14:30 with the 24-hour clock, and 2:30 pm with the 12-hour clock", () => {
    const value = exact(PARIS, "2026-06-03", "14:30");
    assert.match(format(value, dayFirst24), /, 14:30,/);
    assert.match(format(value, { clock: "12h", dateOrder: "day-first" }), /, 2:30 pm,/);
  });

  test("a date reads 3 June 2026 with the day first, and June 3, 2026 with the month first", () => {
    const value = wholeDate(PARIS, "2026-06-03");
    assert.equal(format(value, dayFirst24), "Wed 3 June 2026, Paris time");
    assert.equal(format(value, { clock: "24h", dateOrder: "month-first" }), "Wed June 3, 2026, Paris time");
  });

  test("the same value gives the same text every time it is written", () => {
    for (const value of all()) {
      const first = format(value, dayFirst24);
      for (let i = 0; i < 3; i++) assert.equal(format(value, dayFirst24), first);
      assert.equal(format(ok(parse(toText(value))), dayFirst24), first);
    }
  });
});

describe("SHR:TRIP-TIME-F9 — trip-time says how a value relates to now, in the value's own time zone", () => {
  // 23:00 on 2 June 2026, Paris time, is 21:00 UTC.
  const now = Date.UTC(2026, 5, 2, 21, 0);

  test("an exact time of 02:00 on 3 June, Paris time, is in 3 hours", () => {
    assert.equal(relativeTo(exact(PARIS, "2026-06-03", "02:00"), now), "in 3 hours");
  });

  test("the whole date 4 June, Paris time, is in 2 days", () => {
    assert.equal(relativeTo(wholeDate(PARIS, "2026-06-04"), now), "in 2 days");
  });

  test("the whole date 3 June, Tokyo time, is today", () => {
    assert.equal(relativeTo(wholeDate(TOKYO, "2026-06-03"), now), "today");
  });

  test("the whole date 1 June, Paris time, is yesterday", () => {
    assert.equal(relativeTo(wholeDate(PARIS, "2026-06-01"), now), "yesterday");
  });
});
