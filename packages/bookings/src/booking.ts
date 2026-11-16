// The table every kind is reached through (spec/bookings/list.md §4), and reading and writing a
// booking whatever its kind (§3.3, §5.1).

import { activityOps } from "./activity.ts";
import { flightOps } from "./flight.ts";
import { isRecord, plain, type Json, type TimeReader } from "./form.ts";
import { journeyOps } from "./journey.ts";
import { readAs, type KindOps } from "./kind.ts";
import { stayOps } from "./stay.ts";
import { fail, type Booking } from "./types.ts";

type Table = { [K in Booking["kind"]]: KindOps<Extract<Booking, { kind: K }>> };

const KINDS: Table = { flight: flightOps, stay: stayOps, journey: journeyOps, activity: activityOps };

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
  return `The kind ${JSON.stringify(kind)} is not one the bookings package holds, which are ${KIND_NAMES.join(", ")}.`;
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
  return readAs(value, ops, time, extra);
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
