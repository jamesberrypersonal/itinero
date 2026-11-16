// Checking the form of a grant change and of a trip's grants (spec §3.3, §5.1), so that every
// function refuses with `malformed` what is not in that form.

import { fail, LEVELS, type Grant, type GrantChange, type Grants, type Id, type Level, type TripLevel } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks a value is an object holding exactly the keys given. */
export function fields(value: unknown, what: string, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value)) fail("malformed", `The ${what} is not an object.`);
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) fail("malformed", `The ${what} has no field ${key}.`);
  }
  for (const key of keys) {
    if (value[key] === undefined) fail("malformed", `The ${what} needs the field ${key}.`);
  }
  return value;
}

export function id(value: unknown, what: string): Id {
  if (typeof value !== "string" || value === "") fail("malformed", `The ${what} is not an identifier.`);
  return value;
}

export function level(value: unknown, what: string): Level {
  if (typeof value !== "string" || !LEVELS.includes(value as Level)) fail("malformed", `The ${what} is not none, view or edit.`);
  return value as Level;
}

export function tripLevel(value: unknown, what: string): TripLevel {
  if (value === "none") fail("malformed", `A traveller's access to the trip is view or edit, never none. To take a traveller off the trip, remove them.`);
  if (value !== "view" && value !== "edit") fail("malformed", `The ${what} is not view or edit.`);
  return value;
}

/** A grant change, checked and frozen. */
export function readChange(value: unknown): GrantChange {
  const op = isRecord(value) ? value.op : undefined;
  switch (op) {
    case "add": {
      const r = fields(value, "change", ["op", "traveller", "trip", "calendar"]);
      return Object.freeze({ op, traveller: id(r.traveller, "traveller"), trip: tripLevel(r.trip, "access to the trip"), calendar: level(r.calendar, "access to the calendar") });
    }
    case "remove": {
      const r = fields(value, "change", ["op", "traveller"]);
      return Object.freeze({ op, traveller: id(r.traveller, "traveller") });
    }
    case "trip": {
      const r = fields(value, "change", ["op", "traveller", "level"]);
      return Object.freeze({ op, traveller: id(r.traveller, "traveller"), level: tripLevel(r.level, "access to the trip") });
    }
    case "calendar": {
      const r = fields(value, "change", ["op", "traveller", "level"]);
      return Object.freeze({ op, traveller: id(r.traveller, "traveller"), level: level(r.level, "access to the calendar") });
    }
    case "page": {
      const r = fields(value, "change", ["op", "traveller", "page", "level"]);
      return Object.freeze({ op, traveller: id(r.traveller, "traveller"), page: id(r.page, "page"), level: level(r.level, "access to the page") });
    }
    case "unpage": {
      const r = fields(value, "change", ["op", "traveller", "page"]);
      return Object.freeze({ op, traveller: id(r.traveller, "traveller"), page: id(r.page, "page") });
    }
    default:
      fail("malformed", `The change ${JSON.stringify(op)} is not one the permissions component makes.`);
  }
}

/** Orders by identifier, by code unit, the same on every device. */
export function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function makeGrant(traveller: Id, trip: TripLevel, calendar: Level, pages: readonly { page: Id; level: Level }[]): Grant {
  const sorted = [...pages].sort((a, b) => byId(a.page, b.page)).map((e) => Object.freeze({ page: e.page, level: e.level }));
  return Object.freeze({ traveller, trip, calendar, pages: Object.freeze(sorted) });
}

export function makeGrants(trip: Id, revision: number, grants: readonly Grant[]): Grants {
  const sorted = [...grants].sort((a, b) => byId(a.traveller, b.traveller));
  return Object.freeze({ format: 1, trip, revision, grants: Object.freeze(sorted) });
}

/** A trip's grants, checked and frozen. `unknown-format` for a format other than 1. */
export function readGrants(value: unknown): Grants {
  if (isRecord(value) && value.format !== undefined && value.format !== 1) {
    fail("unknown-format", `The grants are written in format ${JSON.stringify(value.format)}, and the permissions component reads format 1.`);
  }
  const r = fields(value, "grants", ["format", "trip", "revision", "grants"]);
  if (!Number.isSafeInteger(r.revision) || (r.revision as number) < 1) fail("malformed", "The grants' revision is not a whole number from 1.");
  if (!Array.isArray(r.grants)) fail("malformed", "The grants' list of travellers is not a list.");
  const travellers = new Set<Id>();
  const grants = r.grants.map((g: unknown) => {
    const f = fields(g, "grant", ["traveller", "trip", "calendar", "pages"]);
    const traveller = id(f.traveller, "grant's traveller");
    if (travellers.has(traveller)) fail("malformed", `The grants hold the traveller ${traveller} twice.`);
    travellers.add(traveller);
    if (!Array.isArray(f.pages)) fail("malformed", "A grant's exceptions are not a list.");
    const seen = new Set<Id>();
    const pages = f.pages.map((e: unknown) => {
      const x = fields(e, "exception", ["page", "level"]);
      const page = id(x.page, "exception's page");
      if (seen.has(page)) fail("malformed", `A grant holds two exceptions for the page ${page}.`);
      seen.add(page);
      return { page, level: level(x.level, "exception's level") };
    });
    return makeGrant(traveller, tripLevel(f.trip, "grant's access to the trip"), level(f.calendar, "grant's access to the calendar"), pages);
  });
  return makeGrants(id(r.trip, "grants' trip"), r.revision as number, grants);
}
