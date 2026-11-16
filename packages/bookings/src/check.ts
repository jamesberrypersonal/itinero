// The checks every kind shares: identifiers, text fields, times, and a time's last local date
// (spec/bookings/list.md §4.1, §4.3).

import { create, duration, span, type LocalDate, type TripTime } from "@itinero/trip-time";
import { fail, refusedBy } from "./types.ts";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** 366 days, the longest a journey or an activity may take. */
export const MAX_MINUTES = 366 * 24 * 60;

export function checkId(id: string, what: string): void {
  if (!ID.test(id)) fail("bad-id", `The ${what} ${JSON.stringify(id)} is not 1 to 64 letters, digits, hyphens or underscores.`);
}

/** Counts Unicode code points, not UTF-16 code units. */
export function length(value: string): number {
  let count = 0;
  for (const _ of value) count += 1;
  return count;
}

/** Trims a text field and checks it is 1 to `max` characters, giving it back trimmed. */
export function checkText(value: string, what: string, max: number, details?: Record<string, string>): string {
  const trimmed = value.trim();
  if (trimmed === "") fail("bad-text", `The ${what} is empty.`, details);
  if (length(trimmed) > max) fail("bad-text", `The ${what} is longer than ${max} characters.`, details);
  return trimmed;
}

export function optionalCheckText(value: string | undefined, what: string, max: number): string | undefined {
  return value === undefined ? undefined : checkText(value, what, max);
}

/** Passes a time through trip-time's create, giving back the value it makes or its refusal unchanged. */
export function checkTime(value: TripTime, details?: Record<string, string>): TripTime {
  const made = create(value);
  if (!made.ok) refusedBy(made.refusal, details);
  return made.value;
}

/** The last local date of a value: a window's endDate, and every other kind's date (§4.3). */
export function lastDate(value: TripTime): LocalDate {
  return value.kind === "window" ? value.endDate : value.date;
}

/**
 * Whether `end` certainly comes before `start`, in the time that really passes. Any other refusal
 * of trip-time's span, such as no rules loaded, is passed on unchanged.
 */
export function certainlyBefore(start: TripTime, end: TripTime): boolean {
  const made = span(start, end);
  if (made.ok) return false;
  if (made.refusal.code === "span-order") return true;
  refusedBy(made.refusal);
}

/** The longest the span from `start` to `end` can take, in minutes. */
export function longest(start: TripTime, end: TripTime): number {
  return duration({ start, end }).longest;
}
