// The flight booking: every check in the verification of each requirement it claims, and each of
// its refusals (spec/bookings/flight.md §3.3, §4, §7). Then the checks of the bookings list that a
// flight is enough for (spec/bookings/list.md §4.6).

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  apply,
  bookingFromText,
  bookingToText,
  changeFromText,
  changeToText,
  check,
  checkFlight,
  connections,
  extent,
  flightLabel,
  flightTimes,
  label,
  legDurations,
  touches,
  type Booking,
  type Change,
  type FlightBooking,
} from "../src/index.ts";
import {
  MADRID,
  NEW_YORK,
  PARIS,
  PUNTA_ARENAS,
  SANTIAGO,
  SAO_PAULO,
  airport,
  approx,
  common,
  december,
  exact,
  flight,
  la800,
  leg,
  loadFixture,
  loadNewestRules,
  ok,
  refusal,
} from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const SCL = airport("SCL", "Santiago");
const GRU = airport("GRU", "São Paulo");
const MAD = airport("MAD", "Madrid");

const add = (booking: Booking): Change => ({ op: "add", booking });
const added = (booking: Booking) => ok(apply(undefined, add(booking))) as FlightBooking;

/** Santiago to São Paulo, leaving at 08:00 and arriving at 12:00, then on to Madrid at 14:30 (BKG:FLIGHT-F3). */
const viaSaoPaulo = (extra: Partial<FlightBooking> = {}) =>
  flight(
    "via-gru",
    [
      leg("LA 8084", SCL, exact(SANTIAGO, december(1), "08:00"), GRU, exact(SAO_PAULO, december(1), "12:00")),
      leg("LA 8070", GRU, exact(SAO_PAULO, december(1), "14:30"), MAD, exact(MADRID, december(2), "05:10")),
    ],
    extra,
  );

describe("BKG:FLIGHT-F1 — a flight is one or more legs, each with its flight number, airports and local times", () => {
  test("LA 800 from SCL at 07:05 Santiago time to PUQ at 10:30 Punta Arenas time is held as given", () => {
    const held = added(la800());
    assert.deepEqual(held, { ...la800(), revision: 1 });
    assert.equal(held.legs[0]!.leaves.zone, SANTIAGO);
    assert.equal(held.legs[0]!.arrives.zone, PUNTA_ARENAS);
  });

  test("Santiago to São Paulo and São Paulo to Madrid are held with both legs, in order", () => {
    const held = added(viaSaoPaulo());
    assert.deepEqual(
      held.legs.map((l) => [l.from.code, l.to.code]),
      [["SCL", "GRU"], ["GRU", "MAD"]],
    );
  });

  test("a flight of no legs, and of nine, is refused with the reason", () => {
    const none = refusal(apply(undefined, add(flight("f", []))));
    assert.equal(none.code, "no-legs");
    assert.match(none.message, /no leg/);
    const one = la800().legs[0]!;
    const nine = refusal(apply(undefined, add(flight("f", Array.from({ length: 9 }, () => one)))));
    assert.equal(nine.code, "too-many-legs");
    assert.match(nine.message, /9 legs/);
    const daily = Array.from({ length: 8 }, (_, i) => ({ ...one, leaves: exact(SANTIAGO, december(i + 1), "07:05"), arrives: exact(PUNTA_ARENAS, december(i + 1), "10:30") }));
    assert.equal(added(flight("f", daily)).legs.length, 8);
  });

  test("a leg leaving at around 07:00 is refused, because a leg's times are exact", () => {
    const around = leg("LA 800", SCL, approx(SANTIAGO, december(6), "07:00"), airport("PUQ"), exact(PUNTA_ARENAS, december(6), "10:30"));
    const refused = refusal(apply(undefined, add(flight("f", [around]))));
    assert.equal(refused.code, "exact-only");
    assert.equal(refused.details?.leg, "0");
  });

  test("the flight number LATAM is refused, with the reason", () => {
    const latam = { ...la800().legs[0]!, flight: "LATAM" };
    const refused = refusal(apply(undefined, add(flight("f", [latam]))));
    assert.equal(refused.code, "bad-flight");
    assert.match(refused.message, /"LATAM"/);
  });
});

describe("BKG:FLIGHT-F2 — a leg arriving before it leaves, or leaving before the leg before arrives, is refused", () => {
  const overnight = (arrives: string) =>
    flight("ib", [leg("IB 6830", SCL, exact(SANTIAGO, december(1), "23:40"), MAD, exact(MADRID, arrives, "16:35"))]);

  test("leaving Santiago at 23:40 on 1 December and arriving in Madrid at 16:35 on 2 December is accepted", () => {
    assert.ok(apply(undefined, add(overnight(december(2)))).ok);
  });

  test("arriving in Madrid at 16:35 on 1 December is refused, naming the leg", () => {
    const refused = refusal(apply(undefined, add(overnight(december(1)))));
    assert.equal(refused.code, "travel-order");
    assert.equal(refused.details?.leg, "0");
    assert.match(refused.message, /Leg 1 arrives before it leaves/);
  });

  test("a second leg leaving São Paulo before the first arrives there is refused, naming the second leg", () => {
    const early = viaSaoPaulo();
    const legs = [early.legs[0]!, { ...early.legs[1]!, leaves: exact(SAO_PAULO, december(1), "11:30") }];
    const refused = refusal(apply(undefined, add({ ...early, legs })));
    assert.equal(refused.code, "leg-order");
    assert.equal(refused.details?.leg, "1");
    assert.match(refused.message, /Leg 2 leaves before leg 1 arrives/);
  });

  test("a leg arriving at the very moment it leaves is accepted", () => {
    const instant = leg("LA 1", SCL, exact(SANTIAGO, december(1), "10:00"), SCL, exact(SANTIAGO, december(1), "10:00"));
    assert.ok(apply(undefined, add(flight("f", [instant]))).ok);
  });
});

describe("BKG:FLIGHT-F3 — how long each leg takes, and each connection", () => {
  test("Santiago 08:00 to São Paulo 12:00 takes 4 hours, and the connection to 14:30 is 2 hours 30 minutes", () => {
    const held = added(viaSaoPaulo());
    assert.deepEqual(legDurations(held)[0], { shortest: 240, longest: 240 });
    assert.deepEqual(connections(held), [{ shortest: 150, longest: 150 }]);
    assert.equal(legDurations(held).length, 2);
  });

  test("a flight of one leg has no connection", () => {
    assert.deepEqual(connections(added(la800())), []);
  });
});

describe("BKG:FLIGHT-F4 — each traveller's seat on each leg", () => {
  const two = (seats: FlightBooking["seats"]) => viaSaoPaulo({ travellers: ["acct-1", "acct-2"], seats });

  test("seat 23A for the first traveller on the first leg is held", () => {
    const held = added(two([{ traveller: "acct-1", leg: 0, seat: "23A" }]));
    assert.deepEqual(held.seats, [{ traveller: "acct-1", leg: 0, seat: "23A" }]);
  });

  test("a seat for a traveller the flight does not name is refused", () => {
    const refused = refusal(apply(undefined, add(two([{ traveller: "acct-9", leg: 0, seat: "23A" }]))));
    assert.equal(refused.code, "seat-traveller");
    assert.equal(refused.details?.seat, "0");
  });

  test("two seats for the first traveller on the first leg are refused", () => {
    const seats = [{ traveller: "acct-1", leg: 0, seat: "23A" }, { traveller: "acct-1", leg: 0, seat: "23B" }];
    const refused = refusal(apply(undefined, add(two(seats))));
    assert.equal(refused.code, "duplicate-seat");
    assert.equal(refused.details?.seat, "1");
  });

  test("seats are held trimmed, by leg and then by traveller", () => {
    const seats = [
      { traveller: "acct-2", leg: 1, seat: " 4C " },
      { traveller: "acct-2", leg: 0, seat: "23B" },
      { traveller: "acct-1", leg: 1, seat: "4D" },
    ];
    assert.deepEqual(added(two(seats)).seats, [
      { traveller: "acct-2", leg: 0, seat: "23B" },
      { traveller: "acct-1", leg: 1, seat: "4D" },
      { traveller: "acct-2", leg: 1, seat: "4C" },
    ]);
  });
});

describe("the refusals of a flight", () => {
  const withLeg = (fields: Partial<FlightBooking["legs"][number]>) => la800("f", { legs: [{ ...la800().legs[0]!, ...fields }] });
  const code = (booking: FlightBooking) => refusal(checkFlight(booking)).code;

  test("bad-flight, and the forms a flight number takes", () => {
    for (const number of ["LATAM", "", "L 800", "LA 80000", "LA-800", "LA  800"]) assert.equal(code(withLeg({ flight: number })), "bad-flight", number);
    for (const number of ["LA 800", "IB6830", "u2 1234a", " 4u 9 "]) assert.ok(checkFlight(withLeg({ flight: number })).ok, number);
    assert.equal(ok(checkFlight(withLeg({ flight: " ib6830 " }))).legs[0]!.flight, "IB6830");
  });

  test("bad-airport", () => {
    for (const code_ of ["scl", "SC", "SCLX", "S1L", " SCL"]) assert.equal(code(withLeg({ from: airport(code_) })), "bad-airport", code_);
  });

  test("bad-text, for an airport's name", () => {
    assert.equal(code(withLeg({ to: airport("PUQ", "  ") })), "bad-text");
    assert.equal(code(withLeg({ to: airport("PUQ", "x".repeat(201)) })), "bad-text");
    assert.equal(ok(checkFlight(withLeg({ to: airport("PUQ", " Punta Arenas ") }))).legs[0]!.to.name, "Punta Arenas");
  });

  test("bad-seat", () => {
    for (const seat of [{ seat: "", leg: 0 }, { seat: "123456789", leg: 0 }, { seat: "1A", leg: 1 }, { seat: "1A", leg: -1 }, { seat: "1A", leg: 0.5 }]) {
      assert.equal(code(la800("f", { seats: [{ traveller: "acct-1", ...seat }] })), "bad-seat", JSON.stringify(seat));
    }
  });

  test("a refusal of trip-time's create is passed on, naming the leg", () => {
    const refused = refusal(checkFlight(withLeg({ arrives: { kind: "exact", zone: PUNTA_ARENAS, date: "2026-02-30", at: { time: "10:30" } } })));
    assert.equal(refused.code, "invalid-date");
    assert.equal(refused.details?.leg, "0");
    assert.equal(refusal(checkFlight(withLeg({ leaves: { kind: "exact", zone: "Mars/Olympus", date: december(6), at: { time: "07:05" } } }))).code, "unknown-zone");
  });

  test("checkFlight checks only the flight's own fields, and refuses a booking that is not a flight", () => {
    assert.ok(checkFlight(la800("not an id", { travellers: [] })).ok);
    assert.equal(refusal(checkFlight({ ...la800(), kind: "stay" } as unknown as FlightBooking)).code, "malformed");
  });
});

describe("flightTimes and flightLabel", () => {
  test("a flight starts when its first leg leaves and ends when its last arrives", () => {
    const f = added(viaSaoPaulo());
    assert.deepEqual(flightTimes(f), { starts: f.legs[0]!.leaves, ends: f.legs[1]!.arrives });
  });

  test("the label names the first flight number and the two ends, and counts the legs", () => {
    assert.equal(flightLabel(added(la800())), "LA 800, Santiago to Punta Arenas");
    assert.equal(label(added(viaSaoPaulo())), "LA 8084, Santiago to Madrid, 2 flights");
    const coded = flight("f", [leg("LA 800", airport("SCL"), exact(SANTIAGO, december(6), "07:05"), airport("PUQ"), exact(PUNTA_ARENAS, december(6), "10:30"))]);
    assert.equal(flightLabel(coded), "LA 800, SCL to PUQ");
  });
});

// The checks of the bookings list that a flight is enough for. Those that need another kind are in
// the test file of that kind, and in kinds.test.ts.

describe("BKG:LIST-F1 — one change at a time, each checked whole (with a flight)", () => {
  const held = () => added(la800());

  test("changing the flight's notes gives revision 2", () => {
    const changed = ok(apply(held(), { op: "change", booking: la800("la800", { details: { notes: "Window seats." } }), base: 1 }))!;
    assert.equal(changed.revision, 2);
    assert.equal(changed.details.notes, "Window seats.");
  });

  test("changing the flight with a leg that arrives before it leaves is refused, with the reason, and the flight is unchanged", () => {
    const flight_ = held();
    const before_ = bookingToText(flight_);
    const backwards = { ...flight_.legs[0]!, arrives: exact(PUNTA_ARENAS, december(5), "10:30") };
    const refused = refusal(apply(flight_, { op: "change", booking: { ...flight_, legs: [backwards] }, base: 1 }));
    assert.equal(refused.code, "travel-order");
    assert.ok(refused.message.length > 0);
    assert.equal(bookingToText(flight_), before_);
  });

  test("changing the flight into a stay is refused", () => {
    const stay = { ...common("la800"), kind: "stay", name: "Hostal", checkIn: {}, checkOut: {} } as unknown as Booking;
    assert.equal(refusal(apply(held(), { op: "change", booking: stay, base: 1 })).code, "kind-change");
  });

  test("an added or changed booking's revision is set by apply, whatever the caller gives", () => {
    assert.equal(added(la800("la800", { revision: 7 })).revision, 1);
    assert.equal(ok(apply(held(), { op: "change", booking: la800("la800", { revision: 9 }), base: 1 }))!.revision, 2);
  });
});

describe("BKG:LIST-F2 — one or more travellers, each once, given for each access check (with a flight)", () => {
  test("a booking naming no traveller is refused", () => {
    assert.equal(refusal(apply(undefined, add(la800("f", { travellers: [] })))).code, "no-travellers");
  });

  test("a booking naming the same traveller twice is refused, naming them", () => {
    const refused = refusal(apply(undefined, add(la800("f", { travellers: ["acct-1", "acct-2", "acct-1"] }))));
    assert.equal(refused.code, "duplicate-traveller");
    assert.equal(refused.details?.traveller, "acct-1");
  });

  test("50 travellers are accepted, and 51 refused", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `acct-${i}`);
    assert.ok(check(la800("f", { travellers: many(50) })).ok);
    assert.equal(refusal(check(la800("f", { travellers: many(51) }))).code, "too-many-travellers");
  });

  test("from the first and second travellers to the first alone, the travellers given are both before and the first after", () => {
    const both = added(la800("f", { travellers: ["acct-2", "acct-1"] }));
    assert.deepEqual(both.travellers, ["acct-1", "acct-2"]);
    const given = touches(both, { op: "change", booking: la800("f", { travellers: ["acct-1"] }), base: 1 });
    assert.deepEqual(given, { id: "f", before: ["acct-1", "acct-2"], after: ["acct-1"] });
  });
});

describe("BKG:LIST-F3 — a change from an older revision is refused, with the booking as it stands (with a flight)", () => {
  const atRevision3 = () =>
    [la800("f", { details: { notes: "One" } }), la800("f", { details: { notes: "Two" } })].reduce<Booking>(
      (held, booking) => ok(apply(held, { op: "change", booking, base: held.revision }))!,
      added(la800("f")),
    );

  test("changing it from revision 3 is accepted, at revision 4", () => {
    const three = atRevision3();
    assert.equal(three.revision, 3);
    assert.equal(ok(apply(three, { op: "change", booking: la800("f"), base: 3 }))!.revision, 4);
  });

  test("changing it from revision 3 again is refused, holding the booking at revision 4", () => {
    const four = ok(apply(atRevision3(), { op: "change", booking: la800("f", { details: { notes: "Four" } }), base: 3 }))!;
    const refused = refusal(apply(four, { op: "change", booking: la800("f"), base: 3 }));
    assert.equal(refused.code, "stale");
    assert.equal(refused.details?.revision, "4");
    assert.deepEqual(ok(bookingFromText(refused.details!.booking!)), four);
  });

  test("removing it from revision 3 is refused in the same way", () => {
    const four = ok(apply(atRevision3(), { op: "change", booking: la800("f"), base: 3 }))!;
    const refused = refusal(apply(four, { op: "remove", id: "f", base: 3 }));
    assert.equal(refused.code, "stale");
    assert.equal(refused.details?.booking, bookingToText(four));
  });
});

describe("BKG:LIST-F5 — the dates a booking covers (with a flight)", () => {
  test("a flight leaving Santiago at 23:40 on 1 December and arriving in Madrid on 2 December covers 1 and 2 December", () => {
    const f = added(flight("ib", [leg("IB 6830", SCL, exact(SANTIAGO, december(1), "23:40"), MAD, exact(MADRID, december(2), "16:35"))]));
    const e = extent(f);
    assert.deepEqual([e.first, e.last], [december(1), december(2)]);
    assert.equal(e.starts, f.legs[0]!.leaves);
    assert.equal(e.ends, f.legs[0]!.arrives);
  });
});

describe("BKG:LIST-F6 — a booking's reference, provider, link, notes and page, each checked (with a flight)", () => {
  const withDetails = (details: object) => la800("f", { details });
  const code = (details: object) => refusal(check(withDetails(details))).code;

  test("each detail is held as given, trimmed", () => {
    const details = { reference: " K7Q2ZP ", provider: "LATAM", link: "https://example.com/k7q2zp", notes: "Aisle seats.\n", page: "c3e2" };
    assert.deepEqual(added(withDetails(details)).details, { reference: "K7Q2ZP", provider: "LATAM", link: "https://example.com/k7q2zp", notes: "Aisle seats.", page: "c3e2" });
  });

  test("a link that is not a secure web address is refused, with the reason", () => {
    for (const link of ["http://example.com/k7q2zp", "example.com", "ftp://example.com", "", `https://example.com/${"x".repeat(2000)}`]) {
      const refused = refusal(check(withDetails({ link })));
      assert.equal(refused.code, "bad-link", link.slice(0, 30));
      assert.ok(refused.message.length > 0);
    }
  });

  test("notes of 4,001 characters are refused, with the reason, and 4,000 are held", () => {
    const refused = refusal(check(withDetails({ notes: "x".repeat(4001) })));
    assert.equal(refused.code, "bad-text");
    assert.match(refused.message, /4000 characters/);
    assert.ok(check(withDetails({ notes: "x".repeat(4000) })).ok);
    assert.ok(check(withDetails({ notes: "🏔".repeat(4000) })).ok, "characters are counted as code points");
  });

  test("each limit of the table of §4.1", () => {
    assert.equal(code({ reference: "x".repeat(65) }), "bad-text");
    assert.ok(check(withDetails({ reference: "x".repeat(64) })).ok);
    assert.equal(code({ provider: "x".repeat(201) }), "bad-text");
    assert.ok(check(withDetails({ provider: "x".repeat(200) })).ok);
    for (const key of ["reference", "provider", "notes"]) assert.equal(code({ [key]: "   " }), "bad-text", key);
    assert.equal(code({ page: "not a page" }), "bad-id");
  });

  test("bad-id, for the booking's identifier", () => {
    for (const id of ["", "has space", "x".repeat(65), "é"]) assert.equal(refusal(check(la800(id))).code, "bad-id", id);
    assert.ok(check(la800("x".repeat(64))).ok);
  });

  test("check gives the booking frozen, and leaves what it was given alone", () => {
    const given = la800("f", { travellers: ["b", "a"] });
    const checked = ok(check(given));
    assert.deepEqual(checked.travellers, ["a", "b"]);
    assert.deepEqual(given.travellers, ["b", "a"]);
    assert.ok(Object.isFrozen(checked) && Object.isFrozen(checked.legs) && Object.isFrozen(checked.legs[0]) && Object.isFrozen(checked.details));
  });
});

describe("BKG:LIST-F7 — a booking and a change, as text and back (with a flight)", () => {
  const full = () =>
    added(
      viaSaoPaulo({
        travellers: ["acct-1", "acct-2"],
        seats: [{ traveller: "acct-1", leg: 0, seat: "23A" }, { traveller: "acct-2", leg: 1, seat: "4C" }],
        details: { reference: "K7Q2ZP", provider: "LATAM", link: "https://example.com/k7q2zp", notes: "Aisle.", page: "c3e2" },
      }),
    );

  test("a flight written as text reads back equal to itself", () => {
    assert.deepEqual(ok(bookingFromText(bookingToText(full()))), full());
    assert.deepEqual(ok(bookingFromText(bookingToText(added(la800())))), added(la800()));
  });

  test("a flight written under one copy of the rules reads back unchanged under later rules", () => {
    loadFixture("no-summer-time.json");
    const f = added(flight("af", [leg("AF 6", airport("CDG"), exact(PARIS, "2026-03-29", "02:30"), airport("JFK"), exact(NEW_YORK, "2026-03-29", "05:00"))]));
    const text = bookingToText(f);
    loadFixture("summer-time.json");
    assert.deepEqual(ok(bookingFromText(text)), f);
    loadNewestRules();
  });

  test("the same flight always gives the same text, in the form of §5.1", () => {
    assert.equal(bookingToText(full()), bookingToText(full()));
    const text = bookingToText(added(la800()));
    assert.equal(
      text,
      '{"details":{},"format":1,"id":"la800","kind":"flight","legs":[{"arrives":"2026-12-06T10:30[America/Punta_Arenas]","flight":"LA 800",' +
        '"from":{"code":"SCL","name":"Santiago"},"leaves":"2026-12-06T07:05[America/Santiago]","to":{"code":"PUQ","name":"Punta Arenas"}}],' +
        '"revision":1,"seats":[],"travellers":["acct-1"]}',
    );
  });

  test("an add and a change of a flight read back equal to themselves", () => {
    for (const change of [{ op: "add", booking: full() }, { op: "change", booking: full(), base: 1 }] as Change[]) {
      assert.deepEqual(ok(changeFromText(changeToText(change))), change);
    }
  });

  test("reading text does not apply the checks of §4.1 again", () => {
    const text = bookingToText(added(la800())).replace('"travellers":["acct-1"]', '"travellers":[]');
    assert.deepEqual(ok(bookingFromText(text)).travellers, []);
  });

  test("a flight's text with a field missing, or one too many, is refused", () => {
    const text = bookingToText(added(la800()));
    assert.equal(refusal(bookingFromText(text.replace('"seats":[],', ""))).code, "malformed");
    assert.equal(refusal(bookingFromText(text.replace('"format":1,', ""))).code, "malformed");
    assert.equal(refusal(bookingFromText(text.replace('"seats":[]', '"seats":[],"gate":"B12"'))).code, "malformed");
  });
});
