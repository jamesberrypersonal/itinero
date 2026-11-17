// The trip store in each engine, against the online side running in Wrangler
// (docs/spec/web/trip-store.md §4.7): a trip open in two windows and on two devices
// (WEB:STORE-F3, WEB:STORE-F6), a copy read with no connection (WEB:STORE-F1), and the checks of
// PLN:ITINERARY-NFR1, PLN:PAGES-NFR1 and ACC:PERMISSIONS-NFR1 that need a device with no
// connection, compared with the same checks on Node.js. The checks on a phone are made by hand.

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { changeToText as bookingChange, type Booking } from "@itinero/bookings";
import * as itinerary from "@itinero/itinerary";
import * as pagesPackage from "@itinero/pages";
import * as permissions from "@itinero/permissions";
import { loadRules } from "@itinero/trip-time";
import { readFileSync } from "node:fs";
import type * as StoreModule from "../../src/store/index.ts";
import { versionDir } from "./versions.ts";
import { startWrangler, type Account, type Wrangler } from "./wrangler.ts";

declare global {
  interface Window {
    itineroStore: typeof StoreModule;
    itineroPackages: { itinerary: typeof itinerary; pages: typeof pagesPackage; permissions: typeof permissions };
    seen: { titles: string[]; references: string[] };
  }
}

// Node.js makes the same checks as each window, with the same rules the version carries.
loadRules(readFileSync(new URL(import.meta.resolve("@itinero/trip-time/rules/2026f.json")), "utf8"));

const ANA: Account = { id: "u-ana", name: "Ana", email: "ana@example.com" };
let online: Wrangler;

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async ({ browserName }) => {
  online = await startWrangler(versionDir("one"), [ANA], browserName);
});

test.afterAll(async () => {
  await online?.stop();
});

/** A device signed in as Ana, with the settings given. */
async function device(browser: import("@playwright/test").Browser, options: { timezoneId?: string; locale?: string } = {}): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  const host = new URL(online.url).hostname;
  await context.addCookies([{ name: "itinero_session", value: online.session(ANA), domain: host, path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
  return context;
}

/** Opens a window of Itinero, and waits until its trip store has opened. */
async function openWindow(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(online.url);
  await page.waitForFunction(() => window.itineroStore !== undefined);
  await page.evaluate(() => window.itineroStore.open());
  return page;
}

async function signIn(page: Page): Promise<void> {
  await page.evaluate((account) => window.itineroStore.signedIn(account), ANA.id);
}

/** Watches a trip in a window, keeping its page titles and booking references as it changes. */
async function watching(page: Page, trip: string): Promise<void> {
  await page.evaluate((id) => {
    window.seen = { titles: [], references: [] };
    window.itineroStore.watch(id, (copy) => {
      window.seen = {
        titles: copy?.pages.pages.map((p) => p.title) ?? [],
        references: copy?.bookings.map((b) => b.details.reference ?? "") ?? [],
      };
    });
  }, trip);
}

async function send(page: Page, trip: string, target: string, change: string): Promise<void> {
  const result = await page.evaluate(({ id, target, change }) => window.itineroStore.send(id, target as "pages", change), { id: trip, target, change });
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
}

const flight = (reference: string) =>
  ({
    id: "la800",
    revision: 0,
    travellers: [ANA.id],
    details: { reference },
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
  }) as const;

test("WEB:STORE-F3, WEB:STORE-F6 — a trip open in two windows and on two devices takes each change within five seconds", async ({ browser }) => {
  const laptop = await device(browser);
  const first = await openWindow(laptop);
  await signIn(first);
  const trip = await first.evaluate(async () => {
    const made = await window.itineroStore.create("Patagonia", { first: "2026-12-01", last: "2026-12-20" }, ["CL", "AR"]);
    if (!made.ok) throw new Error(made.refusal.message);
    return made.value.trip;
  });
  const second = await openWindow(laptop);
  const phone = await device(browser);
  const other = await openWindow(phone);
  await signIn(other);
  await watching(second, trip);
  await watching(other, trip);

  // A page renamed in the first window reaches the second window and the second device.
  await send(first, trip, "pages", pagesPackage.changeToText({ op: "rename", id: "country-cl", title: "Chile, live" }));
  for (const page of [second, other]) {
    await page.waitForFunction(() => window.seen.titles.includes("Chile, live"), undefined, { timeout: 5_000 });
  }

  // The second device's connection breaks for a minute, while a booking is added.
  await phone.setOffline(true);
  await send(first, trip, "bookings", bookingChange({ op: "add", booking: flight("K7Q2ZP") as unknown as Booking }));
  await other.waitForTimeout(60_000);
  expect(await other.evaluate(() => window.seen.references)).toEqual([]);
  await phone.setOffline(false);
  await other.waitForFunction(() => window.seen.references.includes("K7Q2ZP"), undefined, { timeout: 5_000 });

  await laptop.close();
  await phone.close();
});

/** Every check the three requirements name, made on a copy, the same in a window and on Node.js. */
type Checks = {
  layout: unknown;
  calendarReadBack: boolean;
  links: unknown;
  search: unknown;
  pagesReadBack: boolean;
  levels: unknown;
  seen: unknown;
};

/** The texts a copy is made of, to make the same checks on Node.js. */
type Texts = { calendar: string; pages: string[]; grants: string; traveller: string };

function checks(texts: Texts, packages: { itinerary: typeof itinerary; pages: typeof pagesPackage; permissions: typeof permissions }): Checks {
  const { itinerary: it, pages: pg, permissions: pm } = packages;
  const read = <T>(r: { ok: true; value: T } | { ok: false; refusal: { message: string } }): T => {
    if (!r.ok) throw new Error(r.refusal.message);
    return r.value;
  };
  const trip = read(it.tripFromText(texts.calendar));
  const pages = { trip: trip.id, pages: texts.pages.map((t) => read(pg.pageFromText(t))).sort((a, b) => (a.id < b.id ? -1 : 1)) };
  const grants = read(pm.grantsFromText(texts.grants));
  const sam = { traveller: "u-sam", admin: false };
  const href = pg.pageLink("istanbul", "Istanbul");
  return {
    // PLN:ITINERARY-F5 and F8: the days laid out, and the calendar read back unchanged.
    layout: read(it.layout(trip, "2026-12-01", "2026-12-08")),
    calendarReadBack: it.tripToText(read(it.tripFromText(it.tripToText(trip)))) === texts.calendar,
    // PLN:PAGES-F5, F7 and F8: a link and where its page is, a search, and each page read back.
    links: { href, target: pg.linkTarget(href), state: pg.state(pages, pg.linkTarget(href)!), buried: pg.state(pages, "nowhere") },
    search: ["İstanbul", "istanbul", "ISTANBUL", "Chile"].map((words) => read(pg.search(pages, words)).map((hit) => hit.page.id)),
    pagesReadBack: pages.pages.every((p, i) => pg.pageToText(p) === texts.pages.find((t) => read(pg.pageFromText(t)).id === p.id) && i >= 0),
    // ACC:PERMISSIONS-F1 and F5: a traveller's level for each page, and what their phone may hold.
    levels: pages.pages.map((p) => [p.id, pm.pageLevel(grants, sam, pages, p.id)]),
    seen: pm.seen(grants, sam, pages).pages.pages.map((p) => p.id),
  };
}

test("WEB:STORE-F1, and PLN:ITINERARY-NFR1, PLN:PAGES-NFR1 and ACC:PERMISSIONS-NFR1 with no connection", async ({ browser }) => {
  // Two devices: one in English and London time, one in Turkish and Tokyo time.
  const london = await device(browser, { timezoneId: "Europe/London", locale: "en-GB" });
  const tokyo = await device(browser, { timezoneId: "Asia/Tokyo", locale: "tr-TR" });
  const first = await openWindow(london);
  await signIn(first);
  const trip = await first.evaluate(async () => {
    const store = window.itineroStore;
    const { itinerary: it, pages: pg, permissions: pm } = window.itineroPackages;
    const made = await store.create("Patagonia", { first: "2026-12-01", last: "2026-12-20" }, ["CL", "TR"]);
    if (!made.ok) throw new Error(made.refusal.message);
    const id = made.value.trip;
    const send = async (target: string, change: string) => {
      const sent = await store.send(id, target as "pages", change);
      if (!sent.ok) throw new Error(sent.refusal.message);
    };
    await send("pages", pg.changeToText({ op: "add", id: "istanbul", title: "İstanbul", text: "Ferries across the Bosphorus.", at: { parent: "country-tr" } }));
    await send("pages", pg.changeToText({ op: "add", id: "food", title: "Food", text: `Lunch near ${pg.pageLink("istanbul", "the bridge")}.`, at: {} }));
    await send("calendar", it.changeToText({ op: "pencil", stretch: { id: "s1", place: { country: "CL" }, first: "2026-12-01", last: "2026-12-05" } }));
    await send("calendar", it.changeToText({ op: "add-firm", item: { id: "f1", revision: 0, title: "Fly to Punta Arenas", when: { kind: "exact", zone: "America/Santiago", date: "2026-12-06", at: { time: "07:05" } } } }));
    void pm;
    return id;
  });
  // A second traveller's access, so the levels differ by page. Sam is not a member, so the grants
  // are built on the copy's own, as an admin's copy holds them.
  const texts = async (page: Page): Promise<Texts> =>
    page.evaluate(async (id) => {
      const { itinerary: it, pages: pg, permissions: pm } = window.itineroPackages;
      const copy = (await window.itineroStore.trip(id))!;
      let grants = copy.grants!;
      const add = pm.applyGrant(grants, copy.pages, { op: "add", traveller: "u-sam", trip: "view", calendar: "none" });
      if (add.ok) grants = add.value;
      const hide = pm.applyGrant(grants, copy.pages, { op: "page", traveller: "u-sam", page: "country-tr", level: "none" });
      if (hide.ok) grants = hide.value;
      return { calendar: it.tripToText(copy.calendar!), pages: copy.pages.pages.map(pg.pageToText), grants: pm.grantsToText(grants), traveller: "u-sam" };
    }, trip);

  const onTokyo = await openWindow(tokyo);
  await signIn(onTokyo);

  // Both devices go offline, close every window, and open Itinero again.
  for (const context of [london, tokyo]) {
    await context.setOffline(true);
    for (const page of context.pages()) await page.close();
  }
  const results: Checks[] = [];
  for (const context of [london, tokyo]) {
    const page = await context.newPage();
    await page.goto(online.url);
    await page.waitForFunction(() => window.itineroStore !== undefined);
    expect(await page.evaluate(() => window.itineroStore.open())).toEqual({ account: ANA.id });
    expect(await page.evaluate(() => window.itineroStore.isOnline())).toBe(false);
    const listed = await page.evaluate(() => window.itineroStore.trips());
    expect(listed.map((t) => t.id)).toContain(trip);
    expect(listed.find((t) => t.id === trip)!.caughtUp).toBeGreaterThan(Date.now() - 600_000);
    const held = await texts(page);
    results.push(await page.evaluate(({ held, source }) => (new Function(`return ${source}`)() as typeof checks)(held, window.itineroPackages), { held, source: checks.toString() }));
    // The same checks on Node.js, the online side's runtime, from the same texts.
    expect(results.at(-1)).toEqual(checks(held, { itinerary, pages: pagesPackage, permissions }));
  }
  expect(results[0]).toEqual(results[1]);
  const result = results[0]!;
  expect(result.calendarReadBack).toBe(true);
  expect(result.pagesReadBack).toBe(true);
  // "İstanbul", "istanbul" and "ISTANBUL" find the same pages, whatever language the device is set to.
  const [dotted, lower, upper] = result.search as string[][];
  expect(dotted).toContain("istanbul");
  expect(lower).toEqual(dotted);
  expect(upper).toEqual(dotted);
  expect(result.seen).not.toContain("istanbul");
  expect(result.seen).not.toContain("country-tr");
  await london.close();
  await tokyo.close();
});
