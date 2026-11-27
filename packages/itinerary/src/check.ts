// The checks of a stretch (spec §4.3), of a firm item (§4.4), and of identifiers, text and dates (§3.3).

import { create, span, type TripTime } from "@itinero/trip-time";
import { buildDay, fields, isDay, isRecord, localDates } from "./build.ts";
import { isCountry } from "./countries.ts";
import { daysOf } from "./dates.ts";
import { fail, type Dates, type FirmItem, type Place, type Stretch, type When } from "./types.ts";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TEXT = 200;
const MAX_STRETCH_DAYS = 366;

export function checkId(id: string, what: string): void {
  if (!ID.test(id)) fail("bad-id", `The ${what} ${JSON.stringify(id)} is not 1 to 64 letters, digits, hyphens or underscores.`);
}

export function checkText(value: string, what: string): void {
  if (value.trim() === "") fail("bad-text", `The ${what} is empty.`);
  if (value.length > MAX_TEXT) fail("bad-text", `The ${what} is longer than ${MAX_TEXT} characters.`);
}

/** A real date in range, as days from 1970-01-01, or a refusal with `invalid-date`. */
export function checkDate(date: string, what: string): number {
  const days = daysOf(date);
  if (days === undefined) fail("invalid-date", `The ${what}, ${date}, is not a date from 1970-01-01 to 9999-12-31.`);
  return days;
}

/** A first and a last day, in order. */
export function checkDates(dates: Dates, what: string): void {
  const first = checkDate(dates.first, `${what}' first day`);
  const last = checkDate(dates.last, `${what}' last day`);
  if (last < first) fail("stretch-order", `The ${what}' last day, ${dates.last}, is before the first, ${dates.first}.`);
}

export function checkPlace(place: Place): void {
  if (!isCountry(place.country)) fail("unknown-country", `The country ${JSON.stringify(place.country)} is not one the itinerary knows.`);
  if (place.name !== undefined) checkText(place.name, "place's name");
}

export function checkStretchDates(first: string, last: string): void {
  const a = checkDate(first, "stretch's first day");
  const b = checkDate(last, "stretch's last day");
  if (b < a) fail("stretch-order", `The stretch's last day, ${last}, is before its first, ${first}.`);
  if (b - a + 1 > MAX_STRETCH_DAYS) {
    fail("stretch-length", `The stretch covers ${b - a + 1} days, and a stretch covers at most ${MAX_STRETCH_DAYS}.`);
  }
}

export function checkStretch(stretch: Stretch): void {
  checkId(stretch.id, "stretch's identifier");
  checkStretchDates(stretch.first, stretch.last);
  checkPlace(stretch.place);
  if (stretch.page !== undefined) checkId(stretch.page, "stretch's page");
}

/**
 * Reads a When a caller gave, checking it (§4.4): a Day's date is checked, trip-time's kinds with
 * no time are refused with `date-only`, and every other value goes through trip-time's create.
 */
export function readCallerWhen(value: unknown, what: string): When {
  if (isRecord(value) && value.kind === "day") {
    const r = fields(value, what, ["kind", "date"]);
    const day = buildDay(r.date);
    checkDate(day.date, `date of the ${what}`);
    return day;
  }
  if (isRecord(value) && (value.kind === "date" || value.kind === "tbd")) {
    fail("date-only", `The ${what} is a date with no time, which is written as a day.`);
  }
  if (!isRecord(value)) fail("malformed", `The ${what} is not an object.`);
  const made = create(value as TripTime);
  if (!made.ok) throw refusedBy(made.refusal);
  return made.value;
}

function refusedBy(refusal: { code: string; message: string; details?: Record<string, string> }): never {
  fail(refusal.code as never, refusal.message, refusal.details);
}

/** Checks a firm item whose `when` and `arrive` were read with readCallerWhen. */
export function checkFirm(item: FirmItem): void {
  checkId(item.id, "firm item's identifier");
  checkText(item.title, "firm item's title");
  if (item.page !== undefined) checkId(item.page, "firm item's page");
  if (item.address !== undefined) {
    checkText(item.address, "firm item's address");
    if (/[\n\r]/.test(item.address)) fail("bad-text", "The firm item's address holds a line end, and an address is one line.");
  }
  const travel = item.travel;
  if (!travel) return;
  checkPlace(travel.from);
  checkPlace(travel.to);
  const arrive = travel.arrive;
  if (!arrive) return;
  if (!isDay(item.when) && !isDay(arrive)) {
    const made = span(item.when, arrive);
    if (!made.ok && made.refusal.code === "span-order") travelOrder();
    if (!made.ok) refusedBy(made.refusal);
  } else if (localDates(arrive).last < localDates(item.when).first) {
    travelOrder();
  }
}

function travelOrder(): never {
  fail("travel-order", "The travel arrives before it leaves, whatever times its ends turn out to be.");
}

