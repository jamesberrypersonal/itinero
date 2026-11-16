// The bookings list: check (spec/bookings/list.md §4.1), touches and apply (§4.2), extent and label
// (§4.3), and order, onDate and notOver (§4.4).

import { sort, span, type LocalDate, type TripTime } from "@itinero/trip-time";
import { opsOf, readBooking } from "./booking.ts";
import { checkId, checkText, lastDate, length } from "./check.ts";
import { callerTime, fields, isRecord, text, wholeNumber } from "./form.ts";
import { bookingToText } from "./text.ts";
import { attempt, fail, type Booking, type Change, type Details, type Extent, type Result, type Touches, type TravellerId } from "./types.ts";

const MAX_TRAVELLERS = 50;
const MAX_LINK = 2000;

const LIMITS = { reference: 64, provider: 200, notes: 4000 } as const;
const NAMES = { reference: "booking's reference", provider: "booking's provider", notes: "text of the booking's notes" } as const;

function checkLink(link: string): string {
  const trimmed = link.trim();
  let protocol: string | undefined;
  try {
    protocol = new URL(trimmed).protocol;
  } catch {
    protocol = undefined;
  }
  if (protocol !== "https:") fail("bad-link", `The booking's link ${JSON.stringify(trimmed)} is not a secure web address, starting https:.`);
  if (length(trimmed) > MAX_LINK) fail("bad-link", `The booking's link is longer than ${MAX_LINK} characters.`);
  return trimmed;
}

function checkDetails(details: Details): Details {
  const checked: Details = {};
  for (const key of ["reference", "provider", "notes"] as const) {
    const value = details[key];
    if (value !== undefined) checked[key] = checkText(value, NAMES[key], LIMITS[key]);
  }
  if (details.link !== undefined) checked.link = checkLink(details.link);
  if (details.page !== undefined) {
    checkId(details.page, "booking's page");
    checked.page = details.page;
  }
  return Object.freeze(checked);
}

function checkTravellers(travellers: readonly TravellerId[]): readonly TravellerId[] {
  if (travellers.length === 0) fail("no-travellers", "The booking names no traveller, and names at least one.");
  if (travellers.length > MAX_TRAVELLERS) {
    fail("too-many-travellers", `The booking names ${travellers.length} travellers, and names at most ${MAX_TRAVELLERS}.`);
  }
  const seen = new Set<TravellerId>();
  for (const traveller of travellers) {
    if (seen.has(traveller)) fail("duplicate-traveller", `The booking names the traveller ${JSON.stringify(traveller)} twice.`, { traveller });
    seen.add(traveller);
  }
  return Object.freeze([...travellers].sort());
}

/** The checks of §4.1, on a booking whose form has been read. */
function checkRead(booking: Booking): Booking {
  const ops = opsOf(booking);
  checkId(booking.id, "booking's identifier");
  const travellers = checkTravellers(booking.travellers);
  const details = checkDetails(booking.details);
  return Object.freeze(ops.check(Object.freeze({ ...booking, travellers, details })));
}

export function check(booking: Booking): Result<Booking> {
  return attempt(() => checkRead(readBooking(booking, callerTime, "unknown-kind")));
}

const SHAPES: Record<Change["op"], readonly string[]> = {
  add: ["booking"],
  change: ["booking", "base"],
  remove: ["id", "base"],
};

function sorted(travellers: readonly TravellerId[] | undefined): readonly TravellerId[] {
  return Object.freeze(Array.isArray(travellers) ? [...travellers].sort() : []);
}

export function touches(held: Booking | undefined, change: Change): Touches {
  const none: readonly TravellerId[] = Object.freeze([]);
  switch (change.op) {
    case "add":
      return Object.freeze({ id: change.booking.id, before: none, after: sorted(change.booking.travellers) });
    case "change":
      return Object.freeze({ id: change.booking.id, before: sorted(held?.travellers), after: sorted(change.booking.travellers) });
    case "remove":
      return Object.freeze({ id: change.id, before: sorted(held?.travellers), after: none });
  }
}

function withRevision(booking: Booking, revision: number): Booking {
  return Object.freeze({ ...booking, revision });
}

function staleOrUnknown(held: Booking | undefined, id: string, base: number, what: string): Booking {
  if (!held || held.id !== id) fail("unknown-id", `The trip holds no booking ${JSON.stringify(id)} to ${what}.`);
  if (base !== held.revision) {
    fail(
      "stale",
      `The booking was changed by someone else since revision ${base}, and is now at revision ${held.revision}.`,
      { booking: bookingToText(held), revision: String(held.revision) },
    );
  }
  return held;
}

function applyChecked(held: Booking | undefined, input: Change): Booking | undefined {
  const op = (input as { op?: unknown } | null)?.op;
  if (typeof op !== "string" || !Object.hasOwn(SHAPES, op)) fail("malformed", `The change ${JSON.stringify(op)} is not one the bookings list makes.`);
  const r = fields(input, `change ${op}`, ["op", ...SHAPES[op as Change["op"]]]);

  switch (op as Change["op"]) {
    case "add": {
      if (held !== undefined) fail("duplicate-id", `The trip already holds a booking ${JSON.stringify(held.id)}.`);
      return withRevision(checkRead(readBooking(r.booking, callerTime, "unknown-kind")), 1);
    }
    case "change": {
      const base = wholeNumber(r.base, "change's base");
      if (!isRecord(r.booking)) fail("malformed", "The booking is not an object.");
      const id = text(r.booking.id, "booking's identifier");
      if (!held || held.id !== id) fail("unknown-id", `The trip holds no booking ${JSON.stringify(id)} to change.`);
      if (r.booking.kind !== held.kind) {
        fail("kind-change", `The booking is a ${held.kind}, and keeps its kind for as long as it is held.`);
      }
      const current = staleOrUnknown(held, id, base, "change");
      return withRevision(checkRead(readBooking(r.booking, callerTime, "unknown-kind")), current.revision + 1);
    }
    case "remove": {
      const id = text(r.id, "booking's identifier");
      staleOrUnknown(held, id, wholeNumber(r.base, "change's base"), "remove");
      return undefined;
    }
  }
}

export function apply(held: Booking | undefined, change: Change): Result<Booking | undefined> {
  return attempt(() => applyChecked(held, change));
}

export function extent(booking: Booking): Extent {
  const { starts, ends } = opsOf(booking).times(booking);
  const result: Extent = { starts, first: starts.date, last: lastDate(ends ?? starts) };
  if (ends) result.ends = ends;
  return Object.freeze(result);
}

export function label(booking: Booking): string {
  return opsOf(booking).label(booking);
}

function codePoints(value: string): number[] {
  const points: number[] = [];
  for (const char of value) points.push(char.codePointAt(0)!);
  return points;
}

function compareCodePoints(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

export function order(bookings: readonly Booking[]): Booking[] {
  const keyed = bookings.map((booking) => ({ booking, label: codePoints(label(booking)), starts: opsOf(booking).times(booking).starts }));
  keyed.sort((a, b) => compareCodePoints(a.label, b.label) || (a.booking.id < b.booking.id ? -1 : a.booking.id > b.booking.id ? 1 : 0));

  // trip-time's sort gives back the values it is given, keeping tied values in the order given, so
  // each value is matched to its booking by identity, in turn.
  const waiting = new Map<TripTime, Booking[]>();
  for (const { booking, starts } of keyed) {
    const queue = waiting.get(starts);
    if (queue) queue.push(booking);
    else waiting.set(starts, [booking]);
  }
  const taken = new Map<TripTime, number>();
  const result = sort(keyed.map((k) => k.starts)).map((starts) => {
    const at = taken.get(starts) ?? 0;
    taken.set(starts, at + 1);
    return waiting.get(starts)![at]!;
  });
  return Object.freeze(result) as Booking[];
}

export function onDate(bookings: readonly Booking[], date: LocalDate): Booking[] {
  return Object.freeze(
    order(bookings).filter((booking) => {
      const { first, last } = extent(booking);
      return first <= date && last >= date;
    }),
  ) as Booking[];
}

export function notOver(bookings: readonly Booking[], now: TripTime): Booking[] {
  return Object.freeze(
    order(bookings).filter((booking) => {
      const { starts, ends } = opsOf(booking).times(booking);
      const made = span(now, ends ?? starts);
      return made.ok || made.refusal.code !== "span-order";
    }),
  ) as Booking[];
}
