// Each refusal of spec §3.3 but no-rules, which no-rules.test.ts proves before any rules load.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { create, loadRules, parse, rulesVersion, span, type TripTime } from "../src/index.ts";
import { PARIS, exact, loadNewestRules, refusal } from "./helpers.ts";

let version = "";
before(() => {
  version = loadNewestRules();
});

const code = (fields: unknown) => refusal(create(fields as TripTime)).code;
const parsed = (text: string) => refusal(parse(text)).code;

describe("malformed", () => {
  test("create refuses fields not in the form of §3.3", () => {
    assert.equal(code(null), "malformed");
    assert.equal(code({ kind: "soon", zone: PARIS, date: "2026-06-03" }), "malformed");
    assert.equal(code({ kind: "date", zone: PARIS }), "malformed");
    assert.equal(code({ kind: "date", zone: PARIS, date: "2026-06-03", at: { time: "09:10" } }), "malformed");
    assert.equal(code({ kind: "date", zone: "", date: "2026-06-03" }), "malformed");
    assert.equal(code({ kind: "date", zone: PARIS, date: "3 June 2026" }), "malformed");
    assert.equal(code({ kind: "exact", zone: PARIS, date: "2026-06-03", at: "09:10" }), "malformed");
    assert.equal(code({ kind: "exact", zone: PARIS, date: "2026-06-03", at: { time: "9:10" } }), "malformed");
    assert.equal(code({ kind: "exact", zone: PARIS, date: "2026-06-03", at: { time: "09:10", second: false } }), "malformed");
    assert.equal(code({ kind: "exact", zone: PARIS, date: "2026-06-03", at: { time: "09:10", offset: 3600 } }), "malformed");
    assert.equal(code({ kind: "part", zone: PARIS, date: "2026-06-03", part: "lunchtime" }), "malformed");
    assert.equal(
      code({ kind: "window", zone: PARIS, date: "2026-06-03", from: { time: "14:00" }, to: { time: "16:00" } }),
      "malformed",
    );
  });

  test("parse refuses text not in the form of §4.1", () => {
    for (const text of [
      "",
      "2026-06-03",
      "2026-06-03[]",
      "2026-06-03 [Europe/Paris]",
      "2026-06-03T09:10Z[Europe/Paris]",
      "2026-06-03/soon[Europe/Paris]",
      "2026-06-03~[Europe/Paris]",
      "2026-06-03T14:00–16:00[Europe/Paris]",
      "03/06/2026[Europe/Paris]",
      "2026-06-03T9:10[Europe/Paris]",
    ]) {
      assert.equal(parsed(text), "malformed", text);
    }
  });
});

describe("out-of-range", () => {
  test("a date before 1970-01-01 or after 9999-12-31", () => {
    assert.equal(code({ kind: "date", zone: PARIS, date: "1969-12-31" }), "out-of-range");
    assert.equal(parsed("1969-12-31[Europe/Paris]"), "out-of-range");
    assert.equal(code({ kind: "date", zone: PARIS, date: "0000-01-01" }), "out-of-range");
  });

  test("the first and the last date are accepted", () => {
    assert.ok(create({ kind: "date", zone: PARIS, date: "1970-01-01" }).ok);
    assert.ok(create({ kind: "date", zone: PARIS, date: "9999-12-31" }).ok);
  });
});

describe("invalid-date", () => {
  test("a date that does not exist", () => {
    for (const date of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-06-00", "2100-02-29"]) {
      assert.equal(code({ kind: "date", zone: PARIS, date }), "invalid-date", date);
    }
    assert.equal(parsed("2026-02-30[Europe/Paris]"), "invalid-date");
    assert.ok(create({ kind: "date", zone: PARIS, date: "2028-02-29" }).ok);
    assert.ok(create({ kind: "date", zone: PARIS, date: "2000-02-29" }).ok);
  });

  test("a window's end date is checked too", () => {
    const fields = { kind: "window", zone: PARIS, date: "2026-06-03", from: { time: "14:00" }, endDate: "2026-06-31", to: { time: "16:00" } };
    assert.equal(code(fields), "invalid-date");
  });
});

describe("invalid-time", () => {
  test("a clock time outside 00:00 to 23:59, or one holding seconds", () => {
    for (const time of ["24:00", "23:60", "99:99", "09:10:00", "09:10:30.5"]) {
      assert.equal(code({ kind: "exact", zone: PARIS, date: "2026-06-03", at: { time } }), "invalid-time", time);
    }
    assert.equal(parsed("2026-06-03T24:00[Europe/Paris]"), "invalid-time");
    assert.equal(parsed("2026-06-03T09:10:30[Europe/Paris]"), "invalid-time");
    assert.equal(parsed("2026-06-03T14:00/24:00[Europe/Paris]"), "invalid-time");
  });
});

describe("unknown-zone", () => {
  test("a zone the rules file names neither as a zone nor as an alias", () => {
    assert.equal(code({ kind: "date", zone: "Europe/Atlantis", date: "2026-06-03" }), "unknown-zone");
    assert.equal(code({ kind: "date", zone: "europe/paris", date: "2026-06-03" }), "unknown-zone");
    assert.equal(parsed("2026-06-03[Europe/Atlantis]"), "unknown-zone");
  });

  test("an alias is accepted, and kept as the caller gave it", () => {
    const value = create({ kind: "date", zone: "Asia/Calcutta", date: "2026-06-03" });
    assert.ok(value.ok);
    assert.equal(value.value.zone, "Asia/Calcutta");
  });
});

describe("skipped-time", () => {
  test("every clock time in a value is checked, a window's two ends included", () => {
    const at = (time: string) => ({ time });
    assert.equal(code({ kind: "approx", zone: PARIS, date: "2026-03-29", at: at("02:00") }), "skipped-time");
    assert.equal(
      code({ kind: "window", zone: PARIS, date: "2026-03-29", from: at("01:30"), endDate: "2026-03-29", to: at("02:59") }),
      "skipped-time",
    );
    assert.equal(
      code({ kind: "window", zone: PARIS, date: "2026-03-29", from: at("02:00"), endDate: "2026-03-29", to: at("04:00") }),
      "skipped-time",
    );
  });

  test("the details give the dates of the nearest valid times, for a gap at midnight", () => {
    // Cuba's clocks go forward at 00:00, from 00:00 to 01:00, on 8 March 2026.
    const refused = refusal(create({ kind: "exact", zone: "America/Havana", date: "2026-03-08", at: { time: "00:30" } }));
    assert.equal(refused.code, "skipped-time");
    assert.deepEqual(refused.details, { before: "23:59", after: "01:00", beforeDate: "2026-03-07", afterDate: "2026-03-08" });
  });
});

describe("not-repeated", () => {
  test("a clock time marked second that does not happen twice on its date", () => {
    const fields = { kind: "approx", zone: PARIS, date: "2026-10-25", at: { time: "03:00", second: true } };
    assert.equal(code(fields), "not-repeated");
    const early = { kind: "exact", zone: PARIS, date: "2026-10-25", at: { time: "01:59", second: true } };
    assert.equal(code(early), "not-repeated");
  });
});

describe("window-order", () => {
  test("a window whose end is not after its start, from create only", () => {
    const window = (from: string, to: string, endDate = "2026-06-03") => ({
      kind: "window",
      zone: PARIS,
      date: "2026-06-03",
      from: { time: from },
      endDate,
      to: { time: to },
    });
    assert.equal(code(window("16:00", "14:00")), "window-order");
    assert.equal(code(window("14:00", "14:00")), "window-order");
    assert.equal(code(window("14:00", "16:00", "2026-06-02")), "window-order");
    // parse reads stored text, which later rules can put out of order (spec §4.4).
    assert.ok(parse("2026-06-03T16:00/14:00[Europe/Paris]").ok);
    assert.ok(create(window("23:00", "01:00", "2026-06-04") as TripTime).ok);
  });

  test("the repeated hour is ordered by moment, not by clock time", () => {
    // 02:50, then 02:10 the second time round: the end's moment is after the start's.
    const fields: TripTime = {
      kind: "window",
      zone: PARIS,
      date: "2026-10-25",
      from: { time: "02:50" },
      endDate: "2026-10-25",
      to: { time: "02:10", second: true },
    };
    assert.ok(create(fields).ok);
  });
});

describe("span-order", () => {
  test("a span whose end's latest moment is before its start's earliest", () => {
    const refused = refusal(span(exact(PARIS, "2026-06-03", "10:00"), exact(PARIS, "2026-06-03", "09:59")));
    assert.equal(refused.code, "span-order");
  });
});

describe("bad-rules", () => {
  test("a rules file not in the form of §5.1 is refused, and the rules loaded before are kept", () => {
    const zone = { initial: 3600, changes: [], rule: "CET-1CEST,M3.5.0,M10.5.0/3" };
    const file = (changes: object) => JSON.stringify({ format: 1, version: "x", zones: { "Europe/Paris": changes }, aliases: {} });
    for (const text of [
      "not json",
      "[]",
      JSON.stringify({ format: 2, version: "x", zones: {}, aliases: {} }),
      JSON.stringify({ format: 1, zones: {}, aliases: {} }),
      JSON.stringify({ format: 1, version: "x", aliases: {} }),
      JSON.stringify({ format: 1, version: "x", zones: {}, aliases: { "Asia/Calcutta": "Asia/Kolkata" } }),
      file({ ...zone, rule: "nonsense" }),
      file({ ...zone, rule: "CET-1CEST" }),
      file({ ...zone, initial: "3600" }),
      file({ ...zone, changes: [[10, 7200], [5, 3600]] }),
      file({ ...zone, changes: [[10]] }),
      file({ ...zone, changes: [[10, 7200.5]] }),
    ]) {
      const refused = refusal(loadRules(text));
      assert.equal(refused.code, "bad-rules", text);
      assert.match(refused.message, /^The rules file was refused, because .+\.$/);
      assert.equal(rulesVersion(), version);
    }
  });
});
