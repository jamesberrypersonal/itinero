// The types of the programming interface (spec/bookings/list.md §3.3), and the refusals every
// module of the package throws inside a check and returns as a Result.

import type { LocalDate, Refusal, Result, TripTime } from "@itinero/trip-time";
import type { FlightBooking } from "./flight.ts";
import type { JourneyBooking } from "./journey.ts";
import type { StayBooking } from "./stay.ts";

export type { Duration, LocalDate, Refusal, Result, TripTime } from "@itinero/trip-time";

/** 1 to 64 of A–Z, a–z, 0–9, "-" and "_", unique within a trip's bookings. */
export type Id = string;
/** An account's identifier, as access/accounts gives it. */
export type TravellerId = string;
/** A page of the trip, as planner/pages names it. */
export type PageId = string;

export type Details = {
  reference?: string;
  provider?: string;
  link?: string;
  notes?: string;
  page?: PageId;
};

export type Common = { id: Id; revision: number; travellers: readonly TravellerId[]; details: Details };

/** A booking of one of the kinds the package holds, each of which its own module gives. */
export type Booking = FlightBooking | StayBooking | JourneyBooking;

export type Change =
  | { op: "add"; booking: Booking }
  | { op: "change"; booking: Booking; base: number }
  | { op: "remove"; id: Id; base: number };

export type Touches = { id: Id; before: readonly TravellerId[]; after: readonly TravellerId[] };

export type Extent = { starts: TripTime; ends?: TripTime; first: LocalDate; last: LocalDate };

export type RefusalCode =
  | "malformed"
  | "unknown-kind"
  | "bad-id"
  | "no-travellers"
  | "too-many-travellers"
  | "duplicate-traveller"
  | "bad-text"
  | "bad-link"
  | "duplicate-id"
  | "unknown-id"
  | "kind-change"
  | "stale"
  | "unknown-format"
  // A flight's (spec/bookings/flight.md §3.3)
  | "no-legs"
  | "too-many-legs"
  | "bad-flight"
  | "bad-airport"
  | "exact-only"
  | "travel-order"
  | "leg-order"
  | "bad-seat"
  | "seat-traveller"
  | "duplicate-seat"
  // A stay's (spec/bookings/stay.md §3.3)
  | "zone-mismatch"
  | "stay-order"
  | "stay-length"
  // A journey's (spec/bookings/journey.md §3.3), beside travel-order
  | "unknown-way"
  | "too-long";

/** A refusal of this package, thrown inside a check and caught where a Result is returned. */
export class Refused extends Error {
  readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

export function fail(code: RefusalCode, message: string, details?: Record<string, string>): never {
  const refusal = details
    ? { code: code as Refusal["code"], message, details: Object.freeze({ ...details }) }
    : { code: code as Refusal["code"], message };
  throw new Refused(Object.freeze(refusal));
}

/** Passes on a refusal from trip-time, or from a kind, with its code unchanged. */
export function refusedBy(refusal: Refusal, details?: Record<string, string>): never {
  const merged = details || refusal.details ? { ...refusal.details, ...details } : undefined;
  fail(refusal.code as RefusalCode, refusal.message, merged);
}

/** Runs a check, turning a refusal it throws into a refused Result. */
export function attempt<T>(run: () => T): Result<T> {
  try {
    return Object.freeze({ ok: true as const, value: run() });
  } catch (error) {
    if (error instanceof Refused) return Object.freeze({ ok: false as const, refusal: error.refusal });
    throw error;
  }
}
