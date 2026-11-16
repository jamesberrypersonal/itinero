// The checks of the bookings list that need bookings of several kinds together: the order of a
// trip's bookings (BKG:LIST-F4), the text form of every kind (BKG:LIST-F7), and the speed of order
// and notOver (BKG:LIST-NFR2) (spec/bookings/list.md §4.6).

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { before, describe, test } from "node:test";
import { apply, bookingFromText, bookingToText, check, notOver, order, type Booking } from "../src/index.ts";
import {
  MADRID,
  NEW_YORK,
  PARIS,
  PUNTA_ARENAS,
  SANTIAGO,
  activity,
  airport,
  approx,
  busToNatales,
  date,
  december,
  exact,
  flight,
  journey,
  la800,
  ladyFlorence,
  leg,
  loadFixture,
  loadNewestRules,
  ok,
  stay,
  torresDelPaine,
  window,
} from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const held = (booking: Booking) => ok(apply(undefined, { op: "add", booking }))!;
const ids = (bookings: readonly Booking[]) => bookings.map((b) => b.id);

/** The bookings of BKG:LIST-F4's verification. */
const f4 = () =>
  [
    stay("stay", "Hotel Cumbres", exact(SANTIAGO, december(1), "15:00"), date(SANTIAGO, december(4))),
    flight("flight", [leg("IB 6833", airport("MAD"), exact(MADRID, december(1), "10:00"), airport("SCL"), exact(SANTIAGO, december(1), "19:30"))]),
    activity("wine", "tour", "Wine tour in the Maipo valley", date(SANTIAGO, december(2))),
    activity("hill", "ticket", "Cerro San Cristóbal funicular", date(SANTIAGO, december(2))),
  ].map(held);

/** A small generator with a seed, so that each run shuffles the same way. */
function shuffler(seed: number) {
  let state = seed;
  const next = () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 2 ** 32;
  return <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };
}

describe("BKG:LIST-F4 — a trip's bookings ordered by when each starts, whatever their time zones", () => {
  test("the flight leaving Madrid at 10:00, the stay checking in at 15:00 in Santiago, then the two activities by title", () => {
    assert.deepEqual(ids(order(f4())), ["flight", "stay", "hill", "wine"]);
  });

  test("the set given in reverse comes in the same order", () => {
    assert.deepEqual(ids(order([...f4()].reverse())), ["flight", "stay", "hill", "wine"]);
  });

  test("a booking on a date with no time comes first on its date", () => {
    const early = held(activity("early", "tour", "Andes at dawn", exact(SANTIAGO, december(2), "00:00")));
    assert.deepEqual(ids(order([early, ...f4()])), ["flight", "stay", "hill", "wine", "early"]);
  });

  test("bookings starting together and with the same label come by identifier", () => {
    const twins = ["b", "c", "a"].map((id) => held(torresDelPaine(id)));
    assert.deepEqual(ids(order(twins)), ["a", "b", "c"]);
  });

  test("labels are compared by code point, whatever the device's language", () => {
    const named = ["Zoo", "Émile", "apple", "Äpfel", "🏔 Peak", "Bus"].map((title, i) =>
      held(activity(`a${i}`, "other", title, date(SANTIAGO, december(5)))),
    );
    assert.deepEqual(order(named).map((b) => (b as { title: string }).title), ["Bus", "Zoo", "apple", "Äpfel", "Émile", "🏔 Peak"]);
  });

  test("the same bookings of every kind, given in 200 orders, always come in one order", () => {
    const all = [...f4(), held(la800()), held(ladyFlorence()), held(busToNatales()), held(torresDelPaine()), ...["x", "y"].map((id) => held(torresDelPaine(id)))];
    const shuffle = shuffler(2026);
    const first = ids(order(all));
    for (let i = 0; i < 200; i++) assert.deepEqual(ids(order(shuffle(all))), first);
  });

  test("order gives a new frozen list, and leaves the one given alone", () => {
    const given = f4().reverse();
    const before_ = ids(given);
    const ordered = order(given);
    assert.ok(Object.isFrozen(ordered));
    assert.deepEqual(ids(given), before_);
  });
});

describe("BKG:LIST-F7 — a booking of each kind, as text and back", () => {
  /**
   * A booking of each kind, holding every field, on `on`, at times from 01:00 to 05:00 in Paris. A
   * window from 02:00 to 03:00 is left out: trip-time's parse refuses it once 02:00 to 03:00 is
   * skipped, since both its ends then mean one moment.
   */
  const everyKind = (on: string) =>
    [
      flight("f", [leg("AF 6", airport("CDG", "Paris"), exact(PARIS, on, "02:30"), airport("JFK", "New York"), exact(NEW_YORK, on, "05:00"))], {
        seats: [{ traveller: "acct-1", leg: 0, seat: "23A" }],
      }),
      stay("s", "Hôtel du Nord", window(PARIS, on, "01:00", "02:30"), approx(PARIS, "2026-12-31", "11:00"), { address: "102 quai de Jemmapes" }),
      journey("j", "train", "Lyon", "Paris", exact(PARIS, on, "02:30"), { arrives: exact(PARIS, on, "04:30"), operator: "SNCF", service: "TGV 6611", seat: "coach 12, seat 45" }),
      activity("a", "table", "Dinner", approx(PARIS, on, "02:30"), { where: "Paris", ends: exact(PARIS, on, "05:00") }),
    ].map((b) => held({ ...b, travellers: ["acct-1", "acct-2"], details: { reference: "R", provider: "P", link: "https://example.com/", notes: "N", page: "p" } }));

  test("a booking of each kind, holding every field, reads back equal to itself", () => {
    for (const b of everyKind(december(5))) assert.deepEqual(ok(bookingFromText(bookingToText(b))), b, b.kind);
  });

  test("a booking of each kind, written under one copy of the rules, reads back unchanged under later rules", () => {
    // 02:30 on 29 March is a time in Paris under the first copy, and is skipped under the later one.
    try {
      loadFixture("no-summer-time.json");
      const written = everyKind("2026-03-29");
      const texts = written.map(bookingToText);
      loadFixture("summer-time.json");
      for (const [i, text] of texts.entries()) assert.deepEqual(ok(bookingFromText(text)), written[i], written[i]!.kind);
    } finally {
      loadNewestRules();
    }
  });

  test("the same booking of each kind always gives the same text", () => {
    const [a, b] = [everyKind(december(5)), everyKind(december(5))];
    for (const [i, booking] of a.entries()) assert.equal(bookingToText(booking), bookingToText(b[i]!), booking.kind);
  });

  test("check accepts each kind", () => {
    for (const b of everyKind(december(5))) assert.ok(check(b).ok, b.kind);
  });
});

describe("BKG:LIST-NFR2 — order 1,000 bookings, and find those not yet over, quickly", () => {
  const thousand = () => {
    const shuffle = shuffler(7);
    const kinds = [
      (i: number) => la800(`f${i}`, { legs: [{ ...la800().legs[0]!, leaves: exact(SANTIAGO, december(1 + (i % 28)), "07:05"), arrives: exact(PUNTA_ARENAS, december(1 + (i % 28)), "10:30") }] }),
      (i: number) => ladyFlorence(`s${i}`, { checkIn: date(PUNTA_ARENAS, december(1 + (i % 20))), checkOut: approx(PUNTA_ARENAS, december(2 + (i % 20) + (i % 5)), "11:00") }),
      (i: number) => busToNatales(`j${i}`, { leaves: exact(PUNTA_ARENAS, december(1 + (i % 28)), "13:00"), arrives: exact(PUNTA_ARENAS, december(1 + (i % 28)), "16:00") }),
      (i: number) => torresDelPaine(`a${i}`, { title: `Tour ${i % 37}`, starts: window(PUNTA_ARENAS, december(1 + (i % 30)), "07:30", "08:30"), ends: date(PUNTA_ARENAS, december(1 + (i % 30))) }),
    ];
    return shuffle(Array.from({ length: 1000 }, (_, i) => held(kinds[i % 4]!(i))));
  };

  const timed = <T>(run: () => T): [T, number] => {
    const start = performance.now();
    const result = run();
    return [result, performance.now() - start];
  };

  test("ordering 1,000 bookings of every kind takes under 50 milliseconds", () => {
    const bookings = thousand();
    const [ordered, took] = timed(() => order(bookings));
    assert.equal(ordered.length, 1000);
    assert.ok(took < 50, `order took ${took.toFixed(1)} ms`);
  });

  test("finding the bookings not yet over among them takes under 50 milliseconds", () => {
    const bookings = thousand();
    const now = exact(PUNTA_ARENAS, december(15), "12:00");
    const [left, took] = timed(() => notOver(bookings, now));
    assert.ok(left.length > 0 && left.length < 1000);
    assert.ok(took < 50, `notOver took ${took.toFixed(1)} ms`);
  });
});
