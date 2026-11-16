// The flight booking (spec/bookings/flight.md): its legs, airports and seats, its check (§4.1), its
// times and label (§4.2), and how long each leg and each connection takes (§4.3).

import { duration, toText, type Duration, type TripTime } from "@itinero/trip-time";
import { certainlyBefore, checkText, checkTime, length } from "./check.ts";
import { fields, list, optionalText, plain, present, text, type TimeReader } from "./form.ts";
import { checkOwn, type KindOps } from "./kind.ts";
import { fail, type Common, type Result, type TravellerId } from "./types.ts";

export type Airport = { code: string; name?: string };
export type Leg = { flight: string; from: Airport; to: Airport; leaves: TripTime; arrives: TripTime };
export type Seat = { traveller: TravellerId; leg: number; seat: string };

export type FlightBooking = Common & { kind: "flight"; legs: readonly Leg[]; seats: readonly Seat[] };

const MAX_LEGS = 8;
const MAX_NAME = 200;
const MAX_SEAT = 8;
const FLIGHT = /^[A-Z0-9]{2} ?[0-9]{1,4}[A-Z]?$/;
const AIRPORT = /^[A-Z]{3}$/;

function readAirport(value: unknown, what: string): Airport {
  const r = fields(value, what, ["code"], ["name"]);
  return Object.freeze(present({ code: text(r.code, `${what}'s code`) }, { name: optionalText(r, "name", `${what}'s name`) }));
}

function readLeg(value: unknown, time: TimeReader): Leg {
  const r = fields(value, "leg", ["flight", "from", "to", "leaves", "arrives"]);
  return Object.freeze({
    flight: text(r.flight, "leg's flight number"),
    from: readAirport(r.from, "airport left from"),
    to: readAirport(r.to, "airport arrived at"),
    leaves: time(r.leaves, "leg's departure"),
    arrives: time(r.arrives, "leg's arrival"),
  });
}

function readSeat(value: unknown): Seat {
  const r = fields(value, "seat", ["traveller", "leg", "seat"]);
  if (typeof r.leg !== "number") fail("malformed", "The seat's leg is not a number.");
  return Object.freeze({ traveller: text(r.traveller, "seat's traveller"), leg: r.leg, seat: text(r.seat, "seat") });
}

function checkAirport(airport: Airport, what: string, leg: Record<string, string>): Airport {
  if (!AIRPORT.test(airport.code)) fail("bad-airport", `The code of the ${what}, ${JSON.stringify(airport.code)}, is not three capitals A to Z.`, leg);
  if (airport.name === undefined) return airport;
  return Object.freeze({ code: airport.code, name: checkText(airport.name, `name of the ${what}`, MAX_NAME, leg) });
}

function checkLeg(leg: Leg, at: number, before: Leg | undefined): Leg {
  const details = { leg: String(at) };
  const n = at + 1;
  const flight = leg.flight.trim().toUpperCase();
  if (!FLIGHT.test(flight)) {
    fail("bad-flight", `The flight number of leg ${n}, ${JSON.stringify(leg.flight)}, is not two letters or digits and a number, such as LA 800.`, details);
  }
  const from = checkAirport(leg.from, `airport leg ${n} leaves from`, details);
  const to = checkAirport(leg.to, `airport leg ${n} arrives at`, details);
  for (const [value, what] of [[leg.leaves, "leaves"], [leg.arrives, "arrives"]] as const) {
    if (value.kind !== "exact") fail("exact-only", `Leg ${n} ${what} at a time that is not exact, and a flight's times are exact.`, details);
  }
  const leaves = checkTime(leg.leaves, details);
  const arrives = checkTime(leg.arrives, details);
  if (certainlyBefore(leaves, arrives)) fail("travel-order", `Leg ${n} arrives before it leaves.`, details);
  if (before && certainlyBefore(before.arrives, leaves)) fail("leg-order", `Leg ${n} leaves before leg ${at} arrives.`, details);
  return Object.freeze({ flight, from, to, leaves, arrives });
}

function checkSeats(seats: readonly Seat[], legs: number, travellers: readonly TravellerId[]): readonly Seat[] {
  const checked = seats.map((s, at) => {
    const details = { seat: String(at) };
    const seat = s.seat.trim();
    if (seat === "" || length(seat) > MAX_SEAT || !Number.isInteger(s.leg) || s.leg < 0 || s.leg >= legs) {
      fail("bad-seat", `Seat ${at + 1} is not 1 to ${MAX_SEAT} characters on a leg the flight holds.`, details);
    }
    if (!travellers.includes(s.traveller)) {
      fail("seat-traveller", `Seat ${at + 1} is for ${JSON.stringify(s.traveller)}, whom the booking does not name.`, details);
    }
    if (seats.slice(0, at).some((o) => o.traveller === s.traveller && o.leg === s.leg)) {
      fail("duplicate-seat", `Seat ${at + 1} is a second seat for ${JSON.stringify(s.traveller)} on leg ${s.leg + 1}.`, details);
    }
    return Object.freeze({ traveller: s.traveller, leg: s.leg, seat });
  });
  const order = (a: Seat, b: Seat) => a.leg - b.leg || (a.traveller < b.traveller ? -1 : a.traveller > b.traveller ? 1 : 0);
  return Object.freeze(checked.sort(order));
}

function check(booking: FlightBooking): FlightBooking {
  const { legs } = booking;
  if (legs.length === 0) fail("no-legs", "The flight holds no leg, and holds at least one.");
  if (legs.length > MAX_LEGS) fail("too-many-legs", `The flight holds ${legs.length} legs, and holds at most ${MAX_LEGS}.`);
  const checked: Leg[] = [];
  for (const [at, leg] of legs.entries()) checked.push(checkLeg(leg, at, checked[at - 1]));
  const seats = checkSeats(booking.seats, legs.length, booking.travellers);
  return Object.freeze({ ...booking, legs: Object.freeze(checked), seats });
}

function first(booking: FlightBooking): Leg {
  return booking.legs[0]!;
}

function last(booking: FlightBooking): Leg {
  return booking.legs[booking.legs.length - 1]!;
}

export function flightTimes(booking: FlightBooking): { starts: TripTime; ends: TripTime } {
  return Object.freeze({ starts: first(booking).leaves, ends: last(booking).arrives });
}

export function flightLabel(booking: FlightBooking): string {
  const place = (airport: Airport) => airport.name ?? airport.code;
  const count = booking.legs.length > 1 ? `, ${booking.legs.length} flights` : "";
  return `${first(booking).flight}, ${place(first(booking).from)} to ${place(last(booking).to)}${count}`;
}

export function legDurations(booking: FlightBooking): Duration[] {
  return Object.freeze(booking.legs.map((leg) => duration({ start: leg.leaves, end: leg.arrives }))) as Duration[];
}

export function connections(booking: FlightBooking): Duration[] {
  return Object.freeze(
    booking.legs.slice(1).map((leg, at) => duration({ start: booking.legs[at]!.arrives, end: leg.leaves })),
  ) as Duration[];
}

export const flightOps: KindOps<FlightBooking> = {
  required: ["legs", "seats"],
  optional: [],
  read: (r, time) => ({
    legs: Object.freeze(list(r.legs, "flight's legs").map((leg) => readLeg(leg, time))),
    seats: Object.freeze(list(r.seats, "flight's seats").map(readSeat)),
  }),
  check,
  times: flightTimes,
  label: flightLabel,
  toJson: (booking) => ({
    legs: booking.legs.map((leg) => ({
      flight: leg.flight,
      from: plain(leg.from),
      to: plain(leg.to),
      leaves: toText(leg.leaves),
      arrives: toText(leg.arrives),
    })),
    seats: plain(booking.seats),
  }),
};

export function checkFlight(booking: FlightBooking): Result<FlightBooking> {
  return checkOwn(booking, "flight", flightOps);
}
