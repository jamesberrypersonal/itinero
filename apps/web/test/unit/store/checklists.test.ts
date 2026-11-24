// The trip store's checklists and library: WEB:STORE-F8 and WEB:STORE-F9, the library's part of
// WEB:STORE-F5, the cut tests of the library's catch-up, and the upgrade of the device's database
// from version 1 (docs/spec/web/trip-store.md §4.1, §4.2, §4.7, §4.9). The stand-in runs the trip
// host's own logic, and keeps each library as planner/library does.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, beforeEach, describe, test } from "node:test";
import { changeToText, newChecklist, placeAfter, type Checklist } from "@itinero/checklists";
import { loadRules } from "@itinero/trip-time";
import { createStore, type Store } from "../../../src/store/store.ts";
import { channelsOfOneDevice, Online, type Device } from "./online.ts";

assert.ok(loadRules(readFileSync(new URL(import.meta.resolve("@itinero/trip-time/rules/2026f.json")), "utf8")).ok);

let online: Online;
const opened: Store[] = [];

beforeEach(() => {
  online = new Online();
});

after(async () => {
  for (const store of opened) await store.signOut().catch(() => undefined);
});

type Phone = { device: Device; idb: IDBFactory; channel: { new (name: string): BroadcastChannel }; windows: Store[] };

function phone(account: string, idb = new IDBFactory()): Phone {
  return { device: online.device(account), idb, channel: channelsOfOneDevice(), windows: [] };
}

async function window(on: Phone, account?: string): Promise<Store> {
  const store = createStore({
    indexedDB: on.idb,
    fetch: on.device.fetch,
    WebSocket: on.device.WebSocket,
    BroadcastChannel: on.channel,
    origin: "https://itinero.test",
    online: on.device.reachable,
    now: () => Date.now(),
    shell: { API: 1, API_HEADER: "Itinero-Api", updateFirst: () => {}, online: () => {} },
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

const code = (result: { ok: boolean; refusal?: { code: string } }) => (result.ok ? undefined : result.refusal!.code);

async function until(check: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`never: ${what}`);
}

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

const titles = async (store: Store) => (await store.library()).templates.map((t) => t.title);
const DEC = { first: "2026-12-01", last: "2026-12-20" };

/** Adds an item to a template, which must be accepted. */
async function addItem(store: Store, template: string, item: string, text: string, after?: string): Promise<void> {
  ok(await store.changeTemplate(changeToText(after === undefined ? { op: "add", checklist: template, item, text } : { op: "add", checklist: template, item, text, after })));
}

/** Ana's library: Before leaving, with three items, then Packing. */
async function anasLibrary(ana: Store): Promise<{ before: string; packing: string }> {
  const before = ok(await ana.addTemplate({ title: "Before leaving" })).template;
  await addItem(ana, before, "i1", "Passport valid for six months");
  await addItem(ana, before, "i2", "Copies of documents", "i1");
  await addItem(ana, before, "i3", "Travel insurance", "i2");
  const packing = ok(await ana.addTemplate({ title: "Packing" })).template;
  return { before, packing };
}

describe("WEB:STORE-F8 — a device holds a copy of its traveller's library, brought up to date with their trips", () => {
  test("a second device, offline, gives both templates", async () => {
    const ana = await window(phone("ana"), "ana");
    await anasLibrary(ana);
    const secondPhone = phone("ana");
    const second = await window(secondPhone, "ana");
    await second.catchUpAll();
    offline(secondPhone);
    assert.deepEqual(await titles(second), ["Before leaving", "Packing"]);
    assert.ok((await second.library()).caughtUp > 0);
  });

  test("a rename and a delete on the first reach the second once it connects", async () => {
    const ana = await window(phone("ana"), "ana");
    const { before, packing } = await anasLibrary(ana);
    const secondPhone = phone("ana");
    const second = await window(secondPhone, "ana");
    await second.catchUpAll();
    offline(secondPhone);
    ok(await ana.changeTemplate(changeToText({ op: "rename", checklist: packing, title: "Packing for Chile" })));
    ok(await ana.deleteTemplate(before));
    await connect(secondPhone);
    assert.deepEqual(await titles(second), ["Packing for Chile"]);
  });

  test("a catch-up of the library cut halfway leaves its copy as it was", async () => {
    const ana = await window(phone("ana"), "ana");
    const { packing } = await anasLibrary(ana);
    const before = await ana.library();
    online.failNext = /^POST \/api\/library\/sync$/;
    ok(await ana.changeTemplate(changeToText({ op: "rename", checklist: packing, title: "Packing for Chile" })));
    assert.deepEqual(await ana.library(), before);
    await ana.catchUpAll();
    assert.deepEqual(await titles(ana), ["Before leaving", "Packing for Chile"]);
  });

  test("another window on the device is told of a change to the library", async () => {
    const on = phone("ana");
    const first = await window(on, "ana");
    const second = await window(on);
    const heard: string[][] = [];
    second.onLibrary((library) => heard.push(library.templates.map((t) => t.title)));
    ok(await first.addTemplate({ title: "Last day" }));
    await until(() => heard.some((t) => t.includes("Last day")), "the second window hears of Last day");
  });
});

describe("WEB:STORE-F9 — the trip store carries each request about a checklist or a template, and the copy shows what each did", () => {
  async function setUp() {
    const anaPhone = phone("ana");
    const ana = await window(anaPhone, "ana");
    const { before } = await anasLibrary(ana);
    const trip = ok(await ana.create("Patagonia", DEC, ["CL"])).trip;
    return { anaPhone, ana, before, trip };
  }
  const template = async (store: Store, id: string) => (await store.library()).templates.find((t) => t.id === id)!;

  test("a checklist started from Before leaving is in the trip's copy, with no item ticked, as soon as it is reported", async () => {
    const { ana, before, trip } = await setUp();
    const { checklist } = ok(await ana.addChecklist(trip, { from: await template(ana, before) }));
    const held = (await ana.trip(trip))!.checklists;
    assert.deepEqual(held.map((c) => c.id), [checklist]);
    assert.deepEqual(held[0]!.items.map((i) => i.text), ["Passport valid for six months", "Copies of documents", "Travel insurance"]);
    assert.ok(held[0]!.items.every((i) => i.ticked === undefined));
    assert.equal(held[0]!.trip, trip);
  });

  test("a tick sent with send is in the copy", async () => {
    const { ana, before, trip } = await setUp();
    const { checklist } = ok(await ana.addChecklist(trip, { from: await template(ana, before) }));
    ok(await ana.send(trip, "checklists", changeToText({ op: "tick", checklist, item: "i1", ticked: true })));
    assert.equal((await ana.trip(trip))!.checklists[0]!.items[0]!.ticked, true);
  });

  test("a checklist saved as a template is in the library's copy, with no item ticked", async () => {
    const { ana, before, trip } = await setUp();
    const { checklist } = ok(await ana.addChecklist(trip, { from: await template(ana, before) }));
    ok(await ana.send(trip, "checklists", changeToText({ op: "tick", checklist, item: "i2", ticked: true })));
    const onTrip = (await ana.trip(trip))!.checklists[0]!;
    const { template: saved } = ok(await ana.addTemplate({ from: onTrip }));
    const copy = await template(ana, saved);
    assert.equal(copy.items.length, 3);
    assert.ok(copy.items.every((i) => i.ticked === undefined));
    assert.deepEqual((await titles(ana)).at(-1), "Before leaving");
  });

  test("a deleted checklist and a deleted template are in neither copy", async () => {
    const { ana, before, trip } = await setUp();
    const { checklist } = ok(await ana.addChecklist(trip, { title: "Packing" }));
    ok(await ana.deleteChecklist(trip, checklist));
    ok(await ana.deleteTemplate(before));
    assert.deepEqual((await ana.trip(trip))!.checklists, []);
    assert.ok(!(await ana.library()).templates.some((t) => t.id === before));
  });

  test("checklists are arranged with a place change, and listed in their order", async () => {
    const { ana, trip } = await setUp();
    for (const title of ["First", "Second", "Third"]) ok(await ana.addChecklist(trip, { title }));
    const held = (await ana.trip(trip))!.checklists;
    const third = held.at(-1)!.id;
    ok(await ana.send(trip, "checklists", changeToText(ok(placeAfter(held, third)))));
    assert.deepEqual((await ana.trip(trip))!.checklists.map((c) => c.title), ["Third", "First", "Second"]);
  });

  test("with the device offline, each request is refused as offline, and nothing is sent", async () => {
    const { anaPhone, ana, before, trip } = await setUp();
    const from: Checklist = await template(ana, before);
    offline(anaPhone);
    const sent = online.requests.length;
    const results = [
      await ana.addChecklist(trip, { from }),
      await ana.deleteChecklist(trip, "any"),
      await ana.addTemplate({ title: "Offline" }),
      await ana.changeTemplate(changeToText({ op: "rename", checklist: before, title: "Offline" })),
      await ana.deleteTemplate(before),
      await ana.send(trip, "checklists", changeToText({ op: "tick", checklist: "any", item: "i1", ticked: true })),
    ];
    assert.deepEqual(results.map(code), Array(6).fill("offline"));
    assert.equal(online.requests.length, sent);
  });

  test("a refusal online is returned unchanged", async () => {
    const { ana, before, trip } = await setUp();
    const notMine = ok(newChecklist("theirs", "sam", "Sam's", []));
    assert.equal(code(await ana.addChecklist(trip, { from: notMine })), "not-yours");
    assert.equal(code(await ana.changeTemplate(changeToText({ op: "tick", checklist: before, item: "i1", ticked: true }))), "template-tick");
    assert.equal(code(await ana.deleteChecklist(trip, "nowhere")), "unknown-checklist");
  });
});

describe("WEB:STORE-F5 — signing out deletes the library too", () => {
  test("nothing of the library is left once the traveller signs out", async () => {
    const on = phone("ana");
    const ana = await window(on, "ana");
    await anasLibrary(ana);
    const told: number[] = [];
    ana.onLibrary((library) => told.push(library.templates.length));
    await ana.signOut();
    assert.deepEqual(await ana.library(), { templates: [], sequence: 0, caughtUp: 0 });
    assert.equal(told.at(-1), 0);
  });
});

describe("§4.1 — a database at version 1 is upgraded, and every trip caught up from the start", () => {
  test("a trip held before the upgrade is given its checklists at the next catch-up", async () => {
    // Version 1 of the device's database, as a device held it before checklists, with a trip
    // caught up to its latest sequence.
    const idb = new IDBFactory();
    const anaPhone = phone("ana", idb);
    const ana = await window(anaPhone, "ana");
    const trip = ok(await ana.create("Patagonia", DEC, ["CL"])).trip;
    ok(await ana.addChecklist(trip, { title: "Packing" }));
    const record = (await ana.trip(trip))!;
    await ana.signOut();

    const v1 = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const request = v1.open("itinero", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("account", { keyPath: "key" });
        db.createObjectStore("trips", { keyPath: "id" });
        db.createObjectStore("pages", { keyPath: ["trip", "id"] });
        db.createObjectStore("bookings", { keyPath: ["trip", "id"] });
        const t = request.transaction!;
        t.objectStore("account").put({ key: "me", account: "ana", signOutOwed: false });
        t.objectStore("trips").put({
          id: trip,
          name: record.name,
          dates: record.dates,
          mine: record.mine,
          you: record.you,
          calendar: null,
          graveyard: [],
          members: record.members,
          sequence: record.sequence,
          caughtUp: 1,
        });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const upgraded = await window({ ...phone("ana", v1), device: online.device("ana") });
    assert.equal((await upgraded.trip(trip))!.checklists.length, 0);
    await upgraded.catchUpAll();
    assert.deepEqual((await upgraded.trip(trip))!.checklists.map((c) => c.title), ["Packing"]);
  });
});
