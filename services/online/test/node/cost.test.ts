// PLN:HOST-NFR2 — a trip used by a few travellers costs nothing to host (docs/spec/planner/trip-host.md
// §4.7). The trip host's logic runs here on Node's SQLite, since the Workers runtime does not let a
// test time code: its clock stands still while code runs. Each request is timed on a trip of 500
// pages and 300 bookings, and a day of ten devices is counted against the free plan's limits.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { before, test } from "node:test";
import { bookingFromText, changeToText as bookingChange } from "@itinero/bookings";
import { changeToText as calendarChange } from "@itinero/itinerary";
import { changeToText as pageChange } from "@itinero/pages";
import { loadRules } from "@itinero/trip-time";
import { TripCore, type Member, type Row, type Sql } from "../../src/trip-core.ts";

/** The free plan's daily limits for Durable Objects with SQLite storage, and its storage limit. */
const FREE = { requests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000, storageBytes: 5 * 1024 ** 3 };
/** The trip host's own budget of processor time for one request, in milliseconds (§4.7). */
const BUDGET = 10;

/** A database that counts what it is asked, as Cloudflare bills it: rows read and rows written. */
class Counted {
  readonly db = new DatabaseSync(":memory:");
  rowsRead = 0;
  rowsWritten = 0;
  readonly sql: Sql = {
    exec: (query, ...bindings) => {
      const statement = this.db.prepare(query);
      if (/^\s*(INSERT|UPDATE|DELETE)/i.test(query)) {
        const result = statement.run(...bindings);
        this.rowsWritten += Number(result.changes);
        return [];
      }
      if (/^\s*CREATE/i.test(query)) {
        statement.run();
        return [];
      }
      const rows = statement.all(...bindings) as Row[];
      this.rowsRead += rows.length;
      return rows;
    },
    transaction: (run) => {
      this.db.exec("BEGIN");
      try {
        const value = run();
        this.db.exec("COMMIT");
        return value;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    },
  };

  bytes(): number {
    const row = this.db.prepare("SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()").get() as { bytes: number };
    return row.bytes;
  }
}

const TRIP = "4f0c2b8e-8c3a-4a8e-9a39-1f6b2d6c1e01";
const creator: Member = { traveller: "u-creator", admin: true, creator: true };
const travellers = Array.from({ length: 9 }, (_, i): Member => ({ traveller: `u-traveller-${i}`, admin: false, creator: false }));
const words = "Torres del Paine, the W trek, refugios, buses from Puerto Natales, and what to pack for wind. ";

let db: Counted;
let core: TripCore;

function ok<T>(result: { ok: true; value: T } | { ok: false; refusal: { code: string; message: string } }): T {
  if (!result.ok) assert.fail(`${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

const exact = (date: string, time: string) => ({ kind: "exact", zone: "America/Punta_Arenas", date, at: { time } });

before(() => {
  const rules = readFileSync(new URL(import.meta.resolve("@itinero/trip-time/rules/2026f.json")), "utf8");
  assert.ok(loadRules(rules).ok);
  db = new Counted();
  core = new TripCore(db.sql);
  ok(core.create(TRIP, creator, "Patagonia", "2026-12-01", "2026-12-20", ["CL", "AR"]));
  for (const who of travellers) ok(core.grant({ op: "add", traveller: who.traveller, trip: "edit", calendar: "view" }));
  // 500 pages, ten under each of 50, each with about 2,000 characters of text.
  for (let i = 0; i < 498; i++) {
    const parent = i < 48 ? undefined : `page-${i % 48}`;
    const add = { op: "add" as const, id: `page-${i}`, title: `Page ${i}`, text: words.repeat(20), at: parent ? { parent } : {} };
    ok(core.change(creator, "pages", pageChange(add)));
  }
  // 300 bookings, each naming two travellers.
  for (let i = 0; i < 300; i++) {
    const day = String(1 + (i % 20)).padStart(2, "0");
    const booking = {
      id: `booking-${i}`,
      revision: 0,
      travellers: [travellers[i % 9]!.traveller, travellers[(i + 1) % 9]!.traveller].sort(),
      details: { reference: `REF${i}` },
      kind: "activity",
      sort: "tour",
      title: `Tour ${i}`,
      starts: exact(`2026-12-${day}`, "09:00"),
    };
    ok(core.change(creator, "bookings", bookingChange({ op: "add", booking } as Parameters<typeof bookingChange>[0])));
  }
  ok(core.change(creator, "pages", pageChange({ op: "bury", id: "page-60" })));
});

/** The longest of five runs of a request, in milliseconds. */
function longest(run: () => unknown): number {
  let most = 0;
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    run();
    most = Math.max(most, performance.now() - started);
  }
  return most;
}

test("the trip holds 500 pages and 300 bookings", () => {
  const body = ok(core.sync(creator, undefined, false));
  assert.equal(body.pages.length + 1, 500); // and the buried page
  assert.equal(body.bookings.length, 300);
});

test("PLN:HOST-NFR2 — no request takes more than the trip host's budget of processor time", () => {
  const traveller = travellers[0]!;
  const sequence = ok(core.sync(creator, undefined, false)).sequence;
  let n = 0;
  const times: Record<string, number> = {
    "the first catch-up after waking": (() => {
      const started = performance.now();
      const woken = new TripCore(db.sql);
      ok(woken.sync(traveller, undefined, false));
      return performance.now() - started;
    })(),
    "a catch-up from the start": longest(() => ok(core.sync(traveller, undefined, false))),
    "a catch-up as an admin": longest(() => ok(core.sync(creator, undefined, false))),
    "a catch-up of one change": longest(() => ok(core.sync(traveller, sequence - 1, true))),
    "a page renamed": longest(() => ok(core.change(creator, "pages", pageChange({ op: "rename", id: "page-100", title: `Renamed ${n++}` })))),
    "a page moved": longest(() => ok(core.change(creator, "pages", pageChange({ op: "move", id: "page-101", to: { parent: `page-${n++ % 48}` } }), 9))),
    "a stretch pencilled": longest(() =>
      ok(core.change(creator, "calendar", calendarChange({ op: "pencil", stretch: { id: `s-${n++}`, place: { country: "CL" }, first: "2026-12-01", last: "2026-12-05" } }))),
    ),
    "a grant changed": longest(() =>
      ok(core.change(creator, "grants", JSON.stringify({ op: "calendar", traveller: traveller.traveller, level: n++ % 2 ? "view" : "edit" }))),
    ),
    "a booking changed": longest(() => {
      const held = ok(core.bookings(creator, ["booking-7"]))[0]!;
      const booking = ok(bookingFromText(held));
      const changed = { ...booking, details: { reference: `NEW${n++}` } };
      ok(core.change(creator, "bookings", bookingChange({ op: "change", booking: changed, base: booking.revision })));
    }),
    "pages fetched by identifier": longest(() => ok(core.pages(traveller, Array.from({ length: 50 }, (_, i) => `page-${i}`)))),
    "bookings fetched by identifier": longest(() => ok(core.bookings(traveller, Array.from({ length: 50 }, (_, i) => `booking-${i}`)))),
    "a buried page read": longest(() => ok(core.buried(creator, "page-60"))),
    "a traveller removed and added back": longest(() => {
      ok(core.grant({ op: "remove", traveller: "u-traveller-8" }));
      ok(core.grant({ op: "add", traveller: "u-traveller-8", trip: "edit", calendar: "view" }));
    }),
  };
  const report = Object.entries(times).map(([what, ms]) => `${what}: ${ms.toFixed(2)} ms`);
  console.log(report.join("\n"));
  for (const [what, ms] of Object.entries(times)) assert.ok(ms <= BUDGET, `${what} took ${ms.toFixed(2)} milliseconds`);
});

test("PLN:HOST-NFR2 — ten devices, a change a minute for four hours, stay within the free plan's day", () => {
  // Thirty minutes are run, and counted four hours' worth: eight times as much.
  const MINUTES = 30;
  const devices = [creator, ...travellers];
  const held = new Map(devices.map((who) => [who.traveller, ok(core.sync(who, undefined, false)).sequence]));
  const start = { read: db.rowsRead, written: db.rowsWritten };
  let requests = 0;
  for (let minute = 0; minute < MINUTES; minute++) {
    const who = devices[minute % devices.length]!;
    const page = `page-${minute % 48}`;
    ok(core.change(who.admin ? who : creator, "pages", pageChange({ op: "rename", id: page, title: `Minute ${minute}` })));
    requests++;
    // Every open device is told, and catches up once.
    for (const device of devices) {
      const body = ok(core.sync(device, held.get(device.traveller), true));
      held.set(device.traveller, body.sequence);
      requests++;
    }
  }
  const scale = (4 * 60) / MINUTES;
  const day = {
    requests: requests * scale,
    rowsRead: (db.rowsRead - start.read) * scale,
    rowsWritten: (db.rowsWritten - start.written) * scale,
    storageBytes: db.bytes(),
  };
  console.log(`A day of ten devices: ${JSON.stringify(day)}`);
  assert.ok(day.requests <= FREE.requests, `${day.requests} requests`);
  assert.ok(day.rowsRead <= FREE.rowsRead, `${day.rowsRead} rows read`);
  assert.ok(day.rowsWritten <= FREE.rowsWritten, `${day.rowsWritten} rows written`);
  assert.ok(day.storageBytes <= FREE.storageBytes, `${day.storageBytes} bytes stored`);
});
