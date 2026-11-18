// The requirements of web/screens the first screens meet, and the bookings system's that need the
// bookings page, each by the verification it carries, in each engine, at a phone's width and a
// computer's (docs/spec/web/screens.md §4.9). The online side runs in Wrangler, with stand-ins for
// Google and Resend. The checks that need a real phone are made by hand.

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { startOutside, type Outside } from "./outside.ts";
import {
  booking,
  bookingChange,
  calendarChange,
  createTrip,
  device,
  exact,
  invite,
  newTraveller,
  noSidewaysScroll,
  pageChange,
  send,
  signIn,
} from "./screens-helpers.ts";
import { versionDir } from "./versions.ts";
import { startWrangler, type Wrangler } from "./wrangler.ts";

let online: Wrangler;
let outside: Outside;
let engine = "";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async ({ browserName }) => {
  engine = browserName;
  outside = await startOutside();
  online = await startWrangler(versionDir("one"), [], `trip-${browserName}`, {
    GOOGLE_CLIENT_ID: "itinero-test.apps.googleusercontent.com",
    GOOGLE_KEYS_URL: `${outside.url}/keys`,
    RESEND_URL: `${outside.url}/emails`,
    RESEND_API_KEY: "re_test",
    SESSION_COOKIE_INSECURE: "yes",
  });
});

test.afterAll(async () => {
  await online?.stop();
  await outside?.close();
});

type Traveller = { context: BrowserContext; page: Page; account: string; email: string };
let count = 0;

/** A traveller signed in on a device of their own. */
async function traveller(browser: Browser, name: string, kind: "phone" | "computer" = "phone", options: Parameters<Browser["newContext"]>[0] = {}): Promise<Traveller> {
  count++;
  const email = `${name.toLowerCase()}${count}@example.com`;
  const context = await device(browser, kind, options);
  const page = await newTraveller(context, online, { sub: `${engine}-${name}-${count}`, email, name }, name);
  const account = await page.evaluate(async () => (await (window as unknown as { itineroStore: { open(): Promise<{ account?: string }> } }).itineroStore.open()).account!);
  return { context, page, account, email };
}

/** Invites a traveller to a trip, and has them accept from the email's link. */
async function join(admin: Traveller, who: Traveller, trip: string, level = "edit", calendar = "none"): Promise<void> {
  const link = await invite(admin.page, outside, trip, who.email, level, calendar);
  await who.page.goto(new URL(link, online.url).href);
  await expect(who.page.locator('[data-screen="home"]')).toBeVisible();
}

const at = (path: string) => new URL(path, online.url).href;

/** Opens a screen of a trip, and waits for it to draw. */
async function screen(page: Page, path: string, name: string): Promise<void> {
  await page.goto(at(path));
  await expect(page.locator(`[data-screen="${name}"]`)).toBeVisible();
}

async function catchUp(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { itineroStore: { catchUpAll(): Promise<void> } }).itineroStore.catchUpAll());
}

/** Sets the device's clock, from the next page drawn, to a time in a zone's local time. */
async function clock(page: Page, when: string): Promise<void> {
  await page.clock.setFixedTime(new Date(when));
}

const PUNTA_ARENAS = "America/Punta_Arenas";
const SANTIAGO = "America/Santiago";

test("WEB:SCREENS-F2 — the home page shows the traveller's day, their bookings for today and next, and the page for their country", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const sam = await traveller(browser, "Sam", "phone", { geolocation: { latitude: -33.45, longitude: -70.66 }, permissions: ["geolocation"] });
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL", "AR"]);
  await join(ana, sam, trip);
  await send(sam.page, trip, "calendar", calendarChange({ op: "traveller-dates", traveller: sam.account, dates: { first: "2026-12-06", last: "2026-12-13" } }));
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "tour", travellers: [sam.account], kind: "activity", sort: "tour", title: "Torres del Paine full day", starts: exact(PUNTA_ARENAS, "2026-12-09", "07:30") }) }));
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "flight", travellers: [sam.account], kind: "flight", seats: [], legs: [{ flight: "LA 98", from: { code: "PUQ", name: "Punta Arenas" }, to: { code: "SCL", name: "Santiago" }, leaves: exact(PUNTA_ARENAS, "2026-12-11", "12:10"), arrives: exact(SANTIAGO, "2026-12-11", "15:35") }] }) }));
  await catchUp(sam.page);

  await clock(sam.page, "2026-12-03T12:00:00");
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(sam.page.locator("[data-day]")).toHaveText("3 days to go");

  await clock(sam.page, "2026-12-09T12:00:00");
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(sam.page.locator("[data-day]")).toHaveText("Day 4 of 8");
  await expect(sam.page.locator(".group", { hasText: "Today" })).toContainText("Torres del Paine full day");
  await expect(sam.page.locator(".group", { hasText: "Next" })).toContainText("LA 98");

  // Online, nothing the phone sends holds its position or its country.
  const sent: string[] = [];
  sam.page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`));
  await sam.page.locator('[data-action="find-country"]').click();
  await expect(sam.page.locator('a [data-country="CL"]')).toBeVisible();
  for (const request of sent) {
    expect(request).not.toMatch(/-33\.4|-70\.6|"CL"|country=CL/);
  }

  // Offline in Chile, the country is found on the phone, and links to its page.
  await sam.context.setOffline(true);
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(sam.page.locator('a [data-country="CL"]')).toBeVisible();
  await sam.page.locator('a:has([data-country="CL"])').click();
  await expect(sam.page.locator('[data-screen="page"] .title')).toHaveText("Chile");
  await sam.context.setOffline(false);

  await clock(sam.page, "2026-12-14T12:00:00");
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(sam.page.locator("[data-day]")).toHaveText("Your trip is over");

  // A traveller who refuses the location sees their day and bookings, and no country.
  const kim = await traveller(browser, "Kim", "phone");
  await join(ana, kim, trip);
  await kim.page.locator('[data-action="find-country"]').click();
  await kim.page.waitForTimeout(1_000);
  await expect(kim.page.locator("[data-day]")).toBeVisible();
  await expect(kim.page.locator(".group", { hasText: "Today" })).toBeVisible();
  await expect(kim.page.locator("[data-country]")).toHaveCount(0);
  for (const t of [ana, sam, kim]) await t.context.close();
});

test("WEB:SCREENS-F4, BKG-F2, BKG-F3 — the bookings page opens at the next, and each booking shows its times in their place's local time", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const fran = await traveller(browser, "Fran", "phone");
  const kim = await traveller(browser, "Kim", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-11-25", "2026-12-20", ["CL"]);
  await join(ana, fran, trip);
  await join(ana, kim, trip);
  const add = (b: Record<string, unknown>) => send(fran.page, trip, "bookings", bookingChange({ op: "add", booking: booking(b) }));
  await add({ id: "stay", travellers: [fran.account], kind: "stay", name: "Hotel Plaza San Francisco", checkIn: { kind: "date", zone: SANTIAGO, date: "2026-11-29" }, checkOut: { kind: "approx", zone: SANTIAGO, date: "2026-12-01", at: { time: "11:00" } } });
  await add({ id: "tour", travellers: [fran.account], kind: "activity", sort: "tour", title: "Wine tour", starts: exact(SANTIAGO, "2026-12-01", "09:00") });
  await add({
    id: "flight",
    travellers: [fran.account],
    details: { reference: "K7Q2ZP" },
    kind: "flight",
    seats: [],
    legs: [
      { flight: "LA 704", from: { code: "SCL", name: "Santiago" }, to: { code: "MAD", name: "Madrid" }, leaves: exact(SANTIAGO, "2026-12-01", "23:40"), arrives: exact("Europe/Madrid", "2026-12-02", "16:35") },
      { flight: "IB 3170", from: { code: "MAD", name: "Madrid" }, to: { code: "LIS", name: "Lisbon" }, leaves: exact("Europe/Madrid", "2026-12-02", "19:05"), arrives: exact("Europe/Lisbon", "2026-12-02", "19:25") },
    ],
  });
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "kims", travellers: [kim.account], kind: "activity", sort: "table", title: "Dinner for Kim", starts: exact(SANTIAGO, "2026-12-01", "20:00") }) }));
  await catchUp(fran.page);

  // BKG-F3: the stay, then the tour, then the flight; the stay shows both its dates; Kim's is not listed.
  await clock(fran.page, "2026-12-01T15:00:00Z"); // 12:00 in Santiago
  await screen(fran.page, `/trips/${trip}/bookings`, "bookings");
  const rows = fran.page.locator('[data-screen="bookings"] .row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Hotel Plaza San Francisco");
  await expect(rows.nth(1)).toContainText("Wine tour");
  await expect(rows.nth(2)).toContainText("LA 704");
  await expect(fran.page.locator(".booking-day").first().locator(".group-heading")).toHaveText("Sun 29 Nov – 1 Dec");
  await expect(fran.page.getByText("Dinner for Kim")).toHaveCount(0);
  // It opens at the flight, with the stay and the tour above it.
  const next = fran.page.locator(".booking-day[data-next]");
  await expect(next).toContainText("LA 704");
  // Scrolled to the flight, or as far towards it as the page goes, with the flight in view.
  const placed = await next.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const most = document.documentElement.scrollHeight - innerHeight;
    return { top: box.top, inView: box.top >= 0 && box.top < innerHeight, atEnd: scrollY >= most - 2, scrolled: scrollY };
  });
  expect(placed.inView).toBe(true);
  expect(placed.top < 200 || placed.atEnd).toBe(true);
  expect(await rows.nth(0).evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(placed.top);

  // BKG-F2 and BKG:FLIGHT-F3: each time in its place's local time, each leg's duration, and the connection.
  await fran.page.locator(".row", { hasText: "LA 704" }).click();
  await expect(fran.page.locator('[data-screen="booking"]')).toBeVisible();
  await expect(fran.page.getByText("Tue 1 December 2026, 23:40, Santiago time")).toBeVisible();
  await expect(fran.page.getByText("Wed 2 December 2026, 16:35, Madrid time")).toBeVisible();
  await expect(fran.page.locator('[data-leg-duration="0"]')).toHaveText("12 h 55 min");
  await expect(fran.page.locator('[data-connection="0"]')).toContainText("2 h 30 min");

  // BKG-F4: the reference is copied in one tap.
  await fran.page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => void ((window as unknown as { copied: string }).copied = text) }, configurable: true });
  });
  await fran.page.locator('[data-action="copy-reference"]').click();
  await expect(fran.page.locator('[data-action="copy-reference"]')).toContainText("Copied");
  expect(await fran.page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe("K7Q2ZP");

  // Adding a journey asks how it goes, where from and to, and its times, and not for a flight number.
  await fran.page.clock.setFixedTime(new Date("2026-11-20T12:00:00Z"));
  await screen(fran.page, `/trips/${trip}/bookings/new`, "booking-kind");
  await fran.page.locator('[data-kind="journey"]').click();
  const form = fran.page.locator('[data-screen="booking-form"]');
  await expect(form.locator('select[name="by"]')).toBeVisible();
  await expect(form.locator('input[name="from"]')).toBeVisible();
  await expect(form.locator('input[name="to"]')).toBeVisible();
  await expect(form.locator('[data-time="leaves"]')).toBeVisible();
  await expect(form.locator('input[name*="flight"]')).toHaveCount(0);

  // BKG-F2: a journey with no arrival is accepted with no duration; one arriving before it leaves is refused.
  await form.locator('input[name="from"]').fill("Punta Arenas");
  await form.locator('input[name="to"]').fill("Puerto Natales");
  await form.locator('input[name="leaves-date"]').fill("2026-12-09");
  await form.locator('input[name="leaves-time"]').fill("13:00");
  await form.locator('input[name="leaves-zone"]').fill(PUNTA_ARENAS);
  await form.locator('input[name="has-arrival"]').check();
  await form.locator('input[name="arrives-date"]').fill("2026-12-09");
  await form.locator('input[name="arrives-time"]').fill("11:00");
  await form.locator('input[name="arrives-zone"]').fill(PUNTA_ARENAS);
  await form.locator('[data-action="save-booking"]').click();
  await expect(form.locator(".refused")).toContainText(/before/);
  await form.locator('input[name="has-arrival"]').uncheck();
  await form.locator('[data-action="save-booking"]').click();
  await expect(fran.page.locator('[data-screen="booking"]')).toBeVisible();
  await expect(fran.page.getByText("Takes")).toHaveCount(0);
  for (const t of [ana, fran, kim]) await t.context.close();
});

test("BKG-F4, BKG-F6 — a booking shows its details, and is read with no connection", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const sam = await traveller(browser, "Sam", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "natales", title: "Puerto Natales", at: { parent: "country-cl" } }));
  await join(ana, sam, trip);
  await send(ana.page, trip, "bookings", bookingChange({
    op: "add",
    booking: booking({
      id: "stay",
      travellers: [ana.account, sam.account],
      details: { reference: "K7Q2ZP", provider: "Hostal Lady Florence", link: "https://example.com/lady-florence", notes: "Ring the bell on arrival.", page: "natales" },
      kind: "stay",
      name: "Hostal Lady Florence",
      checkIn: { kind: "date", zone: PUNTA_ARENAS, date: "2026-12-09" },
      checkOut: { kind: "date", zone: PUNTA_ARENAS, date: "2026-12-12" },
    }),
  }));
  await screen(ana.page, `/trips/${trip}/bookings/stay`, "booking");
  for (const text of ["K7Q2ZP", "Hostal Lady Florence", "Ring the bell on arrival.", "Puerto Natales", "Opens in a new tab"]) await expect(ana.page.getByText(text).first()).toBeVisible();
  await expect(ana.page.locator('a[href="https://example.com/lady-florence"]')).toHaveAttribute("target", "_blank");
  await ana.page.locator(".row", { hasText: "Puerto Natales" }).click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Puerto Natales");

  // Sam may not see the page, so the stay says only that it is not available.
  await send(ana.page, trip, "grants", JSON.stringify({ op: "page", page: "natales", level: "none", traveller: sam.account }));
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/bookings/stay`, "booking");
  await expect(sam.page.locator('.row:has(.row-main:text-is("Page"))')).toContainText("Not available");
  await expect(sam.page.getByText("Puerto Natales")).toHaveCount(0);

  // BKG-F6: offline, the phone shows the stay with its reference and notes, as they were.
  await sam.context.setOffline(true);
  await send(ana.page, trip, "bookings", bookingChange({ op: "change", base: 1, booking: booking({ id: "stay", revision: 1, travellers: [ana.account, sam.account], details: { reference: "K7Q2ZP", notes: "Ring twice." }, kind: "stay", name: "Hostal Lady Florence", checkIn: { kind: "date", zone: PUNTA_ARENAS, date: "2026-12-09" }, checkOut: { kind: "date", zone: PUNTA_ARENAS, date: "2026-12-12" } }) }));
  await screen(sam.page, `/trips/${trip}/bookings/stay`, "booking");
  await expect(sam.page.getByText("Ring the bell on arrival.")).toBeVisible();
  await expect(sam.page.getByText("K7Q2ZP")).toBeVisible();
  await sam.context.setOffline(false);
  await catchUp(sam.page);
  await expect(sam.page.getByText("Ring twice.")).toBeVisible();
  for (const t of [ana, sam]) await t.context.close();
});

test("WEB:SCREENS-F5 — pages show their text formatted, open the pages they link to, and are searched with no connection", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const sam = await traveller(browser, "Sam", "computer");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "santiago", title: "Santiago", text: "Empanadas at the Mercado Central.", at: { parent: "country-cl" } }));
  await send(ana.page, trip, "pages", pageChange({ op: "write", id: "country-cl", base: 1, text: "| From | To | Bus |\n|---|---|---|\n| Punta Arenas | Puerto Natales | 3 h |\n\nSee [Santiago](#page:santiago), and [Liguria](https://liguria.cl).\n\n<script>window.ran = true</script><img src=x onerror=\"window.ran = true\">" }));
  await join(ana, sam, trip);

  await screen(ana.page, `/trips/${trip}/pages/country-cl`, "page");
  await expect(ana.page.locator(".prose table td").first()).toHaveText("Punta Arenas");
  await expect(ana.page.locator('.prose a[href="https://liguria.cl/"], .prose a[href="https://liguria.cl"]')).toHaveAttribute("rel", /noreferrer/);
  await expect(ana.page.locator(".prose")).toContainText("<script>window.ran = true</script>");
  expect(await ana.page.evaluate(() => (window as unknown as { ran?: boolean }).ran)).toBeUndefined();
  await ana.page.locator(".prose a", { hasText: "Santiago" }).click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Santiago");

  // A traveller who may not see Santiago is told only that the page is not available.
  await send(ana.page, trip, "grants", JSON.stringify({ op: "page", page: "santiago", level: "none", traveller: sam.account }));
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/pages/country-cl`, "page");
  await expect(sam.page.locator(".prose .unavailable")).toHaveText("Page not available");
  await expect(sam.page.locator(".prose")).not.toContainText("Santiago");

  // With no connection, a word of Santiago's text finds Santiago.
  await ana.context.setOffline(true);
  await screen(ana.page, `/trips/${trip}/search`, "search");
  await ana.page.locator('input[name="words"]').fill("empanadas");
  await expect(ana.page.locator('[data-hit="santiago"]')).toBeVisible();
  await ana.context.setOffline(false);
  await catchUp(ana.page);

  // Saving Chile from an older version than another traveller's save shows both texts.
  await send(ana.page, trip, "grants", JSON.stringify({ op: "unpage", page: "santiago", traveller: sam.account }));
  await catchUp(sam.page);
  await screen(ana.page, `/trips/${trip}/pages/country-cl/edit`, "page-editor");
  await screen(sam.page, `/trips/${trip}/pages/country-cl/edit`, "page-editor");
  await ana.page.locator('textarea[name="text"]').fill("Ana's Chile.");
  await ana.page.locator('[data-action="save-page"]').click();
  await expect(ana.page.locator('[data-screen="page"]')).toBeVisible();
  await sam.page.locator('textarea[name="text"]').fill("Sam's Chile.");
  await sam.page.locator('[data-action="save-page"]').click();
  await expect(sam.page.locator("[data-theirs] textarea")).toHaveValue("Ana's Chile.");
  await expect(sam.page.locator('textarea[name="text"]')).toHaveValue("Sam's Chile.");
  await sam.page.locator('textarea[name="text"]').fill("Ana's Chile. Sam's Chile.");
  await sam.page.locator('[data-action="save-page"]').click();
  await expect(sam.page.locator('[data-screen="page"] .prose')).toHaveText("Ana's Chile. Sam's Chile.");
  for (const t of [ana, sam]) await t.context.close();
});

test("WEB:SCREENS-F7 — every time is written in the clock the traveller chooses, which stays after signing out", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "train", travellers: [ana.account], kind: "journey", by: "train", from: "Santiago", to: "Chillán", leaves: exact(SANTIAGO, "2026-12-04", "09:10") }) }));
  await screen(ana.page, `/trips/${trip}/bookings/train`, "booking");
  await expect(ana.page.locator(".row", { hasText: "Leaves Santiago" })).toContainText("09:10");
  await screen(ana.page, "/settings", "settings");
  await ana.page.getByRole("radio", { name: "12-hour" }).click();
  await screen(ana.page, `/trips/${trip}/bookings/train`, "booking");
  await expect(ana.page.locator(".row", { hasText: "Leaves Santiago" })).toContainText("9:10 am");
  await screen(ana.page, "/settings", "settings");
  await ana.page.locator('[data-action="sign-out"]').click();
  await expect(ana.page.locator('[data-screen="sign-in"]')).toBeVisible();
  await signIn(ana.page, { sub: `${engine}-Ana-${count}`, email: ana.email, name: "Ana" });
  await expect(ana.page.locator('[data-screen="trips"]')).toBeVisible();
  await screen(ana.page, `/trips/${trip}/bookings/train`, "booking");
  await expect(ana.page.locator(".row", { hasText: "Leaves Santiago" })).toContainText("9:10 am");
  await ana.context.close();
});

test("WEB:SCREENS-F8 — deleting a page and removing a booking each ask first", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  for (const id of ["one", "two", "three"]) await send(ana.page, trip, "pages", pageChange({ op: "add", id, title: id, at: { parent: "country-cl" } }));
  await screen(ana.page, `/trips/${trip}/pages/country-cl`, "page");
  await ana.page.locator('[data-action="delete-page"]').click();
  await expect(ana.page.getByRole("alertdialog")).toContainText("4 pages will go");
  await expect(ana.page.locator('[data-dialog="cancel"]')).toBeFocused();
  await ana.page.locator('[data-dialog="cancel"]').click();
  await expect(ana.page.getByRole("alertdialog")).toHaveCount(0);
  expect((await ana.page.evaluate(async (id) => (await (window as unknown as { itineroStore: { trip(id: string): Promise<{ pages: { pages: unknown[] } }> } }).itineroStore.trip(id)).pages.pages.length, trip))).toBe(4);

  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "tour", travellers: [ana.account], kind: "activity", sort: "tour", title: "Wine tour", starts: exact(SANTIAGO, "2026-12-01", "09:00") }) }));
  await screen(ana.page, `/trips/${trip}/bookings/tour`, "booking");
  await ana.page.locator('[data-action="remove-booking"]').click();
  await expect(ana.page.getByRole("alertdialog")).toContainText("Wine tour will be removed");
  await ana.page.locator('[data-dialog="confirm"]').click();
  await expect(ana.page.locator('[data-screen="bookings"]')).toBeVisible();
  await ana.context.close();
});

test("BKG-F5 — a removed booking is gone from every traveller's bookings page", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const sam = await traveller(browser, "Sam", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await join(ana, sam, trip);
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "flight", travellers: [ana.account, sam.account], kind: "flight", seats: [], legs: [{ flight: "LA 98", from: { code: "PUQ" }, to: { code: "SCL" }, leaves: exact(PUNTA_ARENAS, "2026-12-11", "12:10"), arrives: exact(SANTIAGO, "2026-12-11", "15:35") }] }) }));
  await screen(sam.page, `/trips/${trip}/bookings`, "bookings");
  await expect(sam.page.getByText("LA 98")).toBeVisible();
  await screen(ana.page, `/trips/${trip}/bookings/flight`, "booking");
  await ana.page.locator('[data-action="remove-booking"]').click();
  await ana.page.locator('[data-dialog="confirm"]').click();
  await expect(ana.page.locator('[data-screen="bookings"]')).not.toContainText("LA 98");
  await expect(sam.page.locator('[data-screen="bookings"]')).not.toContainText("LA 98", { timeout: 5_000 });
  for (const t of [ana, sam]) await t.context.close();
});

/** Drags an element's centre onto another's, with the pointer, in steps, as a finger or a mouse would. */
async function drag(page: Page, from: ReturnType<Page["locator"]>, to: ReturnType<Page["locator"]>): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = (await from.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  const b = (await to.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

type TripWindow = { itineroStore: { trip(id: string): Promise<{ calendar?: { stretches: { id: string; first: string; last: string }[] }; pages: { pages: { id: string; parent?: string }[] } }> } };
const held = (page: Page, trip: string) => page.evaluate(async (id) => (await (window as unknown as TripWindow).itineroStore.trip(id))!, trip);

test("WEB:SCREENS-F3 — the calendar shows each day's countries, stretches pencilled, and firm items and bookings apart, only to a traveller granted it", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const sam = await traveller(browser, "Sam", "phone");
  const kim = await traveller(browser, "Kim", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await join(ana, sam, trip, "edit", "view");
  await join(ana, kim, trip, "edit", "none");

  // Ana pencils Chile from 1 to 10 December, from the calendar.
  await screen(ana.page, `/trips/${trip}/calendar`, "calendar");
  await ana.page.locator('[data-date="2026-12-01"] [data-action="add-to-day"]').click();
  await ana.page.locator('[data-action="add-stretch"]').click();
  const stretchForm = ana.page.locator('[data-form="stretch"]');
  await stretchForm.locator('select[name="country"]').selectOption("CL");
  await stretchForm.locator('input[name="last"]').fill("2026-12-10");
  await stretchForm.locator('[data-action="save-stretch"]').click();
  await expect(ana.page.locator('[data-date="2026-12-10"] .stretch')).toHaveCount(1);
  await expect(ana.page.locator('[data-date="2026-12-11"] .stretch')).toHaveCount(0);

  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "santiago", title: "Santiago", at: { parent: "country-cl" } }));
  await send(ana.page, trip, "calendar", calendarChange({ op: "pencil", stretch: { id: "santiago", place: { country: "CL", name: "Santiago" }, first: "2026-12-01", last: "2026-12-03", page: "santiago" } }));
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "flight", travellers: [ana.account, sam.account], kind: "flight", seats: [], legs: [{ flight: "LA 98", from: { code: "SCL" }, to: { code: "PUQ" }, leaves: exact(SANTIAGO, "2026-12-05", "07:05"), arrives: exact(PUNTA_ARENAS, "2026-12-05", "10:30") }] }) }));

  // Ana adds a firm item on 4 December: a train, with its two ends and its duration.
  await ana.page.locator('[data-date="2026-12-04"] [data-action="add-to-day"]').click();
  await ana.page.locator('[data-action="add-firm"]').click();
  const firmForm = ana.page.locator('[data-form="firm"]');
  await firmForm.locator('input[name="title"]').fill("Train to Valparaíso");
  await firmForm.locator('input[name="when-time"]').fill("09:00");
  await firmForm.locator('input[name="when-zone"]').fill(SANTIAGO);
  await firmForm.locator('input[name="travel"]').check();
  await firmForm.locator('select[name="from-country"]').selectOption("CL");
  await firmForm.locator('input[name="from"]').fill("Santiago");
  await firmForm.locator('select[name="to-country"]').selectOption("CL");
  await firmForm.locator('input[name="to"]').fill("Valparaíso");
  await firmForm.locator('input[name="has-arrival"]').check();
  await firmForm.locator('input[name="arrive-date"]').fill("2026-12-04");
  await firmForm.locator('input[name="arrive-time"]').fill("10:45");
  await firmForm.locator('input[name="arrive-zone"]').fill(SANTIAGO);
  await firmForm.locator('[data-action="save-firm"]').click();
  await expect(ana.page.locator('[data-date="2026-12-04"] .fixed')).toContainText("Train to Valparaíso");
  await expect(ana.page.locator('[data-date="2026-12-04"] .fixed')).toContainText("1 h 45 min");
  await noSidewaysScroll(ana.page);

  // Ana drags Chile's last day from 10 to 12 December (PLN-F1).
  const chile = (await held(ana.page, trip)).calendar!.stretches.find((s) => s.id !== "santiago")!;
  await drag(ana.page, ana.page.locator(`[data-date="2026-12-10"] [data-stretch="${chile.id}"] [data-end="last"]`), ana.page.locator('[data-date="2026-12-12"]'));
  await expect(ana.page.locator(`[data-date="2026-12-12"] [data-stretch="${chile.id}"]`)).toBeVisible();
  expect((await held(ana.page, trip)).calendar!.stretches.find((s) => s.id === chile.id)).toMatchObject({ first: "2026-12-01", last: "2026-12-12" });

  // A firm item saved from an older revision shows the item as it now stands (PLN:ITINERARY-F11).
  await ana.page.locator('[data-date="2026-12-04"] [data-action="edit-firm"]').click();
  const firmId = (await ana.page.locator("[data-firm]").first().getAttribute("data-firm"))!;
  await send(ana.page, trip, "calendar", calendarChange({ op: "change-firm", base: 1, item: { id: firmId, revision: 1, title: "Train to Viña", when: exact(SANTIAGO, "2026-12-04", "09:00") } as never }));
  await ana.page.locator('[data-form="firm"] input[name="title"]').fill("Early train to Valparaíso");
  await ana.page.locator('[data-action="save-firm"]').click();
  await expect(ana.page.locator('[data-form="firm"] [data-theirs]')).toContainText("Train to Viña");
  await ana.page.keyboard.press("Escape");
  await expect(ana.page.locator('[data-form="firm"]')).toHaveCount(0);

  // Sam, granted the calendar, sees 2 December's country and both stretches pencilled, and 5
  // December's flight standing apart.
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/calendar`, "calendar");
  await expect(sam.page.locator('[data-date="2026-12-02"] .cal-countries')).toHaveText("Chile");
  await noSidewaysScroll(sam.page);
  const stretches = sam.page.locator('[data-date="2026-12-02"] .stretch');
  await expect(stretches).toHaveCount(2);
  for (const band of await stretches.all()) expect(await band.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
  const flight = sam.page.locator('[data-date="2026-12-05"] [data-booking="flight"]');
  await expect(flight).toContainText("LA 98");
  expect(await flight.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("none");
  expect(await flight.evaluate((el) => el.closest(".stretch"))).toBeNull();
  await expect(sam.page.locator('[data-action="add-to-day"], [data-action="edit-stretch"], [data-action="resize-stretch"]')).toHaveCount(0);

  // Tapping Santiago's stretch opens the page Santiago.
  await sam.page.locator('[data-date="2026-12-02"] [data-stretch="santiago"] a').click();
  await expect(sam.page.locator('[data-screen="page"] .title')).toHaveText("Santiago");

  // Kim, with no access to the calendar, is shown no calendar, and no way to open it.
  await catchUp(kim.page);
  await screen(kim.page, `/trips/${trip}`, "home");
  await expect(kim.page.locator(".trip-bar")).not.toContainText("Calendar");
  await kim.page.goto(at(`/trips/${trip}/calendar`));
  await expect(kim.page.locator('[data-screen="home"]')).toBeVisible();
  await expect(kim.page.locator('[data-screen="calendar"]')).toHaveCount(0);
  await expect(kim.page.getByText("Calendar")).toHaveCount(0);
  for (const t of [ana, sam, kim]) await t.context.close();
});

test("WEB:SCREENS-F6, WEB:SCREENS-F8, ACC-F9 — an admin manages the members and their access, every traveller sees who is on the trip, a move asks first, and removing a traveller asks first", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const sam = await traveller(browser, "Sam", "phone");
  const kim = await traveller(browser, "Kim", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await join(ana, sam, trip);
  await join(ana, kim, trip);
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "santiago", title: "Santiago", at: { parent: "country-cl" } }));
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "hidden", title: "Surprise", at: {} }));
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "notes", title: "Notes", at: { parent: "hidden" } }));

  // A traveller who is not an admin sees every member, with the admin marked, and no way to change anyone's access.
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/members`, "members");
  for (const t of [ana, sam, kim]) await expect(sam.page.locator(`[data-member="${t.account}"]`)).toBeVisible();
  await expect(sam.page.locator(".row", { has: sam.page.locator(`[data-member="${ana.account}"]`) })).toContainText("Creator");
  await expect(sam.page.locator('[data-screen="members"] a.row-link, [data-screen="members"] [data-action]:not([data-action="trip-menu"]), [data-form="invite"]')).toHaveCount(0);
  await sam.page.goto(at(`/trips/${trip}/members/${kim.account}`));
  await expect(sam.page.locator('[data-screen="member"] .title')).toHaveText("Member not available");

  // The admin invites an address with view access and no calendar, and the invitation is listed.
  await screen(ana.page, `/trips/${trip}/members`, "members");
  const form = ana.page.locator('[data-form="invite"]');
  await form.locator('input[name="email"]').fill("lee@example.com");
  await form.locator('[data-choice="invite-trip"] [data-value="view"]').click();
  await form.locator('[data-choice="invite-calendar"] [data-value="none"]').click();
  await form.locator('[data-action="invite"]').click();
  const invitation = ana.page.locator('[data-invitation="lee@example.com"]');
  await expect(invitation).toContainText("Can view");
  await expect(invitation).toContainText("calendar: no access");
  await invitation.locator('[data-action="withdraw-invitation"]').click();
  await expect(ana.page.getByRole("alertdialog")).toContainText("lee@example.com");
  await ana.page.locator('[data-dialog="confirm"]').click();
  await expect(invitation).toHaveCount(0);

  // The admin gives Sam no access to the page Santiago, and it is accepted.
  await ana.page.locator(`a:has([data-member="${sam.account}"])`).click();
  await expect(ana.page.locator('[data-screen="member"] .title')).toHaveText("Sam");
  await noSidewaysScroll(ana.page);
  await ana.page.locator('select[name="page-santiago"]').selectOption("none");
  await expect(ana.page.locator('select[name="page-santiago"]')).toHaveValue("none");
  await expect(ana.page.locator('[data-screen="member"] .refused')).toHaveCount(0);
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/pages/santiago`, "page");
  await expect(sam.page.locator(".title")).toHaveText("Page not available");

  // A page beneath one hidden from Sam cannot be opened to him first: the screen names the page above.
  await ana.page.locator('select[name="page-hidden"]').selectOption("none");
  await expect(ana.page.locator('select[name="page-hidden"]')).toHaveValue("none");
  await ana.page.locator('select[name="page-notes"]').selectOption("view");
  await expect(ana.page.locator('[data-screen="member"] .refused')).toContainText('Give them access to "Surprise" first');

  // Kim moves Notes, which Sam cannot see, under Chile, which he can: the screen says one more
  // traveller will see it, and asks first.
  await catchUp(kim.page);
  await screen(kim.page, `/trips/${trip}/pages`, "pages");
  await kim.page.getByRole("button", { name: "Open Surprise" }).click();
  await drag(kim.page, kim.page.locator('[data-action="move-page"][data-page="notes"]'), kim.page.locator('.tree-row[data-drop="country-cl"]'));
  await expect(kim.page.getByRole("alertdialog")).toContainText("1 more traveller will see this page");
  await kim.page.locator('[data-dialog="cancel"]').click();
  expect((await held(kim.page, trip)).pages.pages.find((p) => p.id === "notes")!.parent).toBe("hidden");
  await drag(kim.page, kim.page.locator('[data-action="move-page"][data-page="notes"]'), kim.page.locator('.tree-row[data-drop="country-cl"]'));
  await kim.page.locator('[data-dialog="confirm"]').click();
  await expect.poll(async () => (await held(kim.page, trip)).pages.pages.find((p) => p.id === "notes")!.parent).toBe("country-cl");

  // A move that lets no one more see a page is made at once.
  await drag(kim.page, kim.page.locator('[data-action="move-page"][data-page="notes"]'), kim.page.locator('.tree-row[data-drop="hidden"]'));
  await expect.poll(async () => (await held(kim.page, trip)).pages.pages.find((p) => p.id === "notes")!.parent).toBe("hidden");
  await expect(kim.page.getByRole("alertdialog")).toHaveCount(0);

  // The admin makes Sam an admin, and Sam then sees each member's access.
  await ana.page.locator('[data-action="make-admin"]').click();
  await expect(ana.page.locator('[data-action="make-admin"]')).toHaveCount(0);
  await expect(ana.page.locator('[data-screen="member"] .lead')).toContainText("Admin");
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/members`, "members");
  await expect(sam.page.locator(`a:has([data-member="${kim.account}"])`)).toBeVisible();

  // Removing a traveller asks first; declining keeps them, and confirming removes them.
  await screen(ana.page, `/trips/${trip}/members/${kim.account}`, "member");
  await ana.page.locator('[data-action="remove-member"]').click();
  await expect(ana.page.getByRole("alertdialog")).toContainText("Kim will be removed from the trip");
  await expect(ana.page.locator('[data-dialog="cancel"]')).toBeFocused();
  await ana.page.locator('[data-dialog="cancel"]').click();
  await screen(ana.page, `/trips/${trip}/members`, "members");
  await expect(ana.page.locator(`[data-member="${kim.account}"]`)).toBeVisible();
  await screen(ana.page, `/trips/${trip}/members/${kim.account}`, "member");
  await ana.page.locator('[data-action="remove-member"]').click();
  await ana.page.locator('[data-dialog="confirm"]').click();
  await expect(ana.page.locator('[data-screen="members"]')).toBeVisible();
  await expect(ana.page.locator(`[data-member="${kim.account}"]`)).toHaveCount(0);
  for (const t of [ana, sam, kim]) await t.context.close();
});

test("PLN-F13 — an admin reads a deleted page online, and restores it", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "santiago", title: "Santiago", text: "Cerro San Cristóbal at sunset.", at: { parent: "country-cl" } }));
  await send(ana.page, trip, "pages", pageChange({ op: "bury", id: "santiago" }));
  await screen(ana.page, `/trips/${trip}/graveyard`, "graveyard");
  await ana.page.getByRole("button", { name: /Santiago/ }).click();
  await expect(ana.page.locator('[data-buried="santiago"]')).toContainText("Cerro San Cristóbal at sunset.");
  await ana.page.locator('[data-buried="santiago"]').getByRole("button", { name: "Restore" }).click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Santiago");
  await screen(ana.page, `/trips/${trip}/graveyard`, "graveyard");
  await expect(ana.page.getByText("No deleted pages.")).toBeVisible();
  await ana.context.close();
});

/** Every screen of a trip, by its address and the name it draws. */
const TRIP_SCREENS = (trip: string, account: string): [string, string][] => [
  [`/trips/${trip}`, "home"],
  [`/trips/${trip}/calendar`, "calendar"],
  [`/trips/${trip}/bookings`, "bookings"],
  [`/trips/${trip}/bookings/tour`, "booking"],
  [`/trips/${trip}/pages`, "pages"],
  [`/trips/${trip}/pages/country-cl`, "page"],
  [`/trips/${trip}/search`, "search"],
  [`/trips/${trip}/graveyard`, "graveyard"],
  [`/trips/${trip}/members`, "members"],
  [`/trips/${trip}/members/${account}`, "member"],
];

test("WEB:SCREENS-F1, WEB:SHELL-F1 — every screen fits a phone, and offline each says so and offers no change", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "phone");
  const trip = await createTrip(ana.page, "Patagonia with a long name that has to wrap on a phone", "2026-12-01", "2026-12-20", ["CL"]);
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "tour", travellers: [ana.account], details: { reference: "AVERYLONGREFERENCE1234567890" }, kind: "activity", sort: "tour", title: "Torres del Paine full day, with lunch, and a boat across Lago Grey", starts: exact(PUNTA_ARENAS, "2026-12-09", "07:30") }) }));
  await send(ana.page, trip, "pages", pageChange({ op: "write", id: "country-cl", base: 1, text: "| A very wide table | with | many | columns | to | scroll | across |\n|---|---|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 | 6 | 7 |\n\nhttps://example.com/a/very/long/address/that/goes/on/and/on/and/on" }));
  await send(ana.page, trip, "calendar", calendarChange({ op: "pencil", stretch: { id: "chile", place: { country: "CL", name: "A place with a very long name indeed, to wrap" }, first: "2026-12-01", last: "2026-12-10" } }));
  const all = [...TRIP_SCREENS(trip, ana.account), ["/", "trips"], ["/trips/new", "new-trip"], ["/settings", "settings"], [`/trips/${trip}/bookings/new`, "booking-kind"], [`/trips/${trip}/pages/country-cl/edit`, "page-editor"]] as [string, string][];
  for (const [path, name] of all) {
    await screen(ana.page, path, name);
    await noSidewaysScroll(ana.page);
  }

  // Offline, after closing Itinero: every screen of the trip opens, says it is offline and when it
  // was brought up to date, and offers no change.
  await ana.context.setOffline(true);
  await ana.page.close();
  const page = await ana.context.newPage();
  for (const [path, name] of TRIP_SCREENS(trip, ana.account)) {
    await screen(page, path, name);
    await expect(page.locator("[data-offline]")).toContainText(/Offline · brought up to date today at \d\d:\d\d/);
    await expect(page.locator('[data-action]:not([data-action="trip-menu"]):not([data-action="find-country"]):not([data-action="copy-reference"])')).toHaveCount(0);
    await expect(page.locator('button[type="submit"]:enabled')).toHaveCount(0);
    await expect(page.getByText("Change dates")).toHaveCount(0);
  }
  await ana.context.close();
});

test("WEB:SHELL-F5 — while a new version is required, every trip opens, no screen offers a change, and the new version brings each up to date", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const sam = await traveller(browser, "Sam", "computer");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  const other = await createTrip(ana.page, "Lisbon", "2027-03-01", "2027-03-05", ["PT"]);
  await join(ana, sam, trip);
  await expect(ana.page.locator('[data-shell="ready-offline"], [data-screen]').first()).toBeVisible();

  // Meanwhile Sam renames Chile. Then a version is deployed whose online side answers nothing older.
  await send(sam.page, trip, "pages", pageChange({ op: "rename", id: "country-cl", title: "Chile, renamed meanwhile" }));
  await online.publish(versionDir("three"), { OLDEST_API: "2" });
  await catchUp(ana.page);
  await expect(ana.page.locator('[data-shell="update-required"]')).toBeVisible();
  for (const id of [trip, other]) {
    for (const [path, name] of TRIP_SCREENS(id, ana.account).filter(([, n]) => n !== "booking")) {
      await ana.page.evaluate((path) => {
        history.pushState(null, "", path);
        dispatchEvent(new PopStateEvent("popstate"));
      }, path);
      await expect(ana.page.locator(`[data-screen="${name}"]`)).toBeVisible();
      await expect(ana.page.locator('[data-shell="update-required"]')).toBeVisible();
      await expect(ana.page.locator('[data-action]:not([data-action="trip-menu"]):not([data-action="find-country"])')).toHaveCount(0);
    }
  }
  // The trip was caught up before the deploy, so the rename has not reached it.
  await expect(ana.page.getByText("Chile, renamed meanwhile")).toHaveCount(0);

  // Starting the new version brings the trip up to date.
  await expect(ana.page.getByRole("button", { name: "Update now" })).toBeVisible({ timeout: 30_000 });
  await Promise.all([ana.page.waitForEvent("load"), ana.page.getByRole("button", { name: "Update now" }).click()]);
  await expect(ana.page.locator('[data-shell="update-required"]')).toHaveCount(0);
  await screen(ana.page, `/trips/${trip}/pages`, "pages");
  await expect(ana.page.getByText("Chile, renamed meanwhile")).toBeVisible({ timeout: 10_000 });
  await online.publish(versionDir("one"), { OLDEST_API: "1" });
  for (const t of [ana, sam]) await t.context.close();
});

test("WEB:SCREENS-NFR1, BKG-NFR1, BKG:LIST-NFR2 — a trip of 500 pages and 300 bookings draws quickly", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL", "AR"]);
  const changes: { target: string; change: string }[] = [];
  for (let i = 0; i < 498; i++) changes.push({ target: "pages", change: pageChange({ op: "add", id: `p-${i}`, title: `Page ${i}`, text: "Torres del Paine, the W trek. ".repeat(40), at: i < 48 ? {} : { parent: `p-${i % 48}` } }) });
  const kinds = [
    (i: number) => ({ kind: "activity", sort: "tour", title: `Tour ${i}`, starts: exact(SANTIAGO, `2026-12-${String(1 + (i % 20)).padStart(2, "0")}`, "09:00") }),
    (i: number) => ({ kind: "stay", name: `Stay ${i}`, checkIn: { kind: "date", zone: SANTIAGO, date: `2026-12-${String(1 + (i % 19)).padStart(2, "0")}` }, checkOut: { kind: "date", zone: SANTIAGO, date: `2026-12-${String(2 + (i % 19)).padStart(2, "0")}` } }),
    (i: number) => ({ kind: "journey", by: "bus", from: "Santiago", to: "Valparaíso", leaves: exact(SANTIAGO, `2026-12-${String(1 + (i % 20)).padStart(2, "0")}`, "08:00") }),
    (i: number) => ({ kind: "flight", seats: [], legs: [{ flight: `LA ${100 + i}`, from: { code: "SCL" }, to: { code: "PUQ" }, leaves: exact(SANTIAGO, `2026-12-${String(1 + (i % 20)).padStart(2, "0")}`, "07:05"), arrives: exact(PUNTA_ARENAS, `2026-12-${String(1 + (i % 20)).padStart(2, "0")}`, "10:30") }] }),
  ];
  for (let i = 0; i < 300; i++) changes.push({ target: "bookings", change: bookingChange({ op: "add", booking: booking({ id: `b-${i}`, travellers: [ana.account], ...kinds[i % 4]!(i) }) }) });
  // Sent straight to the online side, eight at a time, then caught up once.
  await ana.page.evaluate(async ({ trip, changes }) => {
    for (let at = 0; at < changes.length; at += 8) {
      await Promise.all(
        changes.slice(at, at + 8).map((c) => fetch(`/api/trips/${trip}/changes`, { method: "POST", headers: { "Itinero-Api": "1", "Content-Type": "application/json" }, body: JSON.stringify(c) })),
      );
    }
  }, { trip, changes });
  await catchUp(ana.page);
  await ana.context.setOffline(true);

  const home: number[] = [];
  const bookings: number[] = [];
  for (let i = 0; i < 10; i++) {
    await ana.page.goto(at(`/trips/${trip}`));
    await expect(ana.page.locator('[data-screen="home"]')).toBeVisible();
    home.push(await ana.page.evaluate(() => {
      const given = performance.getEntriesByName("itinero-copy-given")[0]!.startTime;
      const drawn = performance.getEntriesByName("itinero-home-drawn").at(-1)!.startTime;
      return drawn - given;
    }));
    const started = Date.now();
    await ana.page.goto(at(`/trips/${trip}/bookings`));
    await expect(ana.page.locator('[data-screen="bookings"] .row').first()).toBeVisible();
    bookings.push(Date.now() - started);
  }
  console.log(`[${engine}] home page drawn in ${home.map((t) => t.toFixed(0)).join(", ")} ms; bookings page shown in ${bookings.join(", ")} ms`);
  for (const t of home) expect(t).toBeLessThan(500);
  for (const t of bookings) expect(t).toBeLessThan(1_000);

  // BKG:LIST-NFR2: 1,000 bookings ordered, and those not yet over found, each within 50 milliseconds.
  type Win = {
    itineroStore: { trip(id: string): Promise<{ bookings: { id: string }[] }> };
    itineroPackages: { bookings: { order(b: unknown[]): unknown[]; notOver(b: unknown[], now: unknown): unknown[] } };
  };
  const timed = await ana.page.evaluate(async (trip) => {
    const w = window as unknown as Win;
    const held = (await w.itineroStore.trip(trip))!.bookings;
    const thousand = Array.from({ length: 1000 }, (_, i) => Object.freeze({ ...held[i % held.length]!, id: `x-${i}` }));
    let started = performance.now();
    const ordered = w.itineroPackages.bookings.order(thousand);
    const ordering = performance.now() - started;
    started = performance.now();
    w.itineroPackages.bookings.notOver(ordered, { kind: "exact", zone: "Etc/UTC", date: "2026-12-10", at: { time: "12:00" } });
    return { ordering, finding: performance.now() - started };
  }, trip);
  console.log(`[${engine}] 1,000 bookings ordered in ${timed.ordering.toFixed(1)} ms, and those not over found in ${timed.finding.toFixed(1)} ms`);
  expect(timed.ordering).toBeLessThan(50);
  expect(timed.finding).toBeLessThan(50);
  await ana.context.close();
});
