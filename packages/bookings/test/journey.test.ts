// The journey booking: every check in the verification of each requirement it claims, and each of
// its refusals (spec/bookings/journey.md §3.3, §4, §7). Then the checks of the bookings list that
// need a journey (spec/bookings/list.md §4.6).

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { formatDuration } from "@itinero/trip-time";
import {
  apply,
  bookingFromText,
  bookingToText,
  checkJourney,
  extent,
  journeyDuration,
  journeyLabel,
  journeyTimes,
  label,
  notOver,
  onDate,
  type Booking,
  type Change,
  type JourneyBooking,
} from "../src/index.ts";
import {
  MENDOZA,
  PUNTA_ARENAS,
  SANTIAGO,
  approx,
  busToNatales,
  date,
  december,
  exact,
  journey,
  la800,
  ladyFlorence,
  loadNewestRules,
  ok,
  refusal,
  window,
} from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const add = (booking: Booking): Change => ({ op: "add", booking });
const added = (booking: Booking) => ok(apply(undefined, add(booking))) as JourneyBooking;
const code = (booking: JourneyBooking) => refusal(apply(undefined, add(booking))).code;

const ferry = () => journey("ferry", "ferry", "Puerto Montt", "Puerto Natales", date(SANTIAGO, december(14)));
const hiredCar = () =>
  journey("car", "car", "Santiago", "Mendoza", exact(SANTIAGO, december(20), "10:00"), { arrives: exact(MENDOZA, december(27), "18:00") });
const train = (leaves: string, arrives: string, extra: Partial<JourneyBooking> = {}) =>
  journey("train", "train", "Lyon", "Paris", exact("Europe/Paris", december(5), leaves), { arrives: exact("Europe/Paris", december(5), arrives), ...extra });

describe("BKG:JOURNEY-F1 — by train, bus, ferry or hired car, from one place to another", () => {
  test("a bus from Punta Arenas to Puerto Natales, 13:00 to 16:00 on 9 December, is held as given", () => {
    assert.deepEqual(added(busToNatales()), { ...busToNatales(), revision: 1 });
  });

  test("a ferry leaving on 14 December with no time and no arrival is accepted", () => {
    const held = added(ferry());
    assert.equal(held.leaves.kind, "date");
    assert.ok(!("arrives" in held));
  });

  test("a hired car collected in Santiago at 10:00 on 20 December and returned in Mendoza at 18:00 on 27 December is held as given", () => {
    assert.deepEqual(added(hiredCar()), { ...hiredCar(), revision: 1 });
  });

  test("a journey by plane is refused, because a flight is a booking of its own kind", () => {
    const refused = refusal(apply(undefined, add(busToNatales("j", { by: "plane" as never }))));
    assert.equal(refused.code, "unknown-way");
    assert.match(refused.message, /flight is a booking of its own kind/);
  });
});

describe("BKG:JOURNEY-F2 — a journey arriving before it leaves is refused, and one that arrives says how long it takes", () => {
  test("the bus of BKG:JOURNEY-F1 takes 3 hours", () => {
    assert.deepEqual(journeyDuration(added(busToNatales())), { shortest: 180, longest: 180 });
  });

  test("a train leaving at 10:00 and arriving at 09:00 the same day is refused, with the reason", () => {
    const refused = refusal(apply(undefined, add(train("10:00", "09:00"))));
    assert.equal(refused.code, "travel-order");
    assert.match(refused.message, /arrives before it leaves/);
  });

  test("a train leaving between 10:00 and 11:00 and arriving at 14:00 takes 3 to 4 hours", () => {
    const between = added(train("10:00", "14:00", { leaves: window("Europe/Paris", december(5), "10:00", "11:00") }));
    const took = journeyDuration(between)!;
    assert.deepEqual(took, { shortest: 180, longest: 240 });
    assert.equal(formatDuration(took), "3–4 h");
  });

  test("a train leaving at around 10:00 and arriving at 14:00 takes 4 hours, since an approximate time counts as its stated time", () => {
    const around = added(train("10:00", "14:00", { leaves: approx("Europe/Paris", december(5), "10:00") }));
    assert.deepEqual(journeyDuration(around), { shortest: 240, longest: 240 });
  });

  test("a journey of 366 days is accepted, and one a minute longer refused", () => {
    const year = (at: string) => busToNatales("j", { arrives: exact(PUNTA_ARENAS, "2027-12-10", at) });
    assert.ok(apply(undefined, add(year("13:00"))).ok);
    const refused = refusal(apply(undefined, add(year("13:01"))));
    assert.equal(refused.code, "too-long");
    assert.match(refused.message, /366 days/);
  });

  test("a journey with no arrival has no duration", () => {
    assert.equal(journeyDuration(added(ferry())), undefined);
  });
});

describe("BKG:JOURNEY-F3 — who runs it, its service and the seat, as written on the ticket", () => {
  test("a train run by SNCF, service TGV 6611, seat coach 12, seat 45, is held as given", () => {
    const held = added(train("10:00", "12:00", { operator: "SNCF", service: "TGV 6611", seat: "coach 12, seat 45" }));
    assert.deepEqual([held.operator, held.service, held.seat], ["SNCF", "TGV 6611", "coach 12, seat 45"]);
  });

  test("a journey with none of the three is accepted", () => {
    const held = added(train("10:00", "12:00"));
    assert.ok(!("operator" in held) && !("service" in held) && !("seat" in held));
  });
});

describe("the refusals of a journey", () => {
  test("bad-text, for each text field and its limit", () => {
    const at = (extra: Partial<JourneyBooking>) => code(busToNatales("j", extra));
    for (const key of ["from", "to", "operator", "service", "seat"] as const) assert.equal(at({ [key]: " " }), "bad-text", key);
    for (const key of ["from", "to", "operator"] as const) {
      assert.equal(at({ [key]: "x".repeat(201) }), "bad-text", key);
      assert.ok(checkJourney(busToNatales("j", { [key]: "x".repeat(200) })).ok, key);
    }
    for (const key of ["service", "seat"] as const) {
      assert.equal(at({ [key]: "x".repeat(65) }), "bad-text", key);
      assert.ok(checkJourney(busToNatales("j", { [key]: "x".repeat(64) })).ok, key);
    }
    const trimmed = added(busToNatales("j", { from: " Punta Arenas ", operator: " Bus-Sur " }));
    assert.deepEqual([trimmed.from, trimmed.operator], ["Punta Arenas", "Bus-Sur"]);
  });

  test("a refusal of trip-time's create is passed on", () => {
    assert.equal(code(busToNatales("j", { leaves: { kind: "exact", zone: PUNTA_ARENAS, date: december(9), at: { time: "25:00" } } })), "invalid-time");
    assert.equal(code(busToNatales("j", { arrives: { kind: "date", zone: "Mars/Olympus", date: december(9) } })), "unknown-zone");
  });

  test("checkJourney checks only the journey's own fields, and refuses a booking that is not a journey", () => {
    assert.ok(checkJourney(busToNatales("not an id", { travellers: [] })).ok);
    assert.equal(refusal(checkJourney(la800() as unknown as JourneyBooking)).code, "malformed");
  });
});

describe("journeyTimes and journeyLabel", () => {
  test("a journey starts when it leaves, and ends when it arrives, or has no end", () => {
    const bus = added(busToNatales());
    assert.deepEqual(journeyTimes(bus), { starts: bus.leaves, ends: bus.arrives });
    assert.deepEqual(journeyTimes(added(ferry())), { starts: ferry().leaves });
  });

  test("the label gives the way, then where from and where to", () => {
    assert.equal(journeyLabel(train("10:00", "12:00")), "Train from Lyon to Paris");
    assert.equal(label(added(busToNatales())), "Bus from Punta Arenas to Puerto Natales");
    assert.equal(journeyLabel(ferry()), "Ferry from Puerto Montt to Puerto Natales");
    assert.equal(journeyLabel(hiredCar()), "Hired car from Santiago to Mendoza");
  });
});

// The checks of the bookings list that need a journey.

describe("BKG:LIST-F5 — the dates each booking covers, those on a date, and those not yet over (with a stay and a bus)", () => {
  const stay = () => added(ladyFlorence("stay", { checkOut: exact(PUNTA_ARENAS, december(12), "11:00") }));
  const bus = () =>
    added(
      journey("bus", "bus", "Punta Arenas", "Puerto Natales", exact(PUNTA_ARENAS, december(12), "22:00"), {
        arrives: exact(PUNTA_ARENAS, december(13), "06:00"),
      }),
    );

  test("the stay covers 9 to 12 December, and the bus 12 to 13 December", () => {
    assert.deepEqual([extent(stay()).first, extent(stay()).last], [december(9), december(12)]);
    assert.deepEqual([extent(bus()).first, extent(bus()).last], [december(12), december(13)]);
  });

  test("the bookings on 12 December are the stay, then the bus", () => {
    assert.deepEqual(onDate([bus(), stay()], december(12)).map((b) => b.id), ["stay", "bus"]);
  });

  test("at 23:00 on 12 December, the bookings not yet over are the bus alone", () => {
    assert.deepEqual(notOver([stay(), bus()], exact(PUNTA_ARENAS, december(12), "23:00")).map((b) => b.id), ["bus"]);
    assert.deepEqual(notOver([stay(), bus()], exact(PUNTA_ARENAS, december(12), "10:59")).map((b) => b.id), ["stay", "bus"]);
  });

  test("a booking with no end is over once its start has", () => {
    const held = added(ferry());
    assert.deepEqual(notOver([held], exact(SANTIAGO, december(14), "23:59")), [held]);
    assert.deepEqual(notOver([held], exact(SANTIAGO, december(15), "00:00")), [held], "not yet certainly over at midnight");
    assert.deepEqual(notOver([held], exact(SANTIAGO, december(15), "00:01")), []);
  });
});

describe("BKG:LIST-F7 — a booking as text and back (with a journey)", () => {
  test("a journey with every field, and one with no arrival, read back equal to themselves", () => {
    const full = added(busToNatales("j", { operator: "Bus-Sur", service: "1300", seat: "12, 13", details: { reference: "BS-99" } }));
    for (const j of [full, added(ferry()), added(hiredCar())]) assert.deepEqual(ok(bookingFromText(bookingToText(j))), j);
  });

  test("a journey's own fields are written as spec/bookings/journey.md §5 gives them", () => {
    const text = bookingToText(added(busToNatales("j", { operator: "Bus-Sur" })));
    assert.match(
      text,
      /^\{"arrives":"2026-12-09T16:00\[America\/Punta_Arenas\]","by":"bus",.*"from":"Punta Arenas",.*"kind":"journey","leaves":"2026-12-09T13:00\[America\/Punta_Arenas\]","operator":"Bus-Sur",.*"to":"Puerto Natales",/,
    );
  });
});
