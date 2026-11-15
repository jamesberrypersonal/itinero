// parse(toText(v)) equals v, for every kind, with and without marks (spec §4.1, §4.12).

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { create, parse, toText, type TripTime } from "../src/index.ts";
import { loadNewestRules, ok } from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const zones = ["Europe/Paris", "America/New_York", "Asia/Tokyo", "Australia/Lord_Howe", "Asia/Kolkata", "Asia/Calcutta", "Etc/UTC"];
const dates = ["1970-01-01", "2026-03-29", "2026-06-03", "2026-10-25", "2026-12-31", "9999-12-31"];
const times = ["00:00", "01:59", "02:15", "02:30", "03:00", "09:10", "12:00", "23:59"];

function* values(): Generator<TripTime> {
  for (const zone of zones) {
    for (const date of dates) {
      yield { kind: "date", zone, date };
      yield { kind: "tbd", zone, date };
      for (const part of ["morning", "afternoon", "evening", "night"] as const) yield { kind: "part", zone, date, part };
      for (const time of times) {
        for (const second of [false, true]) {
          const at = second ? { time, second: true as const } : { time };
          yield { kind: "exact", zone, date, at };
          yield { kind: "approx", zone, date, at };
          yield { kind: "window", zone, date, from: at, endDate: date, to: { time: "23:59" } };
          if (date !== "9999-12-31") {
            const next = date === "2026-12-31" ? "2027-01-01" : date.slice(0, 8) + String(Number(date.slice(8)) + 1).padStart(2, "0");
            yield { kind: "window", zone, date, from: { time: "23:00" }, endDate: next, to: at };
          }
        }
      }
    }
  }
}

test("every value create accepts reads back from its text unchanged", () => {
  let checked = 0;
  let marked = 0;
  for (const fields of values()) {
    const made = create(fields);
    if (!made.ok) continue;
    const text = toText(made.value);
    assert.deepEqual(ok(parse(text)), made.value, text);
    assert.equal(toText(ok(parse(text))), text);
    checked++;
    if (text.includes("+") || /\d-\d\d:\d\d\[/.test(text)) marked++;
  }
  assert.ok(checked > 1000, `checked ${checked}`);
  assert.ok(marked > 0, "some values carried a mark");
});

test("a value is frozen, down to its clock times", () => {
  const value = ok(create({ kind: "window", zone: "Europe/Paris", date: "2026-06-03", from: { time: "14:00" }, endDate: "2026-06-03", to: { time: "16:00" } }));
  assert.ok(Object.isFrozen(value));
  assert.ok(value.kind === "window" && Object.isFrozen(value.from) && Object.isFrozen(value.to));
});

test("create leaves its argument as it was", () => {
  const fields = { kind: "exact" as const, zone: "Europe/Paris", date: "2026-06-03", at: { time: "09:10" } };
  const made = ok(create(fields));
  assert.notEqual(made, fields);
  assert.ok(!Object.isFrozen(fields) && !Object.isFrozen(fields.at));
});
