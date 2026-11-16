// The table every kind is reached through (spec/bookings/list.md §4), and reading and writing the
// fields every booking has, whatever its kind (§3.3, §5.1).

import type { TripTime } from "@itinero/trip-time";
import { fields, isRecord, list, optionalText, plain, present, text, wholeNumber, type Json, type TimeReader } from "./form.ts";
import { fail, type Booking, type Common, type Details } from "./types.ts";

/** What each kind gives the bookings list: the form of its fields, its check, its times and its label. */
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

type Table = { [K in Booking["kind"]]: KindOps<Extract<Booking, { kind: K }>> };

const KINDS: Table = {};

export const KIND_NAMES: readonly string[] = Object.freeze(Object.keys(KINDS).sort());

export function kindOf(kind: string): KindOps<Booking> | undefined {
  return Object.hasOwn(KINDS, kind) ? (KINDS[kind as Booking["kind"]] as unknown as KindOps<Booking>) : undefined;
}

export function opsOf(booking: Booking): KindOps<Booking> {
  const ops = kindOf(booking.kind);
  if (!ops) fail("unknown-kind", unknownKind(booking.kind));
  return ops;
}

function unknownKind(kind: unknown): string {
  const known = KIND_NAMES.length === 0 ? "none yet" : KIND_NAMES.join(", ");
  return `The kind ${JSON.stringify(kind)} is not one the bookings package holds, which are ${known}.`;
}

const DETAILS = ["reference", "provider", "link", "notes", "page"] as const;

function readDetails(value: unknown): Details {
  const r = fields(value, "booking's details", [], DETAILS);
  const details: Details = {};
  for (const key of DETAILS) present(details, { [key]: optionalText(r, key, `booking's ${key}`) });
  return Object.freeze(details);
}

/**
 * Reads a booking of any kind, checking only its form. A kind the package does not hold is refused
 * with `unknown` (`unknown-kind` for a caller's booking, and `malformed` for stored text). `extra`
 * names keys allowed beside the booking's own, such as `format` in the text form.
 */
export function readBooking(value: unknown, time: TimeReader, unknown: "unknown-kind" | "malformed", extra: readonly string[] = []): Booking {
  if (!isRecord(value)) fail("malformed", "The booking is not an object.");
  if (typeof value.kind !== "string") fail("malformed", "The booking needs a kind, as text.");
  const ops = kindOf(value.kind);
  if (!ops) fail(unknown, unknownKind(value.kind));
  const r = fields(value, `${value.kind} booking`, ["kind", "id", "revision", "travellers", "details", ...ops.required], [...ops.optional, ...extra]);
  const common: Common = {
    id: text(r.id, "booking's identifier"),
    revision: wholeNumber(r.revision, "booking's revision"),
    travellers: Object.freeze(list(r.travellers, "booking's travellers").map((t) => text(t, "traveller"))),
    details: readDetails(r.details),
  };
  return Object.freeze({ kind: value.kind, ...common, ...ops.read(r, time) }) as Booking;
}

export function bookingToJson(booking: Booking): { [key: string]: Json } {
  return {
    ...opsOf(booking).toJson(booking),
    format: 1,
    kind: booking.kind,
    id: booking.id,
    revision: booking.revision,
    travellers: plain(booking.travellers),
    details: plain(booking.details),
  };
}
