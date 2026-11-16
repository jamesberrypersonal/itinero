// The types of the programming interface (spec §3.3), and the refusals of its table. Refusal and
// Result are trip-time's, imported as types only, so the package's one runtime dependency is
// @itinero/pages.

import type { Refusal, Result } from "@itinero/trip-time";
import type { Change as PageChange, Pages } from "@itinero/pages";

export type { Refusal, Result } from "@itinero/trip-time";
export type { PageChange };

/** As @itinero/pages gives it. */
export type Id = string;
export type Level = "none" | "view" | "edit";
export type TripLevel = "view" | "edit";

/** A traveller's grants: their access to the trip and the calendar, and their exceptions, by page. */
export type Grant = { traveller: Id; trip: TripLevel; calendar: Level; pages: readonly { page: Id; level: Level }[] };
/** A trip's grants, ordered by traveller. */
export type Grants = { format: 1; trip: Id; revision: number; grants: readonly Grant[] };

/** The caller gives it, from access/membership. */
export type Who = { traveller: Id; admin: boolean };

export type GrantChange =
  | { op: "add"; traveller: Id; trip: TripLevel; calendar: Level }
  | { op: "remove"; traveller: Id }
  | { op: "trip"; traveller: Id; level: TripLevel }
  | { op: "calendar"; traveller: Id; level: Level }
  | { op: "page"; traveller: Id; page: Id; level: Level }
  | { op: "unpage"; traveller: Id; page: Id };

export type Request =
  | { kind: "read-page"; page: Id }
  | { kind: "change-page"; change: PageChange }
  | { kind: "read-buried"; page: Id }
  | { kind: "read-calendar" }
  | { kind: "change-calendar" }
  | { kind: "read-booking"; travellers: readonly Id[] }
  | { kind: "change-booking"; travellers: readonly Id[] }
  | { kind: "grant"; change: GrantChange };

export type Seen = { pages: Pages; calendar: Level };

export type RefusalCode =
  | "malformed"
  | "not-on-trip"
  | "already-on-trip"
  | "unknown-page"
  | "hidden-above"
  | "no-view"
  | "no-edit"
  | "admin-only"
  | "unknown-format";

export const LEVELS: readonly Level[] = ["none", "view", "edit"];

/** Levels are ordered none, then view, then edit (§4). */
export function atLeast(level: Level, needed: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(needed);
}

class Refused extends Error {
  readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

export function fail(code: RefusalCode, message: string, details?: Record<string, string>): never {
  const c = code as Refusal["code"];
  throw new Refused(Object.freeze(details ? { code: c, message, details: Object.freeze({ ...details }) } : { code: c, message }));
}

/** Runs a check, turning a refusal it throws into a refused Result. */
export function attempt<T>(run: () => T): Result<T> {
  try {
    return Object.freeze({ ok: true as const, value: run() });
  } catch (error) {
    if (error instanceof Refused) return Object.freeze({ ok: false as const, refusal: error.refusal });
    throw error;
  }
}
