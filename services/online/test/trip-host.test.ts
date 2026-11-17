// Every check in the verification of each requirement planner/trip-host claims, each refusal of
// docs/spec/planner/trip-host.md §3.2, and the checks of the planner's and the bookings' own
// requirements that need only the online side (§4.7). Travellers sign in through the stand-in for
// Google, and join a trip through invitations the stand-in for Resend keeps.

import { changeToText as bookingChange, type Booking } from "@itinero/bookings";
import { changeToText as calendarChange, type Change as CalendarChange } from "@itinero/itinerary";
import { changeToText as pageChange, pageFromText, type Change as PageChange } from "@itinero/pages";
import { grantChangeToText, type GrantChange } from "@itinero/permissions";
import { describe, expect, test } from "vitest";
import type { Sync } from "../src/trip-core.ts";
import { api, expectRefused, json, signIn, type SignedIn } from "./helpers.ts";
import { latestTo } from "./resend.ts";

let count = 0;
/** A traveller signed in with a Google account of their own. */
async function traveller(name: string): Promise<SignedIn> {
  count++;
  return signIn({ sub: `host-${count}`, email: `${name.toLowerCase()}${count}@example.com`, name, emailVerified: true });
}

type TripFields = { name?: string; first?: string; last?: string; countries?: string[] };

/** Creates a trip, which must succeed: Patagonia, from 1 to 20 December 2026, through Chile and Argentina. */
async function createTrip(by: SignedIn, fields: TripFields = {}): Promise<string> {
  const response = await api("/api/trips", {
    method: "POST",
    session: by.session,
    body: { name: "Patagonia", first: "2026-12-01", last: "2026-12-20", countries: ["CL", "AR"], ...fields },
  });
  expect(response.status).toBe(201);
  return (await json<{ trip: string }>(response)).trip;
}

/** Invites a traveller with the access given, who accepts, which must succeed. */
async function join(trip: string, admin: SignedIn, who: SignedIn, access: { trip?: string; calendar?: string } = {}): Promise<void> {
  const invited = await api(`/api/trips/${trip}/invitations`, {
    method: "POST",
    session: admin.session,
    body: { email: who.email, trip: access.trip ?? "view", calendar: access.calendar ?? "none" },
  });
  expect(invited.status).toBe(201);
  const { invitation, token } = latestTo(who.email);
  expect((await api(`/api/invitations/${invitation}/accept`, { method: "POST", session: who.session, body: { token } })).status).toBe(200);
}

type Change =
  | { target: "calendar"; change: CalendarChange }
  | { target: "pages"; change: PageChange }
  | { target: "grants"; change: GrantChange }
  | { target: "bookings"; change: Parameters<typeof bookingChange>[0] };

function textOf(change: Change): string {
  switch (change.target) {
    case "calendar":
      return calendarChange(change.change);
    case "pages":
      return pageChange(change.change);
    case "grants":
      return grantChangeToText(change.change);
    case "bookings":
      return bookingChange(change.change);
  }
}

/** Sends a change to a trip, as a device would. */
function send(trip: string, by: SignedIn, change: Change, agreed?: number): Promise<Response> {
  const body: Record<string, unknown> = { target: change.target, change: textOf(change) };
  if (agreed !== undefined) body["agreed"] = agreed;
  return api(`/api/trips/${trip}/changes`, { method: "POST", session: by.session, body });
}

/** Sends a change, which must be applied, and gives its sequence. */
async function applied(trip: string, by: SignedIn, change: Change, agreed?: number): Promise<number> {
  const response = await send(trip, by, change, agreed);
  const answer = await json<{ sequence?: number; code?: string; message?: string }>(response);
  expect(answer, `the change is applied`).toHaveProperty("sequence");
  expect(response.status).toBe(200);
  return answer.sequence!;
}

/** Catches a device up, which must succeed. */
async function sync(trip: string, by: SignedIn, since?: number, holdsCalendar = false): Promise<Sync> {
  const body: Record<string, unknown> = { holdsCalendar };
  if (since !== undefined) body["since"] = since;
  const response = await api(`/api/trips/${trip}/sync`, { method: "POST", session: by.session, body });
  expect(response.status).toBe(200);
  return json<Sync>(response);
}

const syncResponse = (trip: string, by: SignedIn, since?: number) =>
  api(`/api/trips/${trip}/sync`, { method: "POST", session: by.session, body: since === undefined ? { holdsCalendar: false } : { since, holdsCalendar: false } });

/** The title of each page a catch-up gives in full. */
function titles(body: Sync): Record<string, string> {
  return Object.fromEntries(body.pages.filter((p) => p.text !== undefined).map((p) => [p.id, pageOf(p.text!).title]));
}

function pageOf(text: string) {
  const read = pageFromText(text);
  if (!read.ok) throw new Error(read.refusal.message);
  return read.value;
}

/** A refusal's code, message and details. */
async function refusal(response: Response): Promise<{ status: number; code: string; message: string; details?: Record<string, string> }> {
  return { status: response.status, ...(await json<{ code: string; message: string; details?: Record<string, string> }>(response)) };
}

/** Opens a live socket to a trip, and gives the messages and the close it receives. */
async function live(trip: string, by: SignedIn) {
  const response = await api(`/api/trips/${trip}/live`, { session: by.session, headers: { Upgrade: "websocket" } });
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  const heard: number[] = [];
  let closed: number | undefined;
  socket.addEventListener("message", (event) => heard.push((JSON.parse(String(event.data)) as { sequence: number }).sequence));
  socket.addEventListener("close", (event) => {
    closed = event.code;
  });
  return { heard, closed: () => closed, socket };
}

async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 20));
  expect(check(), what).toBe(true);
}

const flight = (id: string, travellers: string[], seat?: string): Booking =>
  ({
    id,
    revision: 0,
    travellers: [...travellers].sort(),
    details: {},
    kind: "flight",
    legs: [
      {
        flight: "LA 800",
        from: { code: "SCL", name: "Santiago" },
        to: { code: "PUQ", name: "Punta Arenas" },
        leaves: { kind: "exact", zone: "America/Santiago", date: "2026-12-06", at: { time: "07:05" } },
        arrives: { kind: "exact", zone: "America/Punta_Arenas", date: "2026-12-06", at: { time: "10:30" } },
      },
    ],
    seats: seat ? [{ traveller: travellers[0]!, leg: 0, seat }] : [],
  }) as unknown as Booking;

const stay = (id: string, travellers: string[]): Booking =>
  ({
    id,
    revision: 0,
    travellers: [...travellers].sort(),
    details: {},
    kind: "stay",
    name: "Hostal Lady Florence",
    checkIn: { kind: "date", zone: "America/Punta_Arenas", date: "2026-12-09" },
    checkOut: { kind: "date", zone: "America/Punta_Arenas", date: "2026-12-12" },
  }) as unknown as Booking;

const journey = (id: string, travellers: string[]): Booking =>
  ({
    id,
    revision: 0,
    travellers,
    details: {},
    kind: "journey",
    by: "bus",
    from: "Punta Arenas",
    to: "Puerto Natales",
    leaves: { kind: "exact", zone: "America/Punta_Arenas", date: "2026-12-09", at: { time: "13:00" } },
  }) as unknown as Booking;

const activity = (id: string, travellers: string[]): Booking =>
  ({
    id,
    revision: 0,
    travellers,
    details: {},
    kind: "activity",
    sort: "tour",
    title: "Torres del Paine full day",
    starts: { kind: "exact", zone: "America/Punta_Arenas", date: "2026-12-10", at: { time: "07:30" } },
  }) as unknown as Booking;

const CHILE = "country-cl";
const ARGENTINA = "country-ar";
const chileStretch: CalendarChange = { op: "pencil", stretch: { id: "s-chile", place: { country: "CL" }, first: "2026-12-01", last: "2026-12-10" } };

describe("PLN:HOST-F1 — a traveller creates a trip, with its name, its dates and a page for each country chosen", () => {
  test("Patagonia, from 1 to 20 December 2026, visiting Chile and Argentina", async () => {
    const ana = await traveller("Ana");
    const trip = await createTrip(ana);
    const body = await sync(trip, ana);
    expect(body.trip).toEqual({ name: "Patagonia", dates: { first: "2026-12-01", last: "2026-12-20" }, mine: { first: "2026-12-01", last: "2026-12-20" } });
    const pages = body.pages.map((p) => pageOf(p.text!));
    expect(pages.map((p) => [p.title, p.parent, p.country])).toEqual([
      ["Argentina", undefined, "AR"],
      ["Chile", undefined, "CL"],
    ]);
    expect(body.you).toMatchObject({ admin: true, creator: true, grant: { traveller: ana.account, trip: "edit", calendar: "edit" } });
    expect(body.calendar).toBeTypeOf("string");

    const listed = await json<{ trips: unknown[] }>(await api("/api/trips", { session: ana.session }));
    expect(listed.trips).toContainEqual({ trip, name: "Patagonia", dates: { first: "2026-12-01", last: "2026-12-20" } });
  });

  test("PLN-F10 — a trip choosing no countries has no pages, and a country's page is an ordinary page", async () => {
    const ana = await traveller("Ana");
    expect((await sync(await createTrip(ana, { countries: [] }), ana)).pages).toEqual([]);
    const trip = await createTrip(ana);
    await applied(trip, ana, { target: "pages", change: { op: "rename", id: ARGENTINA, title: "Argentina, south" } });
    await applied(trip, ana, { target: "pages", change: { op: "move", id: ARGENTINA, to: { parent: CHILE } } });
    await applied(trip, ana, { target: "pages", change: { op: "bury", id: ARGENTINA } });
  });

  test("a trip's fields are checked", async () => {
    const ana = await traveller("Ana");
    await expectRefused(await api("/api/trips", { method: "POST", session: ana.session, body: { name: "Patagonia" } }), 400, "malformed");
    const unknown = await api("/api/trips", { method: "POST", session: ana.session, body: { name: "X", first: "2026-12-01", last: "2026-12-02", countries: ["ZZ"] } });
    await expectRefused(unknown, 409, "unknown-country");
    const backwards = await api("/api/trips", { method: "POST", session: ana.session, body: { name: "X", first: "2026-12-05", last: "2026-12-02", countries: [] } });
    expect(backwards.status).toBe(409);
    await expectRefused(await api("/api/trips", { method: "POST", body: { name: "X" } }), 401, "no-session");
  });
});

describe("PLN:HOST-F2 — each change is applied only once it is allowed, one at a time, in the order it arrives", () => {
  test("on the trip of PLN:HOST-F1, with a second traveller holding view access", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam, { trip: "view" });
    const before = (await sync(trip, ana)).sequence;

    expect(await applied(trip, ana, { target: "calendar", change: chileStretch })).toBe(before + 1);

    const rename = await send(trip, sam, { target: "pages", change: { op: "rename", id: CHILE, title: "Chile!" } });
    expect(await refusal(rename)).toMatchObject({ status: 403, code: "no-edit" });
    expect((await sync(trip, ana)).sequence).toBe(before + 1);

    await applied(trip, ana, { target: "grants", change: { op: "trip", traveller: sam.account, level: "edit" } });
    const start = (await sync(trip, ana)).sequence;
    const changes = [ana, sam].flatMap((who, device) =>
      Array.from({ length: 10 }, (_, i) =>
        send(trip, who, { target: "pages", change: { op: "add", id: `p-${device}-${i}`, title: `Page ${device}-${i}`, at: {} } }),
      ),
    );
    const sequences = await Promise.all(changes.map(async (response) => (await json<{ sequence: number }>(await response)).sequence));
    expect(new Set(sequences).size).toBe(20);
    expect([...sequences].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => start + 1 + i));
    expect((await sync(trip, ana)).pages).toHaveLength(22);

    const outsider = await traveller("Olga");
    await expectRefused(await send(trip, outsider, { target: "calendar", change: chileStretch }), 404, "not-a-member");
  });

  test("§3.2 — who may change the trip's name and dates, and each traveller's dates", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const kim = await traveller("Kim");
    const trip = await createTrip(ana);
    await join(trip, ana, sam, { trip: "edit", calendar: "edit" });
    await join(trip, ana, kim, { trip: "edit", calendar: "edit" });

    await expectRefused(await send(trip, sam, { target: "calendar", change: { op: "rename", name: "Sam's trip" } }), 403, "creator-only");
    const kimsDates = { op: "traveller-dates", traveller: kim.account, dates: { first: "2026-12-06", last: "2026-12-13" } } as const;
    await expectRefused(await send(trip, sam, { target: "calendar", change: kimsDates }), 403, "own-dates-only");
    await applied(trip, kim, { target: "calendar", change: kimsDates });
    await expectRefused(await send(trip, ana, { target: "grants", change: { op: "remove", traveller: sam.account } }), 403, "membership-only");
    await expectRefused(await send(trip, ana, { target: "grants", change: { op: "add", traveller: sam.account, trip: "view", calendar: "none" } }), 403, "membership-only");
    await expectRefused(await send(trip, sam, { target: "grants", change: { op: "calendar", traveller: kim.account, level: "none" } }), 403, "admin-only");
    await applied(trip, ana, { target: "grants", change: { op: "calendar", traveller: kim.account, level: "view" } });
    await expectRefused(await send(trip, kim, { target: "calendar", change: chileStretch }), 403, "no-edit");
  });

  test("§3.2 — a body not in the forms given is malformed", async () => {
    const ana = await traveller("Ana");
    const trip = await createTrip(ana);
    const post = (body: unknown) => api(`/api/trips/${trip}/changes`, { method: "POST", session: ana.session, body });
    await expectRefused(await post({ target: "weather", change: "{}" }), 400, "malformed");
    await expectRefused(await post({ target: "pages", change: "not a change" }), 400, "malformed");
    await expectRefused(await post({ target: "pages", change: pageChange({ op: "rename", id: CHILE, title: "x" }), agreed: -1 }), 400, "malformed");
    await expectRefused(await api(`/api/trips/${trip}/sync`, { method: "POST", session: ana.session, body: { since: "yesterday", holdsCalendar: false } }), 400, "malformed");
    await expectRefused(await api(`/api/trips/${trip}/pages`, { method: "POST", session: ana.session, body: { pages: "all" } }), 400, "malformed");
  });
});

describe("PLN:HOST-F3, PLN-F16 — a rewrite made from an older version is refused, with the text as it stands", () => {
  test("two devices editing the page Chile", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam, { trip: "edit" });
    const base = pageOf((await sync(trip, sam)).pages.find((p) => p.id === CHILE)!.text!).revision;

    await applied(trip, ana, { target: "pages", change: { op: "write", id: CHILE, text: "Ana: start in Santiago.", base } });
    const second = await refusal(await send(trip, sam, { target: "pages", change: { op: "write", id: CHILE, text: "Sam: fly to Punta Arenas.", base } }));
    expect(second).toMatchObject({ status: 409, code: "stale", details: { text: "Ana: start in Santiago." } });

    const combined = "Ana: start in Santiago.\nSam: fly to Punta Arenas.";
    await applied(trip, sam, { target: "pages", change: { op: "write", id: CHILE, text: combined, base: Number(second.details!["revision"]) } });
    expect(pageOf((await sync(trip, ana)).pages.find((p) => p.id === CHILE)!.text!).text).toBe(combined);
  });
});

describe("PLN:HOST-F4 — a move that lets more travellers see a page is applied only once the traveller confirms", () => {
  test("a page Surprise hidden from two travellers, and a page Chile they may see", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const kim = await traveller("Kim");
    const trip = await createTrip(ana);
    await join(trip, ana, sam);
    await join(trip, ana, kim);
    // Surprise is hidden from both by its place, beneath a page they may not see.
    await applied(trip, ana, { target: "pages", change: { op: "add", id: "presents", title: "Presents", at: {} } });
    await applied(trip, ana, { target: "pages", change: { op: "add", id: "surprise", title: "Surprise", at: { parent: "presents" } } });
    for (const who of [sam, kim]) {
      await applied(trip, ana, { target: "grants", change: { op: "page", traveller: who.account, page: "presents", level: "none" } });
    }

    const move = { target: "pages", change: { op: "move", id: "surprise", to: { parent: CHILE } } } as const;
    expect(await refusal(await send(trip, ana, move))).toMatchObject({ status: 409, code: "agree-first", details: { count: "2" } });
    expect(await refusal(await send(trip, ana, move, 1))).toMatchObject({ code: "agree-first" });
    await applied(trip, ana, move, 2);
    await applied(trip, ana, { target: "pages", change: { op: "move", id: ARGENTINA, to: { parent: CHILE } } });
  });
});

describe("PLN:HOST-F5 — a device catches up on everything it may see that changed while it was away", () => {
  test("the second traveller's device, away while Chile is renamed and Argentina hidden", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam);
    const held = await sync(trip, sam);
    expect(held.calendar).toBeNull();

    await applied(trip, ana, { target: "pages", change: { op: "rename", id: CHILE, title: "Chile, north to south" } });
    await applied(trip, ana, { target: "grants", change: { op: "page", traveller: sam.account, page: ARGENTINA, level: "none" } });
    const back = await sync(trip, sam, held.sequence);
    expect(titles(back)).toEqual({ [CHILE]: "Chile, north to south" });
    expect(back.pages.map((p) => p.id)).toEqual([CHILE]);

    await applied(trip, ana, { target: "grants", change: { op: "calendar", traveller: sam.account, level: "view" } });
    const again = await sync(trip, sam, back.sequence, false);
    expect(again.calendar).toBeTypeOf("string");
    // Holding the calendar already, a device is not given it again unless it changed.
    expect((await sync(trip, sam, again.sequence, true)).calendar).toBeUndefined();

    const fresh = await sync(trip, sam);
    expect(Object.values(titles(fresh))).toEqual(["Chile, north to south"]);
    expect(fresh.calendar).toBeTypeOf("string");
  });

  test("a page made visible by a change of access is fetched by its identifier", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam);
    await applied(trip, ana, { target: "grants", change: { op: "page", traveller: sam.account, page: ARGENTINA, level: "none" } });
    const held = await sync(trip, sam);
    await applied(trip, ana, { target: "grants", change: { op: "unpage", traveller: sam.account, page: ARGENTINA } });
    const back = await sync(trip, sam, held.sequence);
    expect(back.pages.find((p) => p.id === ARGENTINA)).toEqual({ id: ARGENTINA, changed: expect.any(Number) });
    const fetched = await json<{ pages: string[] }>(await api(`/api/trips/${trip}/pages`, { method: "POST", session: sam.session, body: { pages: [ARGENTINA, "nothing"] } }));
    expect(fetched.pages.map((text) => pageOf(text).title)).toEqual(["Argentina"]);
  });
});

describe("PLN:HOST-F6, PLN-F6 — a device with the trip open is told of each change at once", () => {
  test("two devices holding the trip open", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam);
    const second = await live(trip, sam);

    const renamed = await applied(trip, ana, { target: "pages", change: { op: "rename", id: CHILE, title: "Chile" + "!" } });
    await until(() => second.heard.includes(renamed), "the second device is told of the rename");
    expect(titles(await sync(trip, sam, renamed - 1))).toEqual({ [CHILE]: "Chile!" });

    second.socket.close(1000);
    const again = await applied(trip, ana, { target: "pages", change: { op: "rename", id: CHILE, title: "Chile!!" } });
    const reopened = await live(trip, sam);
    expect(titles(await sync(trip, sam, renamed))).toEqual({ [CHILE]: "Chile!!" });
    expect(again).toBeGreaterThan(renamed);

    await applied(trip, ana, { target: "grants", change: { op: "page", traveller: sam.account, page: ARGENTINA, level: "none" } });
    const hidden = await sync(trip, sam);
    expect(hidden.pages.map((p) => p.id)).not.toContain(ARGENTINA);
    const heardBefore = reopened.heard.length;
    expect((await api(`/api/trips/${trip}/admins`, { method: "POST", session: ana.session, body: { account: sam.account } })).status).toBe(204);
    await until(() => reopened.heard.length > heardBefore, "the device is told when its traveller is made an admin");
    const asAdmin = await sync(trip, sam, hidden.sequence);
    expect(asAdmin.pages.map((p) => p.id)).toContain(ARGENTINA);
    expect(asAdmin.grants).toBeTypeOf("string");
  });

  test("a socket carries only the sequence", async () => {
    const ana = await traveller("Ana");
    const trip = await createTrip(ana);
    const response = await api(`/api/trips/${trip}/live`, { session: ana.session, headers: { Upgrade: "websocket" } });
    const socket = response.webSocket!;
    socket.accept();
    const messages: string[] = [];
    socket.addEventListener("message", (event) => messages.push(String(event.data)));
    const sequence = await applied(trip, ana, { target: "pages", change: { op: "rename", id: CHILE, title: "Secret title" } });
    await until(() => messages.length > 0, "the socket is told");
    expect(messages).toEqual([JSON.stringify({ sequence })]);
  });

  test("an account not on the trip opens no socket", async () => {
    const ana = await traveller("Ana");
    const outsider = await traveller("Olga");
    const trip = await createTrip(ana);
    await expectRefused(await api(`/api/trips/${trip}/live`, { session: outsider.session, headers: { Upgrade: "websocket" } }), 404, "not-a-member");
  });
});

describe("PLN:HOST-F7 — a traveller who joins or is removed gains or loses the trip at once", () => {
  test("a traveller invited with view access sees every page and not the calendar, and loses the trip once removed", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam, { trip: "view", calendar: "none" });
    const held = await sync(trip, sam);
    expect(held.pages.map((p) => p.id)).toEqual([ARGENTINA, CHILE]);
    expect(held.calendar).toBeNull();
    expect(held.you.grant).toMatchObject({ trip: "view", calendar: "none" });

    const open = await live(trip, sam);
    expect((await api(`/api/trips/${trip}/members/${sam.account}`, { method: "DELETE", session: ana.session })).status).toBe(204);
    await until(() => open.closed() === 4403, "the removed traveller's socket is closed with 4403");
    await expectRefused(await syncResponse(trip, sam, held.sequence), 404, "not-a-member");
  });

  test("a traveller's own dates leave with them, and joining again keeps their exceptions", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam, { trip: "edit" });
    await applied(trip, sam, { target: "calendar", change: { op: "traveller-dates", traveller: sam.account, dates: { first: "2026-12-06", last: "2026-12-13" } } });
    expect((await api(`/api/trips/${trip}/members/${sam.account}`, { method: "DELETE", session: ana.session })).status).toBe(204);
    await join(trip, ana, sam, { trip: "view" });
    expect((await sync(trip, sam)).trip.mine).toEqual({ first: "2026-12-01", last: "2026-12-20" });
  });
});

describe("PLN:HOST-F8, PLN-F13 — an admin reads and restores a page in the graveyard", () => {
  test("the page Argentina deleted", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const kim = await traveller("Kim");
    const trip = await createTrip(ana);
    await join(trip, ana, sam);
    await join(trip, ana, kim);
    await applied(trip, ana, { target: "grants", change: { op: "page", traveller: kim.account, page: ARGENTINA, level: "none" } });
    const base = pageOf((await sync(trip, ana)).pages.find((p) => p.id === ARGENTINA)!.text!).revision;
    await applied(trip, ana, { target: "pages", change: { op: "write", id: ARGENTINA, text: "Bariloche, then El Calafate.", base } });
    await applied(trip, ana, { target: "pages", change: { op: "bury", id: ARGENTINA } });

    expect((await sync(trip, sam)).graveyard).toEqual([{ id: ARGENTINA, title: "Argentina", went: 0 }]);
    expect((await sync(trip, kim)).graveyard).toEqual([]);
    await applied(trip, ana, { target: "grants", change: { op: "page", traveller: sam.account, page: CHILE, level: "none" } });
    expect((await sync(trip, sam)).graveyard).toEqual([{ id: ARGENTINA, title: "Argentina", went: 0 }]);

    const read = await json<{ page: string }>(await api(`/api/trips/${trip}/buried/${ARGENTINA}`, { session: ana.session }));
    expect(pageOf(read.page).text).toBe("Bariloche, then El Calafate.");
    await expectRefused(await api(`/api/trips/${trip}/buried/${ARGENTINA}`, { session: sam.session }), 403, "admin-only");

    await applied(trip, ana, { target: "pages", change: { op: "restore", id: ARGENTINA } });
    const restored = pageOf((await sync(trip, ana)).pages.find((p) => p.id === ARGENTINA)!.text!);
    expect(restored.parent).toBeUndefined();
    expect(restored.text).toBe("Bariloche, then El Calafate.");

    await applied(trip, ana, { target: "pages", change: { op: "add", id: "bariloche", title: "Bariloche", at: { parent: ARGENTINA } } });
    await applied(trip, ana, { target: "pages", change: { op: "bury", id: ARGENTINA } });
    const beneath = await refusal(await send(trip, ana, { target: "pages", change: { op: "restore", id: "bariloche" } }));
    expect(beneath).toMatchObject({ status: 409, code: "parent-in-graveyard", details: { page: ARGENTINA } });
  });

  test("PLN-F13 — a page deleted before the page above keeps its own list, once that is restored", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana);
    await join(trip, ana, sam);
    await applied(trip, ana, { target: "pages", change: { op: "add", id: "santiago", title: "Santiago", at: { parent: CHILE } } });
    await applied(trip, ana, { target: "pages", change: { op: "add", id: "eating", title: "Eating in Santiago", at: { parent: "santiago" } } });
    await applied(trip, ana, { target: "pages", change: { op: "bury", id: "santiago" } });
    expect((await sync(trip, sam)).graveyard).toEqual([{ id: "santiago", title: "Santiago", went: 1 }]);
    await applied(trip, ana, { target: "pages", change: { op: "bury", id: CHILE } });
    expect((await sync(trip, sam)).graveyard.map((p) => p.id)).toEqual([CHILE]);
    await applied(trip, ana, { target: "pages", change: { op: "restore", id: CHILE } });
    await applied(trip, ana, { target: "pages", change: { op: "restore", id: "santiago" } });
    const pages = (await sync(trip, sam)).pages.map((p) => pageOf(p.text!));
    expect(pages.find((p) => p.id === "santiago")?.parent).toBe(CHILE);
    expect(pages.find((p) => p.id === "eating")?.parent).toBe("santiago");
  });
});

describe("PLN:HOST-F9, BKG-F1, BKG-F5 — the trip host holds a trip's bookings, and gives each device only those its traveller may see", () => {
  test("PLN:HOST-F9 — a second and a third traveller with edit access", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const kim = await traveller("Kim");
    const trip = await createTrip(ana);
    await join(trip, ana, sam, { trip: "edit" });
    await join(trip, ana, kim, { trip: "edit" });

    const before = (await sync(trip, ana)).sequence;
    expect(await applied(trip, sam, { target: "bookings", change: { op: "add", booking: flight("la800", [sam.account, kim.account]) } })).toBe(before + 1);
    const both = await sync(trip, kim);
    expect(both.bookings.map((b) => b.id)).toEqual(["la800"]);

    await applied(trip, sam, { target: "bookings", change: { op: "change", booking: { ...flight("la800", [sam.account]), revision: 1 }, base: 1 } });
    await expectRefused(await send(trip, kim, { target: "bookings", change: { op: "change", booking: flight("la800", [kim.account]), base: 2 } }), 403, "no-edit");
    const outsider = await traveller("Olga");
    const unknown = await refusal(await send(trip, sam, { target: "bookings", change: { op: "add", booking: stay("s1", [sam.account, outsider.account]) } }));
    expect(unknown).toMatchObject({ status: 409, code: "unknown-traveller", details: { traveller: outsider.account } });

    const away = await sync(trip, kim);
    expect(away.bookings).toEqual([]);
    await applied(trip, sam, { target: "bookings", change: { op: "change", booking: flight("la800", [sam.account, kim.account]), base: 2 } });
    const back = await sync(trip, kim, away.sequence);
    expect(back.bookings).toEqual([{ id: "la800", changed: expect.any(Number), text: expect.any(String) }]);
    await applied(trip, sam, { target: "bookings", change: { op: "change", booking: flight("la800", [sam.account]), base: 3 } });
    expect((await sync(trip, kim, back.sequence)).bookings).toEqual([]);
  });

  test("BKG-F1 — adding a booking of each kind, naming the travellers it is for", async () => {
    const admin = await traveller("Ana");
    const first = await traveller("Fran");
    const second = await traveller("Sam");
    const third = await traveller("Kim");
    const trip = await createTrip(admin, { countries: ["CL"] });
    await join(trip, admin, first, { trip: "edit", calendar: "none" });
    await join(trip, admin, second, { trip: "edit" });
    await join(trip, admin, third, { trip: "view" });

    await applied(trip, first, { target: "bookings", change: { op: "add", booking: flight("f1", [first.account, second.account]) } });
    await expectRefused(await send(trip, first, { target: "bookings", change: { op: "add", booking: stay("s1", [second.account]) } }), 403, "no-edit");
    await expectRefused(await send(trip, first, { target: "bookings", change: { op: "add", booking: journey("j1", []) } }), 409, "no-travellers");
    await applied(trip, admin, { target: "bookings", change: { op: "add", booking: activity("a1", [third.account]) } });
    await expectRefused(await send(trip, third, { target: "bookings", change: { op: "add", booking: stay("s2", [third.account]) } }), 403, "no-edit");
  });

  test("BKG-F5 — a traveller named by a booking changes or removes it, and is told of a change made meanwhile", async () => {
    const admin = await traveller("Ana");
    const first = await traveller("Fran");
    const second = await traveller("Sam");
    const third = await traveller("Kim");
    const trip = await createTrip(admin, { countries: ["CL"] });
    for (const who of [first, second, third]) await join(trip, admin, who, { trip: "edit" });
    await applied(trip, first, { target: "bookings", change: { op: "add", booking: flight("f1", [first.account, second.account]) } });

    await applied(trip, second, { target: "bookings", change: { op: "change", booking: flight("f1", [first.account, second.account], "12A"), base: 1 } });
    await expectRefused(await send(trip, third, { target: "bookings", change: { op: "change", booking: flight("f1", [first.account, second.account]), base: 2 } }), 403, "no-edit");
    await expectRefused(await send(trip, first, { target: "bookings", change: { op: "change", booking: flight("f1", [second.account]), base: 2 } }), 403, "no-edit");

    const [one, two] = await Promise.all([
      send(trip, first, { target: "bookings", change: { op: "change", booking: flight("f1", [first.account, second.account], "14C"), base: 2 } }),
      send(trip, second, { target: "bookings", change: { op: "change", booking: flight("f1", [first.account, second.account], "15D"), base: 2 } }),
    ]);
    const statuses = [one.status, two.status].sort();
    expect(statuses).toEqual([200, 409]);
    const refused = await json<{ code: string; details: { booking: string } }>(one.status === 409 ? one : two);
    expect(refused.code).toBe("stale");
    expect(refused.details.booking).toMatch(one.status === 409 ? /15D/ : /14C/);

    await applied(trip, admin, { target: "bookings", change: { op: "remove", id: "f1", base: 3 } });
    for (const who of [admin, first, second]) expect((await sync(trip, who)).bookings).toEqual([]);
  });
});

describe("PLN-F14 — a trip has its own first and last dates, and each traveller has theirs within them", () => {
  test("a trip from 1 to 20 December, and a second traveller from 6 to 13", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const trip = await createTrip(ana, { first: "2026-12-01", last: "2026-12-20" });
    expect((await sync(trip, ana)).trip.dates).toEqual({ first: "2026-12-01", last: "2026-12-20" });
    await join(trip, ana, sam);
    await applied(trip, sam, { target: "calendar", change: { op: "traveller-dates", traveller: sam.account, dates: { first: "2026-12-06", last: "2026-12-13" } } });
    expect((await sync(trip, sam)).trip.mine).toEqual({ first: "2026-12-06", last: "2026-12-13" });
    const outside = await refusal(await send(trip, sam, { target: "calendar", change: { op: "traveller-dates", traveller: sam.account, dates: { first: "2026-11-28", last: "2026-12-03" } } }));
    expect(outside.status).toBe(409);
    expect(outside.message).toMatch(/^[A-Z].*\.$/);
    const shrink = await refusal(await send(trip, ana, { target: "calendar", change: { op: "trip-dates", dates: { first: "2026-12-08", last: "2026-12-20" } } }));
    expect(shrink.status).toBe(409);
    expect(JSON.stringify(shrink)).toContain(sam.account);
  });
});

describe("PLN:HOST-NFR1 — nothing leaves the trip host that the traveller asking may not see", () => {
  test("a traveller with no access to the page Argentina or to the calendar", async () => {
    const ana = await traveller("Ana");
    const sam = await traveller("Sam");
    const kim = await traveller("Kim");
    const trip = await createTrip(ana);
    await join(trip, ana, sam, { trip: "edit", calendar: "none" });
    await join(trip, ana, kim, { trip: "view", calendar: "view" });
    await applied(trip, ana, { target: "grants", change: { op: "page", traveller: sam.account, page: ARGENTINA, level: "none" } });
    await applied(trip, ana, { target: "calendar", change: chileStretch });
    await applied(trip, ana, { target: "pages", change: { op: "add", id: "mendoza", title: "Mendoza wineries", at: { parent: ARGENTINA } } });
    await applied(trip, ana, { target: "bookings", change: { op: "add", booking: activity("kims-tour", [kim.account]) } });
    await applied(trip, ana, { target: "pages", change: { op: "add", id: "temp", title: "Argentina notes", at: { parent: ARGENTINA } } });
    await applied(trip, ana, { target: "pages", change: { op: "bury", id: "temp" } });

    const asked = await json<{ pages: string[] }>(await api(`/api/trips/${trip}/pages`, { method: "POST", session: sam.session, body: { pages: [ARGENTINA, "mendoza", "temp"] } }));
    expect(asked.pages).toEqual([]);
    expect((await sync(trip, sam)).calendar).toBeNull();
    await expectRefused(await api(`/api/trips/${trip}/buried/temp`, { session: sam.session }), 403, "admin-only");
    const booked = await json<{ bookings: string[] }>(await api(`/api/trips/${trip}/bookings`, { method: "POST", session: sam.session, body: { bookings: ["kims-tour"] } }));
    expect(booked.bookings).toEqual([]);

    const latest = (await sync(trip, ana)).sequence;
    for (let since = 0; since <= latest; since++) {
      const text = JSON.stringify(await sync(trip, sam, since));
      for (const hidden of ["Argentina", ARGENTINA, "Mendoza", "mendoza", "s-chile", "kims-tour", "Torres", kim.account, ana.account]) {
        expect(text, `a catch-up from ${since} names ${hidden}`).not.toContain(hidden);
      }
    }

    const admin = await sync(trip, ana);
    expect(admin.grants).toContain(sam.account);
    expect(admin.grants).toContain(kim.account);
  });

  test("every refusal for a trip the account is not on is the same, whether or not the trip exists", async () => {
    const ana = await traveller("Ana");
    const outsider = await traveller("Olga");
    const trip = await createTrip(ana);
    const real = await refusal(await syncResponse(trip, outsider));
    const none = await refusal(await syncResponse(crypto.randomUUID(), outsider));
    expect(real).toEqual(none);
    expect(real).toMatchObject({ status: 404, code: "not-a-member" });
  });
});
