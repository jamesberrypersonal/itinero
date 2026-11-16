// The text form of a booking and of a change (spec/bookings/list.md §4.5, §5.1): JSON with its
// keys in sorted order, no white space, and every time in trip-time's text form.

import { bookingToJson, readBooking } from "./booking.ts";
import { canonical, fields, isRecord, storedTime, text, wholeNumber, type Json } from "./form.ts";
import { attempt, fail, type Booking, type Change, type Result } from "./types.ts";

export function bookingToText(booking: Booking): string {
  return canonical(bookingToJson(booking));
}

function changeToJson(change: Change): Json {
  switch (change.op) {
    case "add":
      return { op: change.op, booking: bookingToJson(change.booking) };
    case "change":
      return { op: change.op, booking: bookingToJson(change.booking), base: change.base };
    case "remove":
      return { op: change.op, id: change.id, base: change.base };
  }
}

export function changeToText(change: Change): string {
  return canonical(changeToJson(change));
}

function readJson(source: string, what: string): unknown {
  if (typeof source !== "string") fail("malformed", `The ${what} is not text.`);
  try {
    return JSON.parse(source);
  } catch {
    fail("malformed", `The ${what} is not JSON.`);
  }
}

/** Reads a booking's JSON, checking its format, without applying the checks of §4.1 again. */
function readStored(json: unknown): Booking {
  if (isRecord(json) && "format" in json && json.format !== 1) {
    fail("unknown-format", `The booking is written in format ${JSON.stringify(json.format)}, and the bookings list reads format 1.`);
  }
  if (isRecord(json) && json.format === undefined) fail("malformed", "The booking needs the field format.");
  return readBooking(json, storedTime, "malformed", ["format"]);
}

export function bookingFromText(source: string): Result<Booking> {
  return attempt(() => readStored(readJson(source, "booking")));
}

export function changeFromText(source: string): Result<Change> {
  return attempt(() => {
    const json = readJson(source, "change");
    if (!isRecord(json)) fail("malformed", "The change is not an object.");
    switch (json.op) {
      case "add": {
        const r = fields(json, "change", ["op", "booking"]);
        return Object.freeze({ op: "add" as const, booking: readStored(r.booking) });
      }
      case "change": {
        const r = fields(json, "change", ["op", "booking", "base"]);
        return Object.freeze({ op: "change" as const, booking: readStored(r.booking), base: wholeNumber(r.base, "change's base") });
      }
      case "remove": {
        const r = fields(json, "change", ["op", "id", "base"]);
        return Object.freeze({ op: "remove" as const, id: text(r.id, "booking's identifier"), base: wholeNumber(r.base, "change's base") });
      }
      default:
        fail("malformed", `The change ${JSON.stringify(json.op)} is not one the bookings list makes.`);
    }
  });
}
