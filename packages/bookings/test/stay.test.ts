// The stay booking: every check in the verification of each requirement it claims, and each of its
// refusals (spec/bookings/stay.md §3.3, §4, §7). Then the checks of the bookings list that need a
// stay (spec/bookings/list.md §4.6).

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  apply,
  bookingFromText,
  bookingToText,
  checkStay,
  extent,
  label,
  nights,
  onDate,
  stayLabel,
  stayTimes,
  type Booking,
  type Change,
  type StayBooking,
} from "../src/index.ts";
import {
  PUNTA_ARENAS,
  SANTIAGO,
  approx,
  date,
  december,
  exact,
  la800,
  ladyFlorence,
  loadNewestRules,
  ok,
  refusal,
  stay,
  tbd,
  time,
  window,
} from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const add = (booking: Booking): Change => ({ op: "add", booking });
const added = (booking: Booking) => ok(apply(undefined, add(booking))) as StayBooking;
const code = (booking: StayBooking) => refusal(apply(undefined, add(booking))).code;

describe("BKG:STAY-F1 — a name, perhaps an address, and a check-in and check-out at least one night apart", () => {
  test("Hostal Lady Florence, in on 9 December and out on 12 December in Punta Arenas time, is held as given", () => {
    assert.deepEqual(added(ladyFlorence()), { ...ladyFlorence(), revision: 1 });
    const withAddress = added(ladyFlorence("s", { address: "Avenida Colón 1034, Punta Arenas" }));
    assert.equal(withAddress.address, "Avenida Colón 1034, Punta Arenas");
  });

  test("a stay checking out on the date it checks in is refused, with the reason", () => {
    const refused = refusal(apply(undefined, add(ladyFlorence("s", { checkOut: date(PUNTA_ARENAS, december(9)) }))));
    assert.equal(refused.code, "stay-order");
    assert.match(refused.message, /later date/);
  });

  test("a stay of 367 nights is refused, with the reason, and one of 366 is held", () => {
    const refused = refusal(apply(undefined, add(ladyFlorence("s", { checkOut: date(PUNTA_ARENAS, "2027-12-11") }))));
    assert.equal(refused.code, "stay-length");
    assert.match(refused.message, /367 nights/);
    assert.equal(nights(added(ladyFlorence("s", { checkOut: date(PUNTA_ARENAS, "2027-12-10") }))), 366);
  });

  test("a stay checking in in one time zone and out in another is refused", () => {
    assert.equal(code(ladyFlorence("s", { checkOut: date(SANTIAGO, december(12)) })), "zone-mismatch");
  });
});

describe("BKG:STAY-F2 — a check-in and a check-out as precise as the confirmation", () => {
  test("in between 15:00 and 22:00 on 9 December, and out by around 11:00 on 12 December, are held as given", () => {
    const checkIn = window(PUNTA_ARENAS, december(9), "15:00", "22:00");
    const checkOut = approx(PUNTA_ARENAS, december(12), "11:00");
    const held = added(ladyFlorence("s", { checkIn, checkOut }));
    assert.deepEqual([held.checkIn, held.checkOut], [checkIn, checkOut]);
  });

  test("in on 9 December with the time to be decided is accepted", () => {
    assert.equal(added(ladyFlorence("s", { checkIn: tbd(PUNTA_ARENAS, december(9)) })).checkIn.kind, "tbd");
  });

  test("each kind trip-time holds is accepted, at both ends", () => {
    const at = (on: string) => [
      exact(PUNTA_ARENAS, on, "15:00"),
      approx(PUNTA_ARENAS, on, "15:00"),
      window(PUNTA_ARENAS, on, "15:00", "22:00"),
      time({ kind: "part", zone: PUNTA_ARENAS, date: on, part: "afternoon" }),
      date(PUNTA_ARENAS, on),
      tbd(PUNTA_ARENAS, on),
    ];
    for (const checkIn of at(december(9))) for (const checkOut of at(december(12))) assert.ok(checkStay(ladyFlorence("s", { checkIn, checkOut })).ok);
  });
});

describe("BKG:STAY-F3 — how many nights, and every date from check-in to check-out", () => {
  test("the stay of BKG:STAY-F1 is 3 nights", () => {
    assert.equal(nights(added(ladyFlorence())), 3);
  });

  test("it covers 9, 10, 11 and 12 December", () => {
    const held = added(ladyFlorence());
    assert.deepEqual([extent(held).first, extent(held).last], [december(9), december(12)]);
    for (const d of [9, 10, 11, 12]) assert.deepEqual(onDate([held], december(d)), [held], `${d} December`);
    for (const d of [8, 13]) assert.deepEqual(onDate([held], december(d)), [], `${d} December`);
  });
});

describe("the refusals of a stay", () => {
  test("bad-text, for a name or an address", () => {
    for (const name of ["", "  ", "x".repeat(201)]) assert.equal(code(ladyFlorence("s", { name })), "bad-text", name);
    for (const address of ["  ", "x".repeat(501)]) assert.equal(code(ladyFlorence("s", { address })), "bad-text");
    const trimmed = added(ladyFlorence("s", { name: " Hostal ", address: " Colón 1034 " }));
    assert.deepEqual([trimmed.name, trimmed.address], ["Hostal", "Colón 1034"]);
    assert.ok(checkStay(ladyFlorence("s", { name: "x".repeat(200), address: "x".repeat(500) })).ok);
  });

  test("stay-order counts from the date a check-in window ends", () => {
    const lateWindow = window(PUNTA_ARENAS, december(9), "22:00", "01:00", december(10));
    assert.equal(code(ladyFlorence("s", { checkIn: lateWindow, checkOut: date(PUNTA_ARENAS, december(10)) })), "stay-order");
    assert.equal(nights(added(ladyFlorence("s", { checkIn: lateWindow, checkOut: date(PUNTA_ARENAS, december(11)) }))), 2);
  });

  test("a refusal of trip-time's create is passed on", () => {
    assert.equal(code(ladyFlorence("s", { checkIn: { kind: "date", zone: PUNTA_ARENAS, date: "2026-02-30" } })), "invalid-date");
    assert.equal(code(ladyFlorence("s", { checkOut: { kind: "date", zone: "Mars/Olympus", date: december(12) } })), "unknown-zone");
  });

  test("checkStay checks only the stay's own fields, and refuses a booking that is not a stay", () => {
    assert.ok(checkStay(ladyFlorence("not an id", { travellers: [] })).ok);
    assert.equal(refusal(checkStay(la800() as unknown as StayBooking)).code, "malformed");
  });
});

describe("stayTimes and stayLabel", () => {
  test("a stay starts at its check-in and ends at its check-out, and is labelled by its name", () => {
    const held = added(ladyFlorence());
    assert.deepEqual(stayTimes(held), { starts: held.checkIn, ends: held.checkOut });
    assert.equal(stayLabel(held), "Hostal Lady Florence");
    assert.equal(label(held), "Hostal Lady Florence");
  });
});

// The checks of the bookings list that need a stay.

describe("BKG:LIST-F1 — one change at a time, each checked whole (with a flight and a stay)", () => {
  test("on a trip holding a flight, a stay is added with revision 1, then removed", () => {
    const trip = new Map<string, Booking>();
    const make = (change: Change) => {
      const id = change.op === "remove" ? change.id : change.booking.id;
      const result = ok(apply(trip.get(id), change));
      if (result) trip.set(id, result);
      else trip.delete(id);
    };
    make(add(la800()));
    make(add(ladyFlorence()));
    assert.equal(trip.get("5d1a")!.revision, 1);
    assert.deepEqual([...trip.keys()].sort(), ["5d1a", "la800"]);
    make({ op: "remove", id: "5d1a", base: 1 });
    assert.deepEqual([...trip.keys()], ["la800"]);
  });
});

describe("BKG:LIST-F7 — a booking as text and back (with a stay)", () => {
  const example = () => {
    const details = { link: "https://example.com/stays/k7q2zp", notes: "Ring the bell at the side gate on arrival.", page: "c3e2", provider: "Booking.com", reference: "K7Q2ZP" };
    const first = stay("5d1a", "Hostal Lady Florence", window(PUNTA_ARENAS, december(9), "15:00", "22:00"), approx(PUNTA_ARENAS, december(12), "11:00"), {
      travellers: ["acct-2", "acct-1"],
      details,
    });
    return ok(apply(added(first), { op: "change", booking: first, base: 1 }))!;
  };

  test("the stay of §5.1 is written as §5.1 gives it", () => {
    assert.equal(
      bookingToText(example()),
      '{"checkIn":"2026-12-09T15:00/22:00[America/Punta_Arenas]","checkOut":"2026-12-12~11:00[America/Punta_Arenas]",' +
        '"details":{"link":"https://example.com/stays/k7q2zp","notes":"Ring the bell at the side gate on arrival.","page":"c3e2",' +
        '"provider":"Booking.com","reference":"K7Q2ZP"},"format":1,"id":"5d1a","kind":"stay","name":"Hostal Lady Florence",' +
        '"revision":2,"travellers":["acct-1","acct-2"]}',
    );
  });

  test("a stay, with an address and without, reads back equal to itself", () => {
    for (const s of [example(), added(ladyFlorence("s", { address: "Colón 1034" }))]) assert.deepEqual(ok(bookingFromText(bookingToText(s))), s);
  });
});
