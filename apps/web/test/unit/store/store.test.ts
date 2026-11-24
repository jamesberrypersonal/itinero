// The requirements of web/trip-store, each by the verification it carries, against a stand-in for
// the online side that runs the trip host's own logic (docs/spec/web/trip-store.md §4.7). IndexedDB
// is fake-indexeddb's, one database for each device.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, beforeEach, describe, test } from "node:test";
import { changeToText as bookingChange, type Booking } from "@itinero/bookings";
import { changeToText as calendarChange } from "@itinero/itinerary";
import { changeToText as pageChange } from "@itinero/pages";
import { grantChangeToText } from "@itinero/permissions";
import { loadRules } from "@itinero/trip-time";
import { createStore, type Store } from "../../../src/store/store.ts";
import { channelsOfOneDevice, Online, type Device } from "./online.ts";

assert.ok(loadRules(readFileSync(new URL(import.meta.resolve("@itinero/trip-time/rules/2026f.json")), "utf8")).ok);

let online: Online;
const opened: Store[] = [];
let refusedVersion = 0;

beforeEach(() => {
  online = new Online();
  refusedVersion = 0;
});

after(async () => {
  for (const store of opened) await store.signOut().catch(() => undefined);
});

type Phone = { device: Device; idb: IDBFactory; channel: { new (name: string): BroadcastChannel }; windows: Store[] };

/** A device signed in as an account. */
function phone(account: string): Phone {
  return { device: online.device(account), idb: new IDBFactory(), channel: channelsOfOneDevice(), windows: [] };
}

/** Opens a window of Itinero on a device, with a trip store of its own. */
async function window(on: Phone, account?: string): Promise<Store> {
  const store = createStore({
    indexedDB: on.idb,
    fetch: on.device.fetch,
    WebSocket: on.device.WebSocket,
    BroadcastChannel: on.channel,
    origin: "https://itinero.test",
    online: on.device.reachable,
    now: () => Date.now(),
    shell: {
      API: 1,
      API_HEADER: "Itinero-Api",
      updateFirst: () => {
        refusedVersion++;
      },
      online: () => {},
    },
  });
  opened.push(store);
  on.windows.push(store);
  await store.open();
  if (account) await store.signedIn(account);
  return store;
}

function ok<T>(result: { ok: true; value: T } | { ok: false; refusal: { code: string; message: string } }): T {
  if (!result.ok) assert.fail(`refused: ${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

function code(result: { ok: boolean; refusal?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.refusal!.code;
}

const DEC = { first: "2026-12-01", last: "2026-12-20" };

async function until(check: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`never: ${what}`);
}

const flight = (id: string, travellers: string[]) =>
  ({
    id,
    revision: 0,
    travellers: [...travellers].sort(),
    details: { reference: "K7Q2ZP" },
    kind: "flight",
    legs: [
      {
        flight: "LA 800",
        from: { code: "SCL" },
        to: { code: "PUQ" },
        leaves: { kind: "exact", zone: "America/Santiago", date: "2026-12-06", at: { time: "07:05" } },
        arrives: { kind: "exact", zone: "America/Punta_Arenas", date: "2026-12-06", at: { time: "10:30" } },
      },
    ],
    seats: [],
  }) as unknown as Booking;

const CHILE = "country-cl";

/** Ana's trip through Chile and Argentina, with Sam on it, and a flight naming both. */
async function patagonia(ana: Store, sam: Store, samAccount = "sam", access: { trip?: "view" | "edit"; calendar?: "none" | "view" | "edit" } = {}) {
  const trip = ok(await ana.create("Patagonia", DEC, ["CL", "AR"])).trip;
  const invitation = ok(await ana.invite(trip, "sam@example.com", access.trip ?? "edit", access.calendar ?? "view"));
  ok(await sam.accept(invitation.id, online.tokenOf(trip, invitation.id)));
  ok(await ana.send(trip, "calendar", calendarChange({ op: "pencil", stretch: { id: "s1", place: { country: "CL" }, first: "2026-12-01", last: "2026-12-10" } })));
  ok(await ana.send(trip, "bookings", bookingChange({ op: "add", booking: flight("la800", ["ana", samAccount]) })));
  return trip;
}

/** Takes a device offline: it reaches nothing, and its sockets close. */
function offline(on: Phone): void {
  on.device.reachable = false;
  const account = online.sessions.get(on.device.session);
  for (const socket of [...online.sockets]) if (socket.account === account) socket.close(1006);
  for (const store of on.windows) store.wentOffline();
}

async function connect(on: Phone): Promise<void> {
  on.device.reachable = true;
  for (const store of on.windows) await store.catchUpAll();
}

describe("WEB:STORE-F1 — a device holds a copy of every trip, read with no connection, with when it was brought up to date", () => {
  test("a traveller on two trips", async () => {
    const anaPhone = phone("ana");
    const ana = await window(anaPhone, "ana");
    const sam = await window(phone("sam"), "sam");
    const first = await patagonia(ana, sam);
    const second = ok(await ana.create("Lisbon", { first: "2027-03-01", last: "2027-03-05" }, ["PT"])).trip;
    await ana.catchUpAll();

    offline(anaPhone);
    assert.equal(ana.isOnline(), false);
    const held = (await ana.trips()).map((t) => t.id).sort();
    assert.deepEqual(held, [first, second].sort());
    const copy = (await ana.trip(first))!;
    assert.deepEqual(copy.pages.pages.map((p) => p.title).sort(), ["Argentina", "Chile"]);
    assert.equal(copy.bookings.length, 1);
    assert.equal(copy.calendar?.stretches.length, 1);
    assert.ok(copy.caughtUp > Date.now() - 60_000);
    assert.deepEqual((await ana.trips()).map((t) => typeof t.caughtUp), ["number", "number"]);

    // Closed and opened again with no connection, in a new window of the same device.
    const reopened = await window(anaPhone);
    assert.deepEqual(await reopened.open(), { account: "ana" });
    assert.equal((await reopened.trips()).length, 2);
    assert.equal((await reopened.trip(first))?.bookings.length, 1);
  });
});

describe("WEB:STORE-F2 — each time the device connects, every trip is brought up to date, and drops what its traveller may not see", () => {
  test("a page renamed, a booking and the calendar taken away, then the traveller removed", async () => {
    const ana = await window(phone("ana"), "ana");
    const samPhone = phone("sam");
    const sam = await window(samPhone, "sam");
    const trip = await patagonia(ana, sam);
    const other = ok(await ana.create("Lisbon", { first: "2027-03-01", last: "2027-03-05" }, []));
    const invitation = ok(await ana.invite(other.trip, "sam@example.com", "view", "none"));
    ok(await sam.accept(invitation.id, online.tokenOf(other.trip, invitation.id)));
    assert.ok((await sam.trip(trip))?.calendar);

    offline(samPhone);
    ok(await ana.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Chile, north to south" })));
    ok(await ana.send(trip, "bookings", bookingChange({ op: "change", booking: { ...flight("la800", ["ana"]), revision: 1 }, base: 1 })));
    ok(await ana.send(trip, "grants", grantChangeToText({ op: "calendar", traveller: "sam", level: "none" })));
    await connect(samPhone);
    const copy = (await sam.trip(trip))!;
    assert.ok(copy.pages.pages.some((p) => p.title === "Chile, north to south"));
    assert.deepEqual(copy.bookings, []);
    assert.equal(copy.calendar, undefined);

    ok(await ana.remove(other.trip, "sam"));
    await sam.catchUpAll();
    assert.equal(await sam.trip(other.trip), undefined);
    assert.deepEqual((await sam.trips()).map((t) => t.id), [trip]);
  });

  test("a connection cut at any request of a catch-up leaves the copy as it was", async () => {
    const ana = await window(phone("ana"), "ana");
    const samPhone = phone("sam");
    const sam = await window(samPhone, "sam");
    const trip = await patagonia(ana, sam);
    ok(await ana.send(trip, "grants", grantChangeToText({ op: "page", traveller: "sam", page: "country-ar", level: "none" })));
    await sam.catchUpAll();
    // Argentina comes back by a change of access, so the catch-up fetches it by its identifier.
    ok(await ana.send(trip, "grants", grantChangeToText({ op: "unpage", traveller: "sam", page: "country-ar" })));
    ok(await ana.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Chile again" })));
    const before = await sam.trip(trip);
    for (const cut of [/\/sync$/, /\/pages$/, /\/members$/]) {
      online.failNext = new RegExp(`^(GET|POST) /api/trips/${trip}${cut.source}`);
      await sam.catchUpAll();
      assert.equal(online.failNext, undefined, `the request ${cut} was made and cut`);
      assert.deepEqual(await sam.trip(trip), before, `a catch-up cut at ${cut} changes nothing`);
      samPhone.device.reachable = true;
    }
    await sam.catchUpAll();
    const after = (await sam.trip(trip))!;
    assert.ok(after.pages.pages.some((p) => p.title === "Chile again"));
    assert.ok(after.pages.pages.some((p) => p.id === "country-ar"));
  });
});

describe("catching up while a catch-up runs", () => {
  test("a call while one runs waits for a catch-up that asks after it", async () => {
    const ana = await window(phone("ana"), "ana");
    const trip = ok(await ana.create("Patagonia", DEC, ["CL"])).trip;
    // The running catch-up has asked for the trip, and waits on the trip's members, when the change
    // below is made and the second call comes.
    online.holdNext = /\/members$/;
    const running = ana.catchUpAll();
    await until(() => online.holdNext === undefined, "the running catch-up waits on the members");
    const me = { traveller: "ana", admin: true, creator: true };
    ok(online.trips.get(trip)!.core.change(me, "pages", pageChange({ op: "rename", id: CHILE, title: "Chile, renamed meanwhile" })));
    const after = ana.catchUpAll();
    online.release();
    await running;
    await after;
    assert.ok((await ana.trip(trip))!.pages.pages.some((p) => p.title === "Chile, renamed meanwhile"));
  });
});

describe("WEB:STORE-F3 — while a trip is open and the device online, each change is taken within seconds", () => {
  test("the trip open on two devices", async () => {
    const ana = await window(phone("ana"), "ana");
    const samPhone = phone("sam");
    const sam = await window(samPhone, "sam");
    const trip = await patagonia(ana, sam);
    let seen: string[] = [];
    const stop = sam.watch(trip, (copy) => {
      seen = copy?.pages.pages.map((p) => p.title) ?? [];
    });
    await until(() => online.sockets.size > 0, "the second device opens a socket");
    ok(await ana.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Chile, live" })));
    await until(() => seen.includes("Chile, live"), "the second device holds the change");

    offline(samPhone);
    ok(await ana.send(trip, "bookings", bookingChange({ op: "change", booking: { ...flight("la800", ["ana", "sam"]), details: { reference: "NEW123" } }, base: 1 })));
    await connect(samPhone);
    const copy = (await sam.trip(trip))!;
    assert.equal(copy.bookings[0]!.details.reference, "NEW123");
    stop();
  });

  test("a removed traveller's socket closes with 4403, and the trip is deleted at once", async () => {
    const ana = await window(phone("ana"), "ana");
    const sam = await window(phone("sam"), "sam");
    const trip = await patagonia(ana, sam);
    let latest: unknown = "unset";
    const stop = sam.watch(trip, (copy) => {
      latest = copy;
    });
    await until(() => online.sockets.size > 0, "the socket opens");
    ok(await ana.remove(trip, "sam"));
    await until(() => latest === undefined, "the removed traveller's copy is gone");
    assert.deepEqual(await sam.trips(), []);
    stop();
  });
});

describe("WEB:STORE-F4 — a change is sent only while the device is online, and is in the copy once accepted", () => {
  test("offline, refused, and accepted", async () => {
    const anaPhone = phone("ana");
    const ana = await window(anaPhone, "ana");
    const samPhone = phone("sam");
    const sam = await window(samPhone, "sam");
    const trip = await patagonia(ana, sam, "sam", { trip: "view" });

    offline(samPhone);
    const sent = online.requests.length;
    const change = pageChange({ op: "rename", id: CHILE, title: "Sam's Chile" });
    assert.equal(code(await sam.send(trip, "pages", change)), "offline");
    assert.equal(online.requests.length, sent, "nothing is sent");

    samPhone.device.reachable = true;
    await sam.catchUpAll();
    const refused = await sam.send(trip, "pages", change);
    assert.equal(code(refused), "no-edit");
    assert.match((refused as { refusal: { message: string } }).refusal.message, /^[A-Z].*\.$/);

    const { sequence } = ok(await ana.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Ana's Chile" })));
    const copy = (await ana.trip(trip))!;
    assert.equal(copy.sequence, sequence);
    assert.ok(copy.pages.pages.some((p) => p.title === "Ana's Chile"));
  });

  test("a request that fails on the network refuses as offline, and is not sent again", async () => {
    const ana = await window(phone("ana"), "ana");
    const trip = ok(await ana.create("Patagonia", DEC, ["CL"])).trip;
    online.failNext = /changes$/;
    assert.equal(code(await ana.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Lost" }))), "offline");
    assert.equal(ana.isOnline(), false);
    assert.equal(online.requests.filter((r) => r.endsWith("/changes")).length, 1);
  });
});

/** Every record held in a device's database, store by store. */
async function everything(idb: IDBFactory): Promise<Record<string, unknown[]>> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    // At whatever version the trip store made it.
    const request = idb.open("itinero");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const held: Record<string, unknown[]> = {};
  for (const name of Array.from(db.objectStoreNames)) {
    held[name] = await new Promise((resolve) => {
      const request = db.transaction(name).objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }
  db.close();
  return held;
}

describe("WEB:STORE-F5 — signing out deletes every trip first, and a session that has ended does the same", () => {
  test("signing out online", async () => {
    const samPhone = phone("sam");
    const ana = await window(phone("ana"), "ana");
    const sam = await window(samPhone, "sam");
    await patagonia(ana, sam);
    await sam.signOut();
    assert.deepEqual(await everything(samPhone.idb), {
      account: [{ key: "me", signOutOwed: false }],
      bookings: [],
      checklists: [],
      pages: [],
      templates: [],
      trips: [],
    });
    assert.equal(online.sessions.has(samPhone.device.session), false, "the session is ended");
  });

  test("signing out offline, then connecting", async () => {
    const samPhone = phone("sam");
    const ana = await window(phone("ana"), "ana");
    const sam = await window(samPhone, "sam");
    await patagonia(ana, sam);
    offline(samPhone);
    await sam.signOut();
    const held = await everything(samPhone.idb);
    assert.deepEqual(held, { account: [{ key: "me", signOutOwed: true }], bookings: [], checklists: [], pages: [], templates: [], trips: [] });
    assert.ok(online.sessions.has(samPhone.device.session), "the session is still open online");
    assert.deepEqual(await sam.open(), {}, "the sign-in screen shows");

    await connect(samPhone);
    assert.equal(online.sessions.has(samPhone.device.session), false, "the session is ended once connected");
    assert.deepEqual((await everything(samPhone.idb))["account"], [{ key: "me", signOutOwed: false }]);
  });

  test("a session ended online deletes every trip on the next connection", async () => {
    const samPhone = phone("sam");
    const ana = await window(phone("ana"), "ana");
    const sam = await window(samPhone, "sam");
    await patagonia(ana, sam);
    online.endSession(samPhone.device.session);
    await sam.catchUpAll();
    assert.deepEqual(await sam.trips(), []);
    assert.deepEqual(await sam.open(), {});
    assert.deepEqual((await everything(samPhone.idb))["pages"], []);
  });
});

describe("the trip last opened, which Itinero opens with (spec §4.5)", () => {
  test("given while the device holds it, and forgotten on removal and on signing out", async () => {
    const samPhone = phone("sam");
    const ana = await window(phone("ana"), "ana");
    const sam = await window(samPhone, "sam");
    const trip = await patagonia(ana, sam);
    const lisbon = ok(await ana.create("Lisbon", { first: "2027-03-01", last: "2027-03-05" }, ["PT"])).trip;
    const invitation = ok(await ana.invite(lisbon, "sam@example.com", "edit", "view"));
    ok(await sam.accept(invitation.id, online.tokenOf(lisbon, invitation.id)));
    assert.deepEqual(await sam.open(), { account: "sam" }, "no trip opened yet");

    await sam.opened(trip);
    await sam.opened(lisbon);
    offline(samPhone);
    assert.deepEqual(await (await window(samPhone)).open(), { account: "sam", last: lisbon }, "the later one, offline, in a new window");

    await connect(samPhone);
    ok(await ana.remove(lisbon, "sam"));
    await sam.catchUpAll();
    assert.deepEqual(await sam.open(), { account: "sam" }, "a trip no longer held is not given");

    await sam.opened(trip);
    await sam.signOut();
    assert.deepEqual((await everything(samPhone.idb))["account"], [{ key: "me", signOutOwed: false }]);
    await sam.opened(trip);
    assert.deepEqual((await everything(samPhone.idb))["account"], [{ key: "me", signOutOwed: false }], "nothing is recorded signed out");
  });
});

describe("WEB:STORE-F6 — every window on a device shares one copy, and each is told when it changes", () => {
  test("two windows of Itinero open on one computer", async () => {
    const anaPhone = phone("ana");
    const first = await window(anaPhone, "ana");
    const second = await window(anaPhone);
    const trip = ok(await first.create("Patagonia", DEC, ["CL"])).trip;
    let titles: string[] = [];
    second.watch(trip, (copy) => {
      titles = copy?.pages.pages.map((p) => p.title) ?? [];
    });
    ok(await first.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Chile, from the first window" })));
    await until(() => titles.includes("Chile, from the first window"), "the second window is told within a second");

    let signedOut = false;
    second.onSignedOut(() => {
      signedOut = true;
    });
    await first.signOut();
    await until(() => signedOut, "the second window is told of the sign-out");
    assert.deepEqual(await second.trips(), []);
  });
});

describe("WEB:STORE-F7 — the trip store carries every other request about a trip, and the copy shows what each did", () => {
  test("an admin creates a trip, invites, withdraws, makes an admin, removes, and reads a deleted page", async () => {
    const anaPhone = phone("ana");
    const ana = await window(anaPhone, "ana");
    const sam = await window(phone("sam"), "sam");
    const kim = await window(phone("kim"), "kim");
    const trip = ok(await ana.create("Patagonia", DEC, ["CL", "AR"])).trip;
    assert.deepEqual((await ana.trips()).map((t) => t.id), [trip]);

    const invitation = ok(await ana.invite(trip, "kim@example.com", "view", "none"));
    assert.deepEqual((await ana.trip(trip))?.invitations?.map((i) => i.email), ["kim@example.com"]);
    ok(await ana.withdraw(trip, invitation.id));
    assert.deepEqual((await ana.trip(trip))?.invitations, []);

    const forSam = ok(await ana.invite(trip, "sam@example.com", "edit", "view"));
    ok(await sam.accept(forSam.id, online.tokenOf(trip, forSam.id)));
    const forKim = ok(await ana.invite(trip, "kim@example.com", "view", "none"));
    ok(await kim.accept(forKim.id, online.tokenOf(trip, forKim.id)));

    ok(await ana.makeAdmin(trip, "sam"));
    assert.equal((await ana.trip(trip))?.members.find((m) => m.account === "sam")?.admin, true);
    ok(await ana.remove(trip, "kim"));
    const copy = (await ana.trip(trip))!;
    assert.ok(copy.members.find((m) => m.account === "kim")?.removed);
    assert.ok(!copy.grants?.grants.some((g) => g.traveller === "kim"), "the copy holds no access of theirs");

    ok(await ana.send(trip, "pages", pageChange({ op: "bury", id: "country-ar" })));
    const page = ok(await ana.buried(trip, "country-ar"));
    assert.equal(page.title, "Argentina");
    const pages = (await everything(anaPhone.idb))["pages"] as { id: string }[];
    assert.ok(!pages.some((p) => p.id === "country-ar"), "a page in the graveyard is not stored");
    assert.deepEqual((await ana.trip(trip))?.graveyard, [{ id: "country-ar", title: "Argentina", went: 0 }]);
  });

  test("a traveller who is not an admin holds no other traveller's access and no invitation", async () => {
    const ana = await window(phone("ana"), "ana");
    const sam = await window(phone("sam"), "sam");
    const trip = await patagonia(ana, sam);
    ok(await ana.invite(trip, "kim@example.com", "view", "none"));
    const copy = (await sam.trip(trip))!;
    assert.equal(copy.grants, undefined);
    assert.equal(copy.invitations, undefined);
    assert.equal(copy.you.admin, false);
  });

  test("each refuses with offline, sending nothing, where the device is offline", async () => {
    const anaPhone = phone("ana");
    const ana = await window(anaPhone, "ana");
    const trip = ok(await ana.create("Patagonia", DEC, [])).trip;
    offline(anaPhone);
    const sent = online.requests.length;
    for (const result of [
      await ana.create("X", DEC, []),
      await ana.accept("i-1", "t"),
      await ana.invite(trip, "kim@example.com", "view", "none"),
      await ana.withdraw(trip, "i-1"),
      await ana.makeAdmin(trip, "sam"),
      await ana.remove(trip, "sam"),
      await ana.buried(trip, "p"),
    ]) {
      assert.equal(code(result), "offline");
    }
    assert.equal(online.requests.length, sent);
  });
});

describe("WEB:SHELL-F5 — a version too old stops everything but reading", () => {
  test("the online side refuses the version", async () => {
    const ana = await window(phone("ana"), "ana");
    const trip = ok(await ana.create("Patagonia", DEC, ["CL"])).trip;
    online.oldestApi = 2;
    const refused = await ana.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Too old" }));
    assert.equal(code(refused), "update-first");
    assert.equal(refusedVersion, 1, "the shell is told");
    const sent = online.requests.length;
    assert.equal(code(await ana.send(trip, "pages", pageChange({ op: "rename", id: CHILE, title: "Again" }))), "update-first");
    assert.equal(code(await ana.invite(trip, "kim@example.com", "view", "none")), "update-first");
    await ana.catchUpAll();
    assert.equal(online.requests.length, sent, "nothing more is sent");
    assert.equal((await ana.trip(trip))?.pages.pages[0]?.title, "Chile", "the copy is still read");
  });
});

describe("WEB:STORE-NFR1 — a large trip is read from the device quickly", () => {
  test("a trip of 500 pages and 300 bookings is read ten times within a second each", async () => {
    const ana = await window(phone("ana"), "ana");
    const trip = ok(await ana.create("Patagonia", DEC, ["CL", "AR"])).trip;
    const host = online.trips.get(trip)!.core;
    const me = { traveller: "ana", admin: true, creator: true };
    for (let i = 0; i < 498; i++) {
      const at = i < 48 ? {} : { parent: `page-${i % 48}` };
      ok(host.change(me, "pages", pageChange({ op: "add", id: `page-${i}`, title: `Page ${i}`, text: "Torres del Paine, the W trek. ".repeat(60), at })));
    }
    for (let i = 0; i < 300; i++) ok(host.change(me, "bookings", bookingChange({ op: "add", booking: flight(`b-${i}`, ["ana"]) })));
    await ana.catchUpAll();
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const started = performance.now();
      const copy = await ana.trip(trip);
      times.push(performance.now() - started);
      assert.equal(copy?.pages.pages.length, 500);
      assert.equal(copy?.bookings.length, 300);
    }
    console.log(`A trip of 500 pages and 300 bookings read in ${times.map((t) => t.toFixed(0)).join(", ")} ms`);
    for (const time of times) assert.ok(time < 1000, `a read took ${time.toFixed(0)} milliseconds`);
  });
});
