// The checks every operation shares: the form of a value (§3.3), identifiers, and the limits of a
// title and an item's text (§4.2).

import { fail } from "./types.ts";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
// A line feed, a carriage return, or a character Unicode classes as a line or paragraph separator (§3.3).
const LINE_BREAK = /[\n\r\p{Zl}\p{Zp}]/u;
export const MAX_TITLE = 200;
export const MAX_TEXT = 500;
export const MAX_ITEMS = 200;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks a value is an object holding the keys given, with every required key present. A list's
 * entries may hold more, since a caller passes whole checklists as a list (§3.3).
 */
export function fields(
  value: unknown,
  what: string,
  required: readonly string[],
  optional: readonly string[] = [],
  more = false,
): Record<string, unknown> {
  if (!isRecord(value)) fail("malformed", `The ${what} is not an object.`);
  if (!more) {
    for (const key of Object.keys(value)) {
      if (!required.includes(key) && !optional.includes(key)) fail("malformed", `The ${what} has no field ${key}.`);
    }
  }
  for (const key of required) {
    if (value[key] === undefined) fail("malformed", `The ${what} needs the field ${key}.`);
  }
  return value;
}

export function text(value: unknown, what: string): string {
  if (typeof value !== "string") fail("malformed", `The ${what} is not text.`);
  return value;
}

/** A character is one Unicode code point (§3.3). */
export function length(value: string): number {
  let count = 0;
  for (const _ of value) count++;
  return count;
}

export function checkId(id: unknown, what: string): string {
  const value = text(id, what);
  if (!ID.test(value)) fail("bad-id", `The ${what} ${JSON.stringify(value)} is not 1 to 64 letters, digits, hyphens or underscores.`);
  return value;
}

/** Trims a title, and checks it (§4.2). */
export function checkTitle(title: unknown): string {
  const trimmed = text(title, "checklist's title").trim();
  if (trimmed === "") fail("bad-title", "The checklist's title is empty.");
  if (LINE_BREAK.test(trimmed)) fail("bad-title", "The checklist's title holds a line break.");
  if (length(trimmed) > MAX_TITLE) fail("bad-title", `The checklist's title is longer than ${MAX_TITLE} characters.`);
  return trimmed;
}

/** Trims an item's text, and checks it (§4.2). */
export function checkText(value: unknown): string {
  const trimmed = text(value, "item's text").trim();
  if (trimmed === "") fail("bad-text", "The item's text is empty.");
  if (LINE_BREAK.test(trimmed)) fail("bad-text", "The item's text holds a line break.");
  if (length(trimmed) > MAX_TEXT) fail("bad-text", `The item's text is longer than ${MAX_TEXT} characters.`);
  return trimmed;
}
