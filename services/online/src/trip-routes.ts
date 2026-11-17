// The requests planner/trip-host answers (docs/spec/planner/trip-host.md §3.2). The Worker names
// the account with access/accounts and the member with access/membership, then passes the request to
// the trip's Durable Object. An account not on the trip is refused before the object is reached.

import { env } from "cloudflare:workers";
import { createTrip, member, onChange, onTitle, trips } from "./membership.ts";
import { body, type Refusal } from "./result.ts";
import type { Route, SignedIn } from "./route.ts";
import type { Member, Result, Target } from "./trip-core.ts";
import { ACCOUNT_HEADER } from "./trip-host.ts";

const SEGMENT = "([^/]+)";
const TARGETS: readonly Target[] = ["calendar", "pages", "grants", "bookings"];
/** A refusal for missing access is 403, and any other from a package 409 (§3.2). */
const ACCESS = new Set(["no-view", "no-edit", "admin-only", "creator-only", "own-dates-only", "membership-only"]);

function status(code: string): number {
  if (code === "malformed") return 400;
  if (code === "not-a-member") return 404;
  return ACCESS.has(code) ? 403 : 409;
}

function refusedHere(refusal: Refusal, by: SignedIn): Response {
  const body: Refusal = { code: refusal.code, message: refusal.message };
  if (refusal.details) body.details = refusal.details;
  return Response.json(body, { status: status(refusal.code), headers: by.headers });
}

function reply<T>(result: Result<T>, by: SignedIn, wrap: (value: T) => unknown, ok = 200): Response {
  if (!result.ok) return refusedHere(result.refusal, by);
  return Response.json(wrap(result.value), { status: ok, headers: by.headers });
}

const malformed = (message: string, by: SignedIn) => refusedHere({ code: "malformed", message }, by);
const notAMember = (by: SignedIn) => refusedHere({ code: "not-a-member", message: "You are not on this trip, or it does not exist." }, by);

function host(trip: string) {
  return env.TRIPS.get(env.TRIPS.idFromName(trip));
}

/** The member an account is, on a trip, as the Durable Object takes it, or undefined. */
async function memberOf(trip: string, by: SignedIn): Promise<Member | undefined> {
  const m = await member(trip, by.account.id);
  return m && { traveller: m.account, admin: m.admin, creator: m.creator };
}

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1000 && value.every((v) => typeof v === "string");

/** A request about one trip: its identifier, and the member making it, or the response refusing it. */
async function onTrip(match: RegExpMatchArray, by: SignedIn): Promise<{ trip: string; who: Member } | Response> {
  const trip = decodeURIComponent(match[1]!);
  const who = await memberOf(trip, by);
  return who ? { trip, who } : notAMember(by);
}

export const tripRoutes: Route[] = [
  {
    method: "POST",
    path: /^\/api\/trips$/,
    signedIn: true,
    answer: async (request, _, by) => {
      const read = await body(request);
      if (!read.ok) return malformed(read.refusal.message, by!);
      const { name, first, last, countries } = read.value;
      if (typeof name !== "string" || !isDate(first) || !isDate(last) || !isList(countries)) {
        return malformed("A new trip needs a name, its first and last dates, and a list of countries.", by!);
      }
      const trip = crypto.randomUUID();
      const creator: Member = { traveller: by!.account.id, admin: true, creator: true };
      const made = await host(trip).create(trip, creator, name, first, last, countries);
      if (!made.ok) return refusedHere(made.refusal, by!);
      await createTrip(trip, by!.account.id);
      return Response.json({ trip }, { status: 201, headers: by!.headers });
    },
  },
  {
    method: "GET",
    path: /^\/api\/trips$/,
    signedIn: true,
    answer: async (_, __, by) => {
      const listed = [];
      for (const trip of await trips(by!.account.id)) {
        const summary = await host(trip).summary();
        if (summary) listed.push({ trip, name: summary.name, dates: { first: summary.first, last: summary.last } });
      }
      return Response.json({ trips: listed }, { headers: by!.headers });
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/trips/${SEGMENT}/changes$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const on = await onTrip(match, by!);
      if (on instanceof Response) return on;
      const read = await body(request);
      if (!read.ok) return malformed(read.refusal.message, by!);
      const { target, change, agreed } = read.value;
      if (!TARGETS.includes(target as Target) || typeof change !== "string") {
        return malformed("A change needs its target, one of calendar, pages, grants and bookings, and the change as text.", by!);
      }
      if (agreed !== undefined && (typeof agreed !== "number" || !Number.isInteger(agreed) || agreed < 0)) {
        return malformed("The number of travellers agreed is a whole number.", by!);
      }
      const result = await host(on.trip).change(on.who, target as Target, change, agreed as number | undefined);
      return reply(result, by!, (value) => value);
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/trips/${SEGMENT}/sync$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const on = await onTrip(match, by!);
      if (on instanceof Response) return on;
      const read = await body(request);
      if (!read.ok) return malformed(read.refusal.message, by!);
      const { since, holdsCalendar } = read.value;
      if ((since !== undefined && (typeof since !== "number" || !Number.isInteger(since) || since < 0)) || typeof holdsCalendar !== "boolean") {
        return malformed("A catch-up gives the sequence it holds, if any, and whether it holds the calendar.", by!);
      }
      return reply(await host(on.trip).sync(on.who, since as number | undefined, holdsCalendar), by!, (value) => value);
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/trips/${SEGMENT}/pages$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const on = await onTrip(match, by!);
      if (on instanceof Response) return on;
      const read = await body(request);
      if (!read.ok || !isList(read.value.pages)) return malformed("Name the pages wanted as a list of identifiers.", by!);
      return reply(await host(on.trip).pages(on.who, read.value.pages), by!, (pages) => ({ pages }));
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/trips/${SEGMENT}/bookings$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const on = await onTrip(match, by!);
      if (on instanceof Response) return on;
      const read = await body(request);
      if (!read.ok || !isList(read.value.bookings)) return malformed("Name the bookings wanted as a list of identifiers.", by!);
      return reply(await host(on.trip).bookings(on.who, read.value.bookings), by!, (bookings) => ({ bookings }));
    },
  },
  {
    method: "GET",
    path: new RegExp(`^/api/trips/${SEGMENT}/buried/${SEGMENT}$`),
    signedIn: true,
    answer: async (_, match, by) => {
      const on = await onTrip(match, by!);
      if (on instanceof Response) return on;
      return reply(await host(on.trip).buried(on.who, decodeURIComponent(match[2]!)), by!, (page) => ({ page }));
    },
  },
  {
    method: "GET",
    path: new RegExp(`^/api/trips/${SEGMENT}/live$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const on = await onTrip(match, by!);
      if (on instanceof Response) return on;
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return malformed("A live socket needs a WebSocket upgrade.", by!);
      }
      const headers = new Headers(request.headers);
      headers.set(ACCOUNT_HEADER, on.who.traveller);
      return host(on.trip).fetch(new Request(request.url, { headers }));
    },
  },
];

/**
 * Hands the trip host each change access/membership makes (spec/access/membership.md §3.3): an `add`
 * or a `remove` to the trip's `grant`, and a member made an admin to its `touch`. Also gives the
 * trip's name for an invitation's email.
 */
export function connectMembership(): void {
  onChange(async (trip, change) => {
    if (change.op === "admin") {
      await host(trip).touch();
      return;
    }
    if (change.op !== "add" && change.op !== "remove") return;
    const result = await host(trip).grant(change);
    if (!result.ok) throw new Error(`The trip ${trip} refused a change of its members: ${result.refusal.message}`);
  });
  onTitle(async (trip) => (await host(trip).summary())?.name);
}
