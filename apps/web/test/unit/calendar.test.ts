// The calendar's order of firm items and bookings (docs/spec/web/screens.md §4.4, §4.9): a day's
// firm items with no time first, then every other firm item and every booking in the order they
// happen, and a booking on every date it covers (WEB:SCREENS-F3, PLN-F5).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { Booking } from "@itinero/bookings";
import type { FirmItem, Trip } from "@itinero/itinerary";
import { loadRules } from "@itinero/trip-time";
import { calendarDays, calendarRange, type Fixed } from "../../src/screens/calendar-days.ts";

assert.ok(loadRules(readFileSync(new URL(import.meta.resolve("@itinero/trip-time/rules/2026f.json")), "utf8")).ok);

const SANTIAGO = "America/Santiago";
const exact = (date: string, time: string, zone = SANTIAGO) => ({ kind: "exact" as const, zone, date, at: { time } });

const firm = (id: string, when: FirmItem["when"]): FirmItem => ({ id, revision: 1, title: id, when });

const trip = (fields: Partial<Trip>): Trip => ({ format: 1, id: "t", name: "Chile", revision: 1, travellers: [], stretches: [], firm: [], ...fields });

const names = (fixed: readonly Fixed[]) => fixed.map((f) => (f.kind === "firm" ? f.item.id : f.booking.id));

const tour = (id: string, date: string, time: string, zone = SANTIAGO): Booking =>
  ({ id, revision: 1, travellers: ["a"], details: {}, kind: "activity", sort: "tour", title: id, starts: exact(date, time, zone) }) as unknown as Booking;

const stay: Booking = {
  id: "stay",
  revision: 1,
  travellers: ["a"],
  details: {},
  kind: "stay",
  name: "Hotel",
  checkIn: { kind: "date", zone: SANTIAGO, date: "2026-12-02" },
  checkOut: { kind: "date", zone: SANTIAGO, date: "2026-12-04" },
} as unknown as Booking;

describe("a day's firm items and bookings, in one order (WEB:SCREENS-F3)", () => {
  const t = trip({
    dates: { first: "2026-12-01", last: "2026-12-05" },
    stretches: [
      { id: "chile", place: { country: "CL" }, first: "2026-12-01", last: "2026-12-05" },
      { id: "santiago", place: { country: "CL", name: "Santiago" }, first: "2026-12-01", last: "2026-12-03", page: "santiago" },
    ],
    firm: [firm("dinner", exact("2026-12-02", "20:00")), firm("market", { kind: "day", date: "2026-12-02" }), firm("museum", exact("2026-12-02", "10:00"))],
  });
  const days = calendarDays(t, t.dates, [tour("tour", "2026-12-02", "15:00"), tour("early", "2026-12-02", "08:00"), stay]);

  test("lists each day of the trip's dates", () => assert.deepEqual(days.map((d) => d.date), ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"]));

  test("gives each day its countries and the stretches covering it", () => {
    assert.deepEqual(days[1]!.countries, ["CL"]);
    assert.deepEqual(days[1]!.stretches.map((s) => s.id), ["santiago", "chile"]);
    assert.deepEqual(days[3]!.stretches.map((s) => s.id), ["chile"]);
  });

  test("puts the firm items with no time first, then the rest by when they happen", () => {
    assert.deepEqual(names(days[1]!.fixed), ["market", "stay", "early", "museum", "tour", "dinner"]);
  });

  test("shows a booking on every date it covers", () => {
    assert.deepEqual(days.map((d) => names(d.fixed).includes("stay")), [false, true, true, true, false]);
  });

  test("orders times in different zones by the moment they happen", () => {
    const one = trip({ dates: { first: "2026-12-02", last: "2026-12-02" }, firm: [firm("lisbon", exact("2026-12-02", "13:00", "Europe/Lisbon"))] });
    // 09:30 in Santiago is 12:30 in Lisbon, so it comes first.
    const [day] = calendarDays(one, one.dates, [tour("santiago", "2026-12-02", "09:30")]);
    assert.deepEqual(names(day!.fixed), ["santiago", "lisbon"]);
  });
});

describe("the calendar's range", () => {
  test("is the trip's dates where it has them", () => assert.deepEqual(calendarRange(trip({}), { first: "2026-12-01", last: "2026-12-03" }), { first: "2026-12-01", last: "2026-12-03" }));
  test("is the itinerary's extent where it has none", () => {
    const t = trip({ stretches: [{ id: "s", place: { country: "CL" }, first: "2026-12-04", last: "2026-12-06" }] });
    assert.deepEqual(calendarRange(t, undefined), { first: "2026-12-04", last: "2026-12-06" });
  });
  test("is nothing where the trip has neither", () => assert.deepEqual(calendarDays(trip({}), undefined, []), []));
});
