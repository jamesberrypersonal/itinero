// The types of the trip store's programming interface (docs/spec/web/trip-store.md §3.3).

import type { Booking } from "@itinero/bookings";
import type { Dates, Trip } from "@itinero/itinerary";
import type { Pages } from "@itinero/pages";
import type { Grant, Grants, Level, TripLevel } from "@itinero/permissions";
import type { Checklist } from "@itinero/checklists";

export type Member = {
  account: string;
  name: string;
  admin: boolean;
  creator: boolean;
  joined: string;
  /** Present: a former member, removed then. */
  removed?: string;
};

export type Invitation = { id: string; email: string; trip: TripLevel; calendar: Level; expires: string };

export type Copy = {
  id: string;
  name: string;
  dates: Dates;
  /** The traveller's own dates. */
  mine: Dates;
  you: { admin: boolean; creator: boolean; grant: Grant };
  /** Absent: not granted. */
  calendar?: Trip;
  pages: Pages;
  /** went: the pages deleted with it. */
  graveyard: readonly { id: string; title: string; went: number }[];
  bookings: readonly Booking[];
  members: readonly Member[];
  /** The traveller's own checklists on the trip, in their order. */
  checklists: readonly Checklist[];
  /** An admin's copy alone: everyone's access. */
  grants?: Grants;
  /** An admin's copy alone: those still open. */
  invitations?: readonly Invitation[];
  sequence: number;
  /** Milliseconds since 1970 UTC. */
  caughtUp: number;
};

export type Summary = { id: string; name: string; dates: Dates; caughtUp: number };
export type Target = "calendar" | "pages" | "grants" | "bookings" | "checklists";

/** The traveller's library of templates (§3.3). */
export type Library = { templates: readonly Checklist[]; sequence: number; caughtUp: number };
/** How a new checklist or template starts: empty with a title, or copied from a template or a checklist. */
export type Start = { title: string } | { from: Checklist };

export type Refusal = { code: string; message: string; details?: Record<string, string> };
export type Result<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

/** A trip's record in the database (§4.1). */
export type TripRecord = {
  id: string;
  name: string;
  dates: Dates;
  mine: Dates;
  you: Copy["you"];
  /** The calendar in the itinerary's text form, or null where it is not granted. */
  calendar: string | null;
  graveyard: Copy["graveyard"];
  members: readonly Member[];
  /** An admin's copy alone, in the permissions' text form. */
  grants?: string;
  invitations?: readonly Invitation[];
  sequence: number;
  caughtUp: number;
  /** Set where a record could not be read, so the next catch-up starts from the beginning. */
  fromStart?: true;
};

export type TextRecord = { trip: string; id: string; text: string; changed: number };
export type TemplateRecord = { id: string; text: string; changed: number };
/**
 * `last`: the trip this account last opened on the device (§4.5). `library`: the library's sequence
 * and when it was last caught up, or `fromStart` where a template could not be read (§4.2).
 */
export type AccountRecord = {
  key: "me";
  account?: string;
  signOutOwed: boolean;
  last?: string;
  library?: { sequence: number; caughtUp: number; fromStart?: true };
};
