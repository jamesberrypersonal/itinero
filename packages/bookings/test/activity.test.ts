// The activity booking: every check in the verification of each requirement it claims, and each of
// its refusals (spec/bookings/activity.md §3.3, §4, §7).

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  activityLabel,
  activityTimes,
  apply,
  bookingFromText,
  bookingToText,
  checkActivity,
  extent,
  label,
  onDate,
  type ActivityBooking,
  type Booking,
  type Change,
} from "../src/index.ts";
import {
  MADRID,
  PUNTA_ARENAS,
  SANTIAGO,
  activity,
  approx,
  date,
  december,
  exact,
  la800,
  loadNewestRules,
  ok,
  refusal,
  torresDelPaine,
  window,
} from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const add = (booking: Booking): Change => ({ op: "add", booking });
const added = (booking: Booking) => ok(apply(undefined, add(booking))) as ActivityBooking;
const code = (booking: ActivityBooking) => refusal(apply(undefined, add(booking))).code;

const dinner = () => activity("dinner", "table", "Dinner at La Mesita Grande", approx(PUNTA_ARENAS, december(11), "20:30"));
const museum = () => activity("museum", "ticket", "Museo Nacional de Bellas Artes", date(SANTIAGO, december(3)));
const trek = () => activity("trek", "tour", "W Trek", date(PUNTA_ARENAS, december(14)), { ends: date(PUNTA_ARENAS, december(16)) });

describe("BKG:ACTIVITY-F1 — a tour, a ticket, a table or something else, with a title, perhaps a place, and a start", () => {
  test("a tour titled Torres del Paine full day, from 07:30 to 19:00 on 10 December, is held as given", () => {
    assert.deepEqual(added(torresDelPaine()), { ...torresDelPaine(), revision: 1 });
    assert.equal(added(torresDelPaine("t", { where: "Puerto Natales, Plaza de Armas" })).where, "Puerto Natales, Plaza de Armas");
  });

  test("a table titled Dinner at La Mesita Grande, at around 20:30 on 11 December with no end, is accepted", () => {
    const held = added(dinner());
    assert.equal(held.starts.kind, "approx");
    assert.ok(!("ends" in held));
  });

  test("a ticket for a museum on 3 December with no time is accepted", () => {
    assert.equal(added(museum()).starts.kind, "date");
  });

  test("an activity with an empty title is refused, with the reason", () => {
    const refused = refusal(apply(undefined, add(torresDelPaine("t", { title: "  " }))));
    assert.equal(refused.code, "bad-text");
    assert.match(refused.message, /title is empty/);
  });

  test("something else, such as a guide hired for a day, is an activity", () => {
    assert.ok(apply(undefined, add(activity("guide", "other", "Guide for the day", date(PUNTA_ARENAS, december(12))))).ok);
  });
});

describe("BKG:ACTIVITY-F2 — an activity ending before it starts is refused, and one that ends covers every date to its end", () => {
  test("the tour, changed to end at 06:00 on 10 December, is refused, with the reason", () => {
    const tour = added(torresDelPaine());
    const refused = refusal(apply(tour, { op: "change", booking: torresDelPaine("tdp", { ends: exact(PUNTA_ARENAS, december(10), "06:00") }), base: 1 }));
    assert.equal(refused.code, "end-order");
    assert.match(refused.message, /ends before it starts/);
  });

  test("a three-day trek from 14 to 16 December, with no times, covers 14, 15 and 16 December", () => {
    const held = added(trek());
    assert.deepEqual([extent(held).first, extent(held).last], [december(14), december(16)]);
    for (const d of [14, 15, 16]) assert.deepEqual(onDate([held], december(d)), [held], `${d} December`);
    for (const d of [13, 17]) assert.deepEqual(onDate([held], december(d)), [], `${d} December`);
  });

  test("an activity of 366 days is accepted, and one a minute longer refused, with the reason", () => {
    const year = (at: string) => torresDelPaine("t", { ends: exact(PUNTA_ARENAS, "2027-12-11", at) });
    assert.ok(apply(undefined, add(year("07:30"))).ok);
    const refused = refusal(apply(undefined, add(year("07:31"))));
    assert.equal(refused.code, "too-long");
    assert.match(refused.message, /366 days/);
  });
});

describe("the refusals of an activity", () => {
  test("unknown-sort", () => {
    const refused = refusal(apply(undefined, add(torresDelPaine("t", { sort: "concert" as never }))));
    assert.equal(refused.code, "unknown-sort");
    assert.match(refused.message, /"concert"/);
  });

  test("bad-text, for a title or a place, and their limits", () => {
    assert.equal(code(torresDelPaine("t", { title: "x".repeat(201) })), "bad-text");
    assert.equal(code(torresDelPaine("t", { where: " " })), "bad-text");
    assert.equal(code(torresDelPaine("t", { where: "x".repeat(501) })), "bad-text");
    assert.ok(checkActivity(torresDelPaine("t", { title: "x".repeat(200), where: "x".repeat(500) })).ok);
    const trimmed = added(torresDelPaine("t", { title: " Torres ", where: " Natales " }));
    assert.deepEqual([trimmed.title, trimmed.where], ["Torres", "Natales"]);
  });

  test("a refusal of trip-time's create is passed on", () => {
    assert.equal(code(torresDelPaine("t", { starts: { kind: "date", zone: PUNTA_ARENAS, date: "2026-13-01" } })), "invalid-date");
    assert.equal(code(torresDelPaine("t", { ends: { kind: "date", zone: "Mars/Olympus", date: december(10) } })), "unknown-zone");
  });

  test("an end in another time zone than the start is accepted, such as a cruise ending in another country", () => {
    const cruise = activity("cruise", "tour", "Cruise to Ushuaia", exact(PUNTA_ARENAS, december(18), "18:00"), {
      ends: exact("America/Argentina/Ushuaia", december(22), "08:00"),
    });
    assert.ok(apply(undefined, add(cruise)).ok);
  });

  test("checkActivity checks only the activity's own fields, and refuses a booking that is not an activity", () => {
    assert.ok(checkActivity(torresDelPaine("not an id", { travellers: [] })).ok);
    assert.equal(refusal(checkActivity(la800() as unknown as ActivityBooking)).code, "malformed");
  });
});

describe("activityTimes and activityLabel", () => {
  test("an activity's times are its start and end as it holds them, and its label is its title", () => {
    const tour = added(torresDelPaine());
    assert.deepEqual(activityTimes(tour), { starts: tour.starts, ends: tour.ends });
    assert.deepEqual(activityTimes(added(dinner())), { starts: dinner().starts });
    assert.equal(activityLabel(tour), "Torres del Paine full day");
    assert.equal(label(added(dinner())), "Dinner at La Mesita Grande");
  });

  test("an activity starting in a window past midnight, with no end, covers the dates of its window", () => {
    const party = added(activity("party", "ticket", "New Year's Eve", window(MADRID, december(31), "22:00", "02:00", "2027-01-01")));
    assert.deepEqual([extent(party).first, extent(party).last], [december(31), "2027-01-01"]);
  });
});

describe("BKG:LIST-F7 — a booking as text and back (with an activity)", () => {
  test("an activity with every field, and one with no end or place, read back equal to themselves", () => {
    for (const a of [added(torresDelPaine("t", { where: "Puerto Natales, Plaza de Armas" })), added(dinner()), added(trek())]) {
      assert.deepEqual(ok(bookingFromText(bookingToText(a))), a);
    }
  });

  test("an activity's own fields are written as spec/bookings/activity.md §5 gives them", () => {
    const text = bookingToText(added(torresDelPaine("t", { where: "Puerto Natales, Plaza de Armas" })));
    assert.match(
      text,
      /^\{"details":\{\},"ends":"2026-12-10T19:00\[America\/Punta_Arenas\]",.*"kind":"activity",.*"sort":"tour","starts":"2026-12-10T07:30\[America\/Punta_Arenas\]","title":"Torres del Paine full day",.*"where":"Puerto Natales, Plaza de Armas"\}$/,
    );
  });
});
