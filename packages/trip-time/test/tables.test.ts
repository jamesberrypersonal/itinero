// Each row of every table in spec §4.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  compare,
  create,
  duration,
  format,
  formatDuration,
  parse,
  relativeTo,
  sort,
  span,
  toText,
  type TextStyle,
  type TripTime,
} from "../src/index.ts";
import { coverOf } from "../src/order.ts";
import { NEW_YORK, PARIS, TOKYO, approx, exact, loadNewestRules, ok, part, tbd, wholeDate, windowOf } from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const utc = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min) / 1000;

describe("§4.1 the text form", () => {
  const rows: [string, () => TripTime][] = [
    ["2026-06-03T09:10[Europe/Paris]", () => exact(PARIS, "2026-06-03", "09:10")],
    ["2026-06-03[Asia/Tokyo]", () => wholeDate(TOKYO, "2026-06-03")],
    ["2026-06-03/tbd[Europe/Paris]", () => tbd(PARIS, "2026-06-03")],
    ["2026-06-03/afternoon[Europe/Paris]", () => part(PARIS, "2026-06-03", "afternoon")],
    ["2026-06-03~14:00[Europe/Paris]", () => approx(PARIS, "2026-06-03", "14:00")],
    ["2026-06-03T14:00/16:00[Europe/Paris]", () => windowOf(PARIS, "2026-06-03", "14:00", "16:00")],
    ["2026-06-03T23:00/2026-06-04T01:00[Europe/Paris]", () => windowOf(PARIS, "2026-06-03", "23:00", "01:00", "2026-06-04")],
    ["2026-10-25T02:30+01:00[Europe/Paris]", () => exact(PARIS, "2026-10-25", "02:30", true)],
  ];
  for (const [text, value] of rows) {
    test(text, () => {
      assert.equal(toText(value()), text);
      assert.deepEqual(ok(parse(text)), value());
    });
  }

  test("only a time marked second carries an offset", () => {
    assert.equal(toText(exact(PARIS, "2026-10-25", "02:30")), "2026-10-25T02:30[Europe/Paris]");
  });

  test("parse resolves a skipped time with the offset before the gap, and does not refuse it", () => {
    const value = ok(parse("2026-03-29T02:30[Europe/Paris]"));
    assert.deepEqual(value, { kind: "exact", zone: PARIS, date: "2026-03-29", at: { time: "02:30" } });
    assert.equal(coverOf(value).earliest, utc(2026, 3, 29, 1, 30));
  });

  test("parse drops a mark whose offset no longer matches a second occurrence", () => {
    // +02:00 is the offset of the first 02:30, not the second.
    assert.deepEqual(ok(parse("2026-10-25T02:30+02:00[Europe/Paris]")), exact(PARIS, "2026-10-25", "02:30"));
    // 3 June has no repeated hour at all.
    assert.deepEqual(ok(parse("2026-06-03T09:10+01:00[Europe/Paris]")), exact(PARIS, "2026-06-03", "09:10"));
  });

  test("an alias stays an alias", () => {
    assert.equal(toText(ok(create({ kind: "date", zone: "Asia/Calcutta", date: "2026-06-03" }))), "2026-06-03[Asia/Calcutta]");
  });
});

describe("§4.2 from a local time to a moment", () => {
  test("one candidate: an ordinary time", () => {
    assert.equal(coverOf(exact(PARIS, "2026-06-03", "09:10")).earliest, utc(2026, 6, 3, 7, 10));
    assert.equal(coverOf(exact(NEW_YORK, "2026-01-15", "09:10")).earliest, utc(2026, 1, 15, 14, 10));
  });

  test("no candidate: a gap, the local count less the offset before the gap", () => {
    assert.equal(coverOf(ok(parse("2026-03-29T02:00[Europe/Paris]"))).earliest, utc(2026, 3, 29, 1, 0));
  });

  test("two candidates: the earlier, or the later for a time marked second", () => {
    assert.equal(coverOf(exact(PARIS, "2026-10-25", "02:30")).earliest, utc(2026, 10, 25, 0, 30));
    assert.equal(coverOf(exact(PARIS, "2026-10-25", "02:30", true)).earliest, utc(2026, 10, 25, 1, 30));
  });

  test("a date before any change in 1970 uses the zone's initial offset", () => {
    assert.equal(coverOf(exact(TOKYO, "1970-01-01", "00:00")).earliest, utc(1969, 12, 31, 15, 0));
  });

  test("an offset that is not a whole number of minutes: Liberia until 1972", () => {
    // Monrovia's clocks were 44 minutes 30 seconds behind UTC.
    assert.equal(coverOf(exact("Africa/Monrovia", "1971-06-01", "12:00")).earliest, utc(1971, 6, 1, 12, 44) + 30);
  });
});

describe("§4.5 the moments a value covers", () => {
  const cover = (v: TripTime) => {
    const { earliest, latest } = coverOf(v);
    return [earliest, latest];
  };
  test("exact", () => assert.deepEqual(cover(exact(PARIS, "2026-06-03", "09:10")), [utc(2026, 6, 3, 7, 10), utc(2026, 6, 3, 7, 10)]));
  test("approx", () => assert.deepEqual(cover(approx(PARIS, "2026-06-03", "14:00")), [utc(2026, 6, 3, 12), utc(2026, 6, 3, 12)]));
  test("window", () => assert.deepEqual(cover(windowOf(PARIS, "2026-06-03", "14:00", "16:00")), [utc(2026, 6, 3, 12), utc(2026, 6, 3, 14)]));
  test("part: morning, afternoon, evening and night", () => {
    assert.deepEqual(cover(part(PARIS, "2026-06-03", "morning")), [utc(2026, 6, 3, 4), utc(2026, 6, 3, 10)]);
    assert.deepEqual(cover(part(PARIS, "2026-06-03", "afternoon")), [utc(2026, 6, 3, 10), utc(2026, 6, 3, 16)]);
    assert.deepEqual(cover(part(PARIS, "2026-06-03", "evening")), [utc(2026, 6, 3, 16), utc(2026, 6, 3, 20)]);
    assert.deepEqual(cover(part(PARIS, "2026-06-03", "night")), [utc(2026, 6, 3, 20), utc(2026, 6, 4, 4)]);
  });
  test("date and tbd", () => {
    const day = [utc(2026, 6, 2, 22), utc(2026, 6, 3, 22)];
    assert.deepEqual(cover(wholeDate(PARIS, "2026-06-03")), day);
    assert.deepEqual(cover(tbd(PARIS, "2026-06-03")), day);
  });
  test("a date whose 00:00 falls in a gap starts at the first moment after the gap", () => {
    // Havana, 8 March 2026: the clocks go from 00:00 to 01:00, at 05:00 UTC.
    assert.equal(coverOf(wholeDate("America/Havana", "2026-03-08")).earliest, utc(2026, 3, 8, 5));
  });
  test("a part of a day holding a clock change covers the time that really passes", () => {
    // The night of 28 March 2026, Paris time, loses an hour: 22:00 CET to 06:00 CEST is 7 hours.
    const [from, to] = cover(part(PARIS, "2026-03-28", "night"));
    assert.equal(to! - from!, 7 * 3600);
  });
});

describe("§4.6 compare and sort", () => {
  const date = "2026-06-03";
  test("date sorts at the start of its date, rank 0, ahead of everything on it", () => {
    assert.equal(compare(wholeDate(PARIS, date), exact(PARIS, date, "00:00")), -1);
  });
  test("exact sorts at its moment, rank 1, ahead of an imprecise value at the same moment", () => {
    assert.equal(compare(exact(PARIS, date, "14:00"), approx(PARIS, date, "14:00")), -1);
    assert.equal(compare(exact(PARIS, date, "14:00"), windowOf(PARIS, date, "14:00", "15:00")), -1);
  });
  test("approx, window and part share rank 2, and tie at the same moment", () => {
    assert.equal(compare(approx(PARIS, date, "12:00"), part(PARIS, date, "afternoon")), 0);
    assert.equal(compare(windowOf(PARIS, date, "12:00", "13:00"), part(PARIS, date, "afternoon")), 0);
  });
  test("tbd sorts at the start of the next date, rank -1, after everything on its own date", () => {
    assert.equal(compare(tbd(PARIS, date), exact(PARIS, date, "23:59")), 1);
    assert.equal(compare(tbd(PARIS, date), part(PARIS, date, "night")), 1);
    assert.equal(compare(tbd(PARIS, date), wholeDate(PARIS, "2026-06-04")), -1);
  });
  test("sort returns a new array, and leaves its argument as it was", () => {
    const values = [exact(PARIS, date, "10:00"), exact(PARIS, date, "09:00")];
    const copy = [...values];
    const sorted = sort(values);
    assert.notEqual(sorted, values);
    assert.deepEqual(values, copy);
    assert.deepEqual(sorted, [copy[1], copy[0]]);
  });
});

describe("§4.7 span and duration", () => {
  test("shortest is never less than zero", () => {
    const value = duration(ok(span(part(PARIS, "2026-06-03", "morning"), approx(PARIS, "2026-06-03", "11:00"))));
    assert.deepEqual(value, { shortest: 0, longest: 300 });
  });
  test("across a clock change, the time that really passes", () => {
    const value = duration(ok(span(exact(PARIS, "2026-10-25", "01:00"), exact(PARIS, "2026-10-25", "04:00"))));
    assert.deepEqual(value, { shortest: 240, longest: 240 });
  });
  test("a span is frozen, and holds the values it was given", () => {
    const start = exact(PARIS, "2026-06-03", "10:00");
    const end = exact(NEW_YORK, "2026-06-03", "12:30");
    const made = ok(span(start, end));
    assert.ok(Object.isFrozen(made));
    assert.equal(made.start, start);
    assert.equal(made.end, end);
  });
});

describe("§4.8 format and formatDuration", () => {
  const style: TextStyle = { clock: "24h", dateOrder: "day-first" };
  const rows: [string, () => TripTime][] = [
    ["Wed 3 June 2026, 09:10, Paris time", () => exact(PARIS, "2026-06-03", "09:10")],
    ["Wed 3 June 2026, Paris time", () => wholeDate(PARIS, "2026-06-03")],
    ["Wed 3 June 2026, time to be decided, Paris time", () => tbd(PARIS, "2026-06-03")],
    ["Wed 3 June 2026, afternoon, Paris time", () => part(PARIS, "2026-06-03", "afternoon")],
    ["Wed 3 June 2026, around 14:00, Paris time", () => approx(PARIS, "2026-06-03", "14:00")],
    ["Wed 3 June 2026, 14:00–16:00, Paris time", () => windowOf(PARIS, "2026-06-03", "14:00", "16:00")],
    ["Wed 3 June 2026, 23:00 – Thu 4 June, 01:00, Paris time", () => windowOf(PARIS, "2026-06-03", "23:00", "01:00", "2026-06-04")],
    ["Sun 25 October 2026, 02:30 (second time), Paris time", () => exact(PARIS, "2026-10-25", "02:30", true)],
  ];
  for (const [text, value] of rows) test(text, () => assert.equal(format(value(), style), text));

  test("a window's end date keeps its year when it differs from the start's", () => {
    assert.equal(
      format(windowOf(PARIS, "2026-12-31", "23:00", "01:00", "2027-01-01"), style),
      "Thu 31 December 2026, 23:00 – Fri 1 January 2027, 01:00, Paris time",
    );
  });

  test("the 12-hour clock: no leading zero, midnight 12:00 am and noon 12:00 pm", () => {
    const twelve: TextStyle = { clock: "12h", dateOrder: "day-first" };
    assert.equal(format(exact(PARIS, "2026-06-03", "09:10"), twelve), "Wed 3 June 2026, 9:10 am, Paris time");
    assert.equal(format(exact(PARIS, "2026-06-03", "14:00"), twelve), "Wed 3 June 2026, 2:00 pm, Paris time");
    assert.equal(format(exact(PARIS, "2026-06-03", "00:00"), twelve), "Wed 3 June 2026, 12:00 am, Paris time");
    assert.equal(format(exact(PARIS, "2026-06-03", "12:00"), twelve), "Wed 3 June 2026, 12:00 pm, Paris time");
  });

  test("month first", () => {
    const monthFirst: TextStyle = { clock: "24h", dateOrder: "month-first" };
    assert.equal(format(exact(PARIS, "2026-06-03", "09:10"), monthFirst), "Wed June 3, 2026, 09:10, Paris time");
    assert.equal(
      format(windowOf(PARIS, "2026-06-03", "23:00", "01:00", "2026-06-04"), monthFirst),
      "Wed June 3, 2026, 23:00 – Thu June 4, 01:00, Paris time",
    );
  });

  test("the zone's name", () => {
    const named = (zone: string) => format(ok(create({ kind: "date", zone, date: "2026-06-03" })), style);
    assert.equal(named("America/New_York"), "Wed 3 June 2026, New York time");
    assert.equal(named("America/Argentina/Buenos_Aires"), "Wed 3 June 2026, Buenos Aires time");
    assert.equal(named("Etc/UTC"), "Wed 3 June 2026, UTC");
    assert.equal(named("UTC"), "Wed 3 June 2026, UTC");
    assert.equal(named("Etc/GMT-2"), "Wed 3 June 2026, UTC+2");
    assert.equal(named("Etc/GMT+5"), "Wed 3 June 2026, UTC-5");
  });

  test("formatDuration", () => {
    assert.equal(formatDuration({ shortest: 40, longest: 40 }), "40 min");
    assert.equal(formatDuration({ shortest: 510, longest: 510 }), "8 h 30 min");
    assert.equal(formatDuration({ shortest: 1440, longest: 1440 }), "1 day");
    assert.equal(formatDuration({ shortest: 3120, longest: 3120 }), "2 days 4 h");
    assert.equal(formatDuration({ shortest: 0, longest: 0 }), "0 min");
    assert.equal(formatDuration({ shortest: 180, longest: 540 }), "3–9 h");
    assert.equal(formatDuration({ shortest: 150, longest: 240 }), "2 h 30 min – 4 h");
    assert.equal(formatDuration({ shortest: 1380, longest: 1500 }), "23 h – 1 day 1 h");
  });
});

describe("§4.9 relativeTo", () => {
  const now = Date.UTC(2026, 5, 3, 10, 0); // 12:00 on 3 June 2026, Paris time
  const at = (time: string, date = "2026-06-03") => exact(PARIS, date, time);
  test("by time", () => {
    assert.equal(relativeTo(at("12:00"), now + 29_999), "now");
    assert.equal(relativeTo(at("12:40"), now), "in 40 minutes");
    assert.equal(relativeTo(at("11:40"), now), "20 minutes ago");
    assert.equal(relativeTo(at("12:01"), now), "in 1 minute");
    assert.equal(relativeTo(at("13:00"), now), "in 1 hour");
    assert.equal(relativeTo(at("14:40"), now), "in 2 hours 40 minutes");
    assert.equal(relativeTo(at("09:00"), now), "3 hours ago");
    assert.equal(relativeTo(at("23:59"), now), "in 11 hours 59 minutes");
  });
  test("an approximate time adds about, and a window counts from its start", () => {
    assert.equal(relativeTo(approx(PARIS, "2026-06-03", "15:00"), now), "in about 3 hours");
    assert.equal(relativeTo(approx(PARIS, "2026-06-03", "09:00"), now), "about 3 hours ago");
    assert.equal(relativeTo(windowOf(PARIS, "2026-06-03", "14:00", "16:00"), now), "in 2 hours");
  });
  test("now is rounded down to whole seconds", () => {
    assert.equal(relativeTo(at("12:01"), now + 30_999), "in 1 minute");
  });
  test("12 hours or more away, by date", () => {
    assert.equal(relativeTo(at("00:00", "2026-06-04"), now), "tomorrow");
    assert.equal(relativeTo(at("00:00"), now), "today");
    assert.equal(relativeTo(at("23:00", "2026-06-02"), now), "yesterday");
    assert.equal(relativeTo(at("12:00", "2026-06-10"), now), "in 7 days");
  });
  test("by date", () => {
    assert.equal(relativeTo(wholeDate(PARIS, "2026-06-03"), now), "today");
    assert.equal(relativeTo(tbd(PARIS, "2026-06-04"), now), "tomorrow");
    assert.equal(relativeTo(part(PARIS, "2026-06-02", "evening"), now), "yesterday");
    assert.equal(relativeTo(wholeDate(PARIS, "2026-06-06"), now), "in 3 days");
    assert.equal(relativeTo(wholeDate(PARIS, "2026-06-01"), now), "2 days ago");
  });
});
