// Reading fields into the frozen values a booking holds. These check only the form of §3.3 and
// §5.1 of spec/bookings/list.md, failing with `malformed`. The checks of §4.1 are in check.ts and in
// each kind's module, since reading stored text never applies them again (§4.5).

import { parse, type TripTime } from "@itinero/trip-time";
import { fail, refusedBy } from "./types.ts";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * Reads a time: from the fields a caller gave, left for a kind's check to pass to trip-time's
 * create, or from its text form, read with trip-time's parse.
 */
export type TimeReader = (value: unknown, what: string) => TripTime;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks a value is an object holding only the keys given, with every required key present. */
export function fields(value: unknown, what: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!isRecord(value)) fail("malformed", `The ${what} is not an object.`);
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) fail("malformed", `The ${what} has no field ${key}.`);
  }
  for (const key of required) {
    if (!(key in value) || value[key] === undefined) fail("malformed", `The ${what} needs the field ${key}.`);
  }
  return value;
}

export function text(value: unknown, what: string): string {
  if (typeof value !== "string") fail("malformed", `The ${what} is not text.`);
  return value;
}

export function optionalText(record: Record<string, unknown>, key: string, what: string): string | undefined {
  return record[key] === undefined ? undefined : text(record[key], what);
}

export function wholeNumber(value: unknown, what: string): number {
  if (!Number.isSafeInteger(value)) fail("malformed", `The ${what} is not a whole number.`);
  return value as number;
}

export function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) fail("malformed", `The ${what} is not a list.`);
  return value;
}

/** A time a caller gave: its form is left to trip-time's create, which a kind's check calls. */
export const callerTime: TimeReader = (value, what) => {
  if (!isRecord(value)) fail("malformed", `The ${what} is not a time.`);
  return value as TripTime;
};

/** A time in its text form, read with trip-time's parse, which never refuses a time for falling in a gap. */
export const storedTime: TimeReader = (value, what) => {
  const parsed = parse(text(value, what));
  if (!parsed.ok) refusedBy(parsed.refusal);
  return parsed.value;
};

/** Sets each key whose value is present, so an absent field is left out, not written as undefined. */
export function present<T extends object>(target: T, extra: Record<string, unknown>): T {
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) (target as Record<string, unknown>)[key] = value;
  return target;
}

/** JSON with every object's keys in sorted order, so the same value always gives the same text. */
export function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function plain(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
