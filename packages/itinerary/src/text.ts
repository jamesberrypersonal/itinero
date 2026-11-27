// The text form of a trip and of a change (spec §4.7, §5.1): JSON with its keys in sorted order,
// every time in trip-time's text form, and a Day as { "day": "YYYY-MM-DD" }.

import { parse, toText } from "@itinero/trip-time";
import {
  buildDates,
  buildDay,
  buildFirm,
  buildPlace,
  buildStretch,
  buildTravellerDates,
  buildTrip,
  fields,
  isRecord,
  text,
} from "./build.ts";
import { attempt, fail, type Change, type FirmItem, type Result, type Trip, type When } from "./types.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** JSON with every object's keys in sorted order, so the same value always gives the same text. */
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function plain(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function whenToJson(when: When): Json {
  return when.kind === "day" ? { day: when.date } : toText(when);
}

export function firmToJson(item: FirmItem): Json {
  const json: { [key: string]: Json } = { id: item.id, revision: item.revision, title: item.title, when: whenToJson(item.when) };
  if (item.travel) {
    const travel: { [key: string]: Json } = { from: plain(item.travel.from), to: plain(item.travel.to), by: item.travel.by };
    if (item.travel.arrive) travel.arrive = whenToJson(item.travel.arrive);
    json.travel = travel;
  }
  if (item.page !== undefined) json.page = item.page;
  if (item.address !== undefined) json.address = item.address;
  return json;
}

function tripToJson(trip: Trip): Json {
  const json: { [key: string]: Json } = {
    format: trip.format,
    id: trip.id,
    name: trip.name,
    revision: trip.revision,
    travellers: plain(trip.travellers),
    stretches: plain(trip.stretches),
    firm: trip.firm.map(firmToJson),
  };
  if (trip.dates) json.dates = plain(trip.dates);
  return json;
}

function changeToJson(change: Change): Json {
  switch (change.op) {
    case "add-firm":
      return { op: change.op, item: firmToJson(change.item) };
    case "change-firm":
      return { op: change.op, item: firmToJson(change.item), base: change.base };
    default:
      return plain(change);
  }
}

export function tripToText(trip: Trip): string {
  return canonical(tripToJson(trip));
}

export function changeToText(change: Change): string {
  return canonical(changeToJson(change));
}

/** Reads a stored time with trip-time's parse, which never refuses a time for falling in a gap. */
function readStoredWhen(value: unknown, what: string): When {
  if (isRecord(value)) {
    const r = fields(value, what, ["day"]);
    return buildDay(r.day);
  }
  const parsed = parse(text(value, what));
  if (!parsed.ok) fail(parsed.refusal.code as never, parsed.refusal.message, parsed.refusal.details);
  return parsed.value;
}

function readJson(source: string, what: string): unknown {
  if (typeof source !== "string") fail("malformed", `The ${what} is not text.`);
  try {
    return JSON.parse(source);
  } catch {
    fail("malformed", `The ${what} is not JSON.`);
  }
}

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) fail("malformed", `The ${what} is not a list.`);
  return value;
}

export function tripFromText(source: string): Result<Trip> {
  return attempt(() => {
    const json = readJson(source, "trip");
    if (isRecord(json) && "format" in json && json.format !== 1) {
      fail("unknown-format", `The trip is written in format ${JSON.stringify(json.format)}, and the itinerary reads format 1.`);
    }
    const r = fields(json, "trip", ["format", "id", "name", "revision", "travellers", "stretches", "firm"], ["dates"]);
    if (!Number.isSafeInteger(r.revision)) fail("malformed", "The trip's revision is not a whole number.");
    return buildTrip({
      id: text(r.id, "trip's identifier"),
      name: text(r.name, "trip's name"),
      revision: r.revision as number,
      dates: r.dates === undefined ? undefined : buildDates(r.dates, "trip's dates"),
      travellers: list(r.travellers, "trip's travellers").map(buildTravellerDates),
      stretches: list(r.stretches, "trip's stretches").map(buildStretch),
      firm: list(r.firm, "trip's firm items").map((item) => buildFirm(item, readStoredWhen)),
    });
  });
}

export function changeFromText(source: string): Result<Change> {
  return attempt(() => {
    const json = readJson(source, "change");
    if (!isRecord(json)) fail("malformed", "The change is not an object.");
    switch (json.op) {
      case "add-firm": {
        const r = fields(json, "change", ["op", "item"]);
        return Object.freeze({ op: "add-firm" as const, item: buildFirm(r.item, readStoredWhen) });
      }
      case "change-firm": {
        const r = fields(json, "change", ["op", "item", "base"]);
        if (!Number.isSafeInteger(r.base)) fail("malformed", "The change's base is not a whole number.");
        return Object.freeze({ op: "change-firm" as const, item: buildFirm(r.item, readStoredWhen), base: r.base as number });
      }
      case "rename":
        return Object.freeze({ op: "rename" as const, name: text(fields(json, "change", ["op", "name"]).name, "trip's name") });
      case "trip-dates":
        return Object.freeze({ op: "trip-dates" as const, dates: buildDates(fields(json, "change", ["op", "dates"]).dates, "trip's dates") });
      case "traveller-dates": {
        const r = fields(json, "change", ["op", "traveller"], ["dates"]);
        const traveller = text(r.traveller, "traveller");
        return Object.freeze(
          r.dates === undefined
            ? { op: "traveller-dates" as const, traveller }
            : { op: "traveller-dates" as const, traveller, dates: buildDates(r.dates, "traveller's dates") },
        );
      }
      case "pencil":
        return Object.freeze({ op: "pencil" as const, stretch: buildStretch(fields(json, "change", ["op", "stretch"]).stretch) });
      case "move": {
        const r = fields(json, "change", ["op", "id", "first", "last"]);
        return Object.freeze({
          op: "move" as const,
          id: text(r.id, "stretch's identifier"),
          first: text(r.first, "first day"),
          last: text(r.last, "last day"),
        });
      }
      case "re-place": {
        const r = fields(json, "change", ["op", "id", "place"]);
        return Object.freeze({ op: "re-place" as const, id: text(r.id, "stretch's identifier"), place: buildPlace(r.place) });
      }
      case "remove-stretch":
      case "remove-firm": {
        const r = fields(json, "change", ["op", "id"]);
        return Object.freeze({ op: json.op, id: text(r.id, "identifier") });
      }
      default:
        fail("malformed", `The change ${JSON.stringify(json.op)} is not one the itinerary makes.`);
    }
  });
}
