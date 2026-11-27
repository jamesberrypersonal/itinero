// The types of the programming interface (spec §3.3).

import type { LocalDate, Refusal, Result, TripTime } from "@itinero/trip-time";

export type { Duration, LocalDate, Refusal, Result, TripTime } from "@itinero/trip-time";

/** 1 to 64 of A–Z, a–z, 0–9, "-" and "_", unique within a trip. */
export type Id = string;
/** An ISO 3166-1 alpha-2 code, such as "FR". */
export type Country = string;
/** A country, and perhaps somewhere in it. */
export type Place = { country: Country; name?: string };
/** A page of the trip, as planner/pages names it. */
export type PageId = string;

export type Stretch = { id: Id; place: Place; first: LocalDate; last: LocalDate; page?: PageId };

/** A date with no time. */
export type Day = { kind: "day"; date: LocalDate };
/** A Day, or a trip-time value of a kind holding a time. */
export type When = Day | TripTime;
export type Way = "flight" | "train" | "bus" | "ferry" | "car" | "other";
export type Travel = { from: Place; to: Place; by: Way; arrive?: When };

/** A firm item. `address` is one line, kept as written, and never looked up (spec §4.4). */
export type FirmItem = { id: Id; revision: number; title: string; when: When; travel?: Travel; page?: PageId; address?: string };

export type Dates = { first: LocalDate; last: LocalDate };
export type TravellerDates = { traveller: Id; dates: Dates };
export type Trip = {
  format: 1;
  id: Id;
  name: string;
  revision: number;
  dates?: Dates;
  travellers: readonly TravellerDates[];
  stretches: readonly Stretch[];
  firm: readonly FirmItem[];
};

export type Change =
  | { op: "rename"; name: string }
  | { op: "trip-dates"; dates: Dates }
  | { op: "traveller-dates"; traveller: Id; dates?: Dates }
  | { op: "pencil"; stretch: Stretch }
  | { op: "move"; id: Id; first: LocalDate; last: LocalDate }
  | { op: "re-place"; id: Id; place: Place }
  | { op: "remove-stretch"; id: Id }
  | { op: "add-firm"; item: FirmItem }
  | { op: "change-firm"; item: FirmItem; base: number }
  | { op: "remove-firm"; id: Id };

export type DayLayout = { date: LocalDate; countries: Country[]; stretches: Stretch[]; firm: FirmItem[] };

export type RefusalCode =
  | "malformed"
  | "bad-id"
  | "bad-text"
  | "invalid-date"
  | "stretch-order"
  | "stretch-length"
  | "unknown-country"
  | "date-only"
  | "duplicate-id"
  | "unknown-id"
  | "travel-order"
  | "range-order"
  | "range-length"
  | "outside-trip"
  | "travellers-outside"
  | "stale"
  | "unknown-format";

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

/** Runs a check, turning a refusal it throws into a refused Result. */
export function attempt<T>(run: () => T): Result<T> {
  try {
    return Object.freeze({ ok: true as const, value: run() });
  } catch (error) {
    if (error instanceof Refused) return Object.freeze({ ok: false as const, refusal: error.refusal });
    throw error;
  }
}
