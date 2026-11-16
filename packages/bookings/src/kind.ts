// What each kind gives the bookings list (spec/bookings/list.md §4), and reading the fields every
// booking has. Each kind's module imports this one, and booking.ts imports each kind's module, so
// nothing here imports a kind.

import type { TripTime } from "@itinero/trip-time";
import { callerTime, fields, list, optionalText, present, text, wholeNumber, type Json, type TimeReader } from "./form.ts";
import { attempt, fail, type Booking, type Common, type Details, type Result } from "./types.ts";

/** The kind's check, its times and its label, and the form of its own fields. */
export type KindOps<B extends Booking> = {
  /** The kind's own fields, beside those every booking has. */
  required: readonly string[];
  optional: readonly string[];
  /** Reads the kind's own fields, checking only their form. */
  read(record: Record<string, unknown>, time: TimeReader): Omit<B, keyof Common | "kind">;
  /** Checks the kind's own fields, once the fields every booking has are checked, and gives the booking as it will be held. */
  check(booking: B): B;
  times(booking: B): { starts: TripTime; ends?: TripTime };
  label(booking: B): string;
  /** The kind's own fields in the text form of §5.1. */
  toJson(booking: B): { [key: string]: Json };
};

const COMMON = ["kind", "id", "revision", "travellers", "details"] as const;
const DETAILS = ["reference", "provider", "link", "notes", "page"] as const;

function readDetails(value: unknown): Details {
  const r = fields(value, "booking's details", [], DETAILS);
  const details: Details = {};
  for (const key of DETAILS) present(details, { [key]: optionalText(r, key, `booking's ${key}`) });
  return Object.freeze(details);
}

/** Reads a booking of the kind `ops` gives, checking only its form. `extra` names keys allowed beside its own. */
export function readAs<B extends Booking>(value: unknown, ops: KindOps<B>, time: TimeReader, extra: readonly string[] = []): B {
  const kind = (value as { kind?: unknown }).kind as string;
  const r = fields(value, `${kind} booking`, [...COMMON, ...ops.required], [...ops.optional, ...extra]);
  const common: Common = {
    id: text(r.id, "booking's identifier"),
    revision: wholeNumber(r.revision, "booking's revision"),
    travellers: Object.freeze(list(r.travellers, "booking's travellers").map((t) => text(t, "traveller"))),
    details: readDetails(r.details),
  };
  return Object.freeze({ kind, ...common, ...ops.read(r, time) }) as unknown as B;
}

/** A kind's public check: the form of the booking, then the kind's own checks (each kind's §4.1). */
export function checkOwn<B extends Booking>(booking: B, kind: B["kind"], ops: KindOps<B>): Result<B> {
  return attempt(() => {
    if ((booking as { kind?: unknown } | null)?.kind !== kind) fail("malformed", `The booking is not a ${kind}.`);
    return Object.freeze(ops.check(readAs(booking, ops, callerTime)));
  });
}
