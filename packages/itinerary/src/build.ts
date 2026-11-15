// Reading fields into the frozen values a trip holds. These check only the form of §3.3 and §5.1,
// failing with `malformed`. The checks of §4.3 and §4.4 are in check.ts, since reading stored text
// never applies them again (§4.7).

import { fail, type Dates, type Day, type FirmItem, type Place, type Stretch, type Travel, type TravellerDates, type Trip, type Way, type When } from "./types.ts";

export const WAYS: readonly Way[] = ["flight", "train", "bus", "ferry", "car", "other"];

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

function optionalText(record: Record<string, unknown>, key: string, what: string): string | undefined {
  return record[key] === undefined ? undefined : text(record[key], what);
}

function wholeNumber(value: unknown, what: string): number {
  if (!Number.isSafeInteger(value)) fail("malformed", `The ${what} is not a whole number.`);
  return value as number;
}

export function buildPlace(value: unknown): Place {
  const r = fields(value, "place", ["country"], ["name"]);
  const country = text(r.country, "place's country");
  const name = optionalText(r, "name", "place's name");
  return Object.freeze(name === undefined ? { country } : { country, name });
}

export function buildStretch(value: unknown): Stretch {
  const r = fields(value, "stretch", ["id", "place", "first", "last"], ["page"]);
  const stretch: Stretch = {
    id: text(r.id, "stretch's identifier"),
    place: buildPlace(r.place),
    first: text(r.first, "stretch's first day"),
    last: text(r.last, "stretch's last day"),
  };
  const page = optionalText(r, "page", "stretch's page");
  if (page !== undefined) stretch.page = page;
  return Object.freeze(stretch);
}

export function buildDates(value: unknown, what: string): Dates {
  const r = fields(value, what, ["first", "last"]);
  return Object.freeze({ first: text(r.first, `${what}' first day`), last: text(r.last, `${what}' last day`) });
}

export function buildTravellerDates(value: unknown): TravellerDates {
  const r = fields(value, "traveller's entry", ["traveller", "dates"]);
  return Object.freeze({ traveller: text(r.traveller, "traveller"), dates: buildDates(r.dates, "traveller's dates") });
}

export function buildDay(date: unknown): Day {
  return Object.freeze({ kind: "day" as const, date: text(date, "day's date") });
}

/**
 * Reads a firm item. `readWhen` turns its `when` and `arrive` into values: from the fields a caller
 * gave, or from their text form.
 */
export function buildFirm(value: unknown, readWhen: (value: unknown, what: string) => When): FirmItem {
  const r = fields(value, "firm item", ["id", "revision", "title", "when"], ["travel", "page"]);
  const item: FirmItem = {
    id: text(r.id, "firm item's identifier"),
    revision: wholeNumber(r.revision, "firm item's revision"),
    title: text(r.title, "firm item's title"),
    when: readWhen(r.when, "firm item's time"),
  };
  if (r.travel !== undefined) {
    const t = fields(r.travel, "travel", ["from", "to", "by"], ["arrive"]);
    if (!WAYS.includes(t.by as Way)) fail("malformed", `The way of travelling ${JSON.stringify(t.by)} is not one of ${WAYS.join(", ")}.`);
    const travel: Travel = { from: buildPlace(t.from), to: buildPlace(t.to), by: t.by as Way };
    if (t.arrive !== undefined) travel.arrive = readWhen(t.arrive, "travel's arrival");
    item.travel = Object.freeze(travel);
  }
  const page = optionalText(r, "page", "firm item's page");
  if (page !== undefined) item.page = page;
  return Object.freeze(item);
}

export function withRevision(item: FirmItem, revision: number): FirmItem {
  return Object.freeze({ ...item, revision });
}

export function buildTrip(parts: {
  id: string;
  name: string;
  revision: number;
  dates: Dates | undefined;
  travellers: readonly TravellerDates[];
  stretches: readonly Stretch[];
  firm: readonly FirmItem[];
}): Trip {
  const trip: Trip = {
    format: 1,
    id: parts.id,
    name: parts.name,
    revision: parts.revision,
    travellers: Object.freeze([...parts.travellers].sort((a, b) => (a.traveller < b.traveller ? -1 : a.traveller > b.traveller ? 1 : 0))),
    stretches: Object.freeze([...parts.stretches]),
    firm: Object.freeze([...parts.firm]),
  };
  if (parts.dates) trip.dates = parts.dates;
  return Object.freeze(trip);
}

export function isDay(when: When): when is Day {
  return when.kind === "day";
}

/** The local date of a When, and the last local date it reaches (§4). */
export function localDates(when: When): { first: string; last: string } {
  if (when.kind === "window") return { first: when.date, last: when.endDate };
  return { first: when.date, last: when.date };
}

