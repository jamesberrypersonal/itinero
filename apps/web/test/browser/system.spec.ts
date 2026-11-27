// The planner's, the access system's and the web app's own requirements whose verifications run
// on a running system, each by the verification it carries, through the screens, in each engine
// (docs/spec/web/screens.md §4.9). The online side runs in Wrangler, with stand-ins for Google and
// Resend. The checks that need a real phone, or Google itself, are made by hand.

import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { grantChangeToText, type GrantChange } from "@itinero/permissions";
import { pageLink } from "@itinero/pages";
import { startOutside, type Outside, type Person } from "./outside.ts";
import { booking, bookingChange, calendarChange, createTrip, device, exact, invite, newTraveller, pageChange, send, signIn } from "./screens-helpers.ts";
import { versionDir } from "./versions.ts";
import { startWrangler, type Wrangler } from "./wrangler.ts";

let online: Wrangler;
let outside: Outside;
let engine = "";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async ({ browserName }) => {
  engine = browserName;
  outside = await startOutside();
  online = await startWrangler(versionDir("one"), [], `system-${browserName}`, {
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

type Traveller = { context: BrowserContext; page: Page; account: string; email: string; person: Person };
let count = 0;

async function traveller(browser: Browser, name: string, kind: "phone" | "computer" = "computer"): Promise<Traveller> {
  count++;
  const email = `${name.toLowerCase()}${count}@example.com`;
  const person = { sub: `${engine}-system-${name}-${count}`, email, name };
  const context = await device(browser, kind);
  const page = await newTraveller(context, online, person, name);
  const account = await page.evaluate(async () => (await (window as unknown as StoreWindow).itineroStore.open()).account!);
  return { context, page, account, email, person };
}

async function join(admin: Traveller, who: Traveller, trip: string, level = "edit", calendar = "none"): Promise<void> {
  const link = await invite(admin.page, outside, trip, who.email, level, calendar);
  await who.page.goto(new URL(link, online.url).href);
  await expect(who.page.locator('[data-screen="home"]')).toBeVisible();
}

const at = (path: string) => new URL(path, online.url).href;

async function screen(page: Page, path: string, name: string): Promise<void> {
  await page.goto(at(path));
  await expect(page.locator(`[data-screen="${name}"]`)).toBeVisible();
}

type Held = {
  calendar?: { stretches: { id: string; first: string; last: string }[]; firm: { id: string; title: string; when: Record<string, unknown> }[] };
  pages: { pages: { id: string; title: string; text: string; parent?: string }[] };
  graveyard: { id: string }[];
};
type StoreWindow = {
  itineroStore: {
    open(): Promise<{ account?: string }>;
    catchUpAll(): Promise<void>;
    trip(id: string): Promise<Held>;
    send(trip: string, target: string, change: string): Promise<{ ok: boolean; refusal?: { code: string; message: string } }>;
    buried(trip: string, page: string): Promise<{ ok: boolean }>;
  };
};

const catchUp = (page: Page) => page.evaluate(() => (window as unknown as StoreWindow).itineroStore.catchUpAll());
const held = (page: Page, trip: string) => page.evaluate((id) => (window as unknown as StoreWindow).itineroStore.trip(id), trip);

/** Sends a change through the window's trip store, and gives whether it was applied. */
const attempt = (page: Page, trip: string, target: string, change: string) =>
  page.evaluate(({ trip, target, change }) => (window as unknown as StoreWindow).itineroStore.send(trip, target, change), { trip, target, change });

const grant = (page: Page, trip: string, change: GrantChange) => send(page, trip, "grants", grantChangeToText(change));

/** Holds the pointer down on one element, then drags it onto another, found once the drag has started. */
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = (await from.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 4);
  const end = (await to.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** Opens each folded branch of the tree of pages, until every page shows. */
async function openTree(page: Page): Promise<void> {
  for (;;) {
    const folded = page.getByRole("button", { name: /^Open / });
    if ((await folded.count()) === 0) return;
    await folded.first().click();
  }
}

const SANTIAGO = "America/Santiago";
const PARIS = "Europe/Paris";

/** The pages of ACC-F4: Chile, Santiago under Chile, and Eating in Santiago under Santiago. */
async function chilePages(page: Page, trip: string): Promise<void> {
  await send(page, trip, "pages", pageChange({ op: "add", id: "santiago", title: "Santiago", at: { parent: "country-cl" } }));
  await send(page, trip, "pages", pageChange({ op: "add", id: "eating", title: "Eating in Santiago", text: "Try the empanadas.", at: { parent: "santiago" } }));
}

test("ACC-F4, ACC-F7, ACC-F8, ACC-F10 — access passes down the tree, an admin changes it for a branch, a hidden page shows nothing of itself, and the graveyard follows what each could see", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const sam = await traveller(browser, "Sam", "phone");
  const kim = await traveller(browser, "Kim", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await chilePages(ana.page, trip);
  await send(ana.page, trip, "pages", pageChange({ op: "write", id: "country-cl", base: 1, text: `Start in ${pageLink("santiago", "Santiago")}.` }));
  await join(ana, sam, trip, "view");

  // ACC-F4: with view access to the trip, Sam sees all three pages, and can change none of them.
  await screen(sam.page, `/trips/${trip}/pages`, "pages");
  await openTree(sam.page);
  for (const title of ["Chile", "Santiago", "Eating in Santiago"]) await expect(sam.page.locator(".tree-title").getByText(title, { exact: true })).toBeVisible();
  await expect(sam.page.locator('[data-action="new-page"], [data-action="move-page"]')).toHaveCount(0);
  for (const id of ["country-cl", "santiago", "eating"]) {
    await screen(sam.page, `/trips/${trip}/pages/${id}`, "page");
    await expect(sam.page.locator('[data-action="edit-page"], [data-action="delete-page"]')).toHaveCount(0);
    expect((await attempt(sam.page, trip, "pages", pageChange({ op: "rename", id, title: "Changed" }))).ok).toBe(false);
  }
  // A page added under Santiago is seen too.
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "markets", title: "Markets", at: { parent: "santiago" } }));
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/pages/markets`, "page");
  await expect(sam.page.locator(".title")).toHaveText("Markets");
  // Kim, with edit access to the trip, can change every page.
  await join(ana, kim, trip, "edit");
  for (const id of ["country-cl", "santiago", "eating", "markets"]) {
    await screen(kim.page, `/trips/${trip}/pages/${id}`, "page");
    await expect(kim.page.locator('[data-action="edit-page"]')).toBeVisible();
  }

  // ACC-F7: Ana gives Sam no access to Santiago, from his member screen.
  await screen(ana.page, `/trips/${trip}/members/${sam.account}`, "member");
  await ana.page.locator('select[name="page-santiago"]').selectOption("none");
  await expect(ana.page.locator('select[name="page-santiago"]')).toHaveValue("none");
  await catchUp(sam.page);
  for (const id of ["santiago", "eating"]) {
    await screen(sam.page, `/trips/${trip}/pages/${id}`, "page");
    await expect(sam.page.locator(".title")).toHaveText("Page not available");
  }
  await screen(sam.page, `/trips/${trip}/pages/country-cl`, "page");
  await expect(sam.page.locator(".title")).toHaveText("Chile");
  // View access to Eating in Santiago is refused, naming Santiago.
  await ana.page.locator('select[name="page-eating"]').selectOption("view");
  await expect(ana.page.locator('[data-screen="member"] .refused')).toContainText('"Santiago"');
  // View access to Santiago, and edit access to Eating in Santiago: Sam changes that page only.
  await ana.page.locator('select[name="page-santiago"]').selectOption("view");
  await expect(ana.page.locator('select[name="page-santiago"]')).toHaveValue("view");
  await ana.page.locator('select[name="page-eating"]').selectOption("edit");
  await expect(ana.page.locator('select[name="page-eating"]')).toHaveValue("edit");
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/pages/eating`, "page");
  await expect(sam.page.locator('[data-action="edit-page"]')).toBeVisible();
  for (const id of ["country-cl", "santiago"]) {
    await screen(sam.page, `/trips/${trip}/pages/${id}`, "page");
    await expect(sam.page.locator('[data-action="edit-page"]')).toHaveCount(0);
  }
  expect((await attempt(sam.page, trip, "pages", pageChange({ op: "rename", id: "eating", title: "Eating well in Santiago" }))).ok).toBe(true);
  expect((await attempt(sam.page, trip, "pages", pageChange({ op: "rename", id: "santiago", title: "Santiago de Chile" }))).ok).toBe(false);

  // ACC-F8: with no access to Santiago, Chile's link shows its page is not available, without its title.
  await grant(ana.page, trip, { op: "unpage", traveller: sam.account, page: "eating" });
  await grant(ana.page, trip, { op: "page", traveller: sam.account, page: "santiago", level: "none" });
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/pages/country-cl`, "page");
  await expect(sam.page.locator(".prose .unavailable")).toHaveText("Page not available");
  await expect(sam.page.locator(".prose")).not.toContainText("Santiago");
  // A search for Santiago lists only the pages Sam may see.
  await screen(sam.page, `/trips/${trip}/search`, "search");
  await sam.page.locator('input[name="words"]').fill("Santiago");
  await expect(sam.page.locator("[data-hit]")).toHaveCount(1);
  await expect(sam.page.locator('[data-hit="country-cl"]')).toBeVisible();
  // Given view access to Santiago, a change to it is refused.
  await grant(ana.page, trip, { op: "page", traveller: sam.account, page: "santiago", level: "view" });
  await catchUp(sam.page);
  expect((await attempt(sam.page, trip, "pages", pageChange({ op: "rename", id: "santiago", title: "Santiago de Chile" }))).ok).toBe(false);

  // ACC-F10: with no access to Santiago, and Santiago then deleted, Sam's graveyard does not list it.
  await grant(ana.page, trip, { op: "page", traveller: sam.account, page: "santiago", level: "none" });
  await send(ana.page, trip, "pages", pageChange({ op: "bury", id: "santiago" }));
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/graveyard`, "graveyard");
  await expect(sam.page.getByText("No deleted pages.")).toBeVisible();
  // Chile deleted is listed for Sam, who cannot open it.
  await send(ana.page, trip, "pages", pageChange({ op: "bury", id: "country-cl" }));
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/graveyard`, "graveyard");
  await expect(sam.page.locator(".row", { hasText: "Chile" })).toBeVisible();
  await expect(sam.page.locator('[data-screen="graveyard"] button.row')).toHaveCount(0);
  expect((await sam.page.evaluate(({ trip }) => (window as unknown as StoreWindow).itineroStore.buried(trip, "country-cl"), { trip })).ok).toBe(false);
  // Ana, an admin, opens and restores it.
  await screen(ana.page, `/trips/${trip}/graveyard`, "graveyard");
  await ana.page.getByRole("button", { name: /Chile/ }).click();
  await ana.page.locator('[data-buried="country-cl"]').getByRole("button", { name: "Restore" }).click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Chile");
  // Deleted again, and Sam then given no access to it, Chile stays in his graveyard.
  await send(ana.page, trip, "pages", pageChange({ op: "bury", id: "country-cl" }));
  await grant(ana.page, trip, { op: "page", traveller: sam.account, page: "country-cl", level: "none" });
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/graveyard`, "graveyard");
  await expect(sam.page.locator(".row", { hasText: "Chile" })).toBeVisible();
  for (const t of [ana, sam, kim]) await t.context.close();
});

test("ACC-F5 — a traveller sees a trip's calendar only once an admin grants it", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const sam = await traveller(browser, "Sam", "phone");
  const kim = await traveller(browser, "Kim", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await send(ana.page, trip, "calendar", calendarChange({ op: "pencil", stretch: { id: "santiago", place: { country: "CL", name: "Santiago" }, first: "2026-12-01", last: "2026-12-03" } }));
  await send(ana.page, trip, "calendar", calendarChange({ op: "add-firm", item: { id: "museum", revision: 0, title: "Museum", when: { kind: "day", date: "2026-12-02" } } }));
  await join(ana, sam, trip, "edit");

  // Invited with edit access to the trip and nothing said of the calendar, Sam sees none of it.
  expect((await held(sam.page, trip)).calendar).toBeUndefined();
  await screen(sam.page, `/trips/${trip}/calendar`, "home");
  await expect(sam.page.locator(".trip-bar")).not.toContainText("Calendar");

  // Granted view access, he sees the stretch, and a change to it is refused.
  await screen(ana.page, `/trips/${trip}/members/${sam.account}`, "member");
  await ana.page.locator('[data-choice="calendar"] [data-value="view"]').click();
  await expect(ana.page.locator('[data-choice="calendar"] [data-value="view"]')).toHaveAttribute("aria-checked", "true");
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/calendar`, "calendar");
  await expect(sam.page.locator('[data-date="2026-12-02"] [data-stretch="santiago"]')).toBeVisible();
  await expect(sam.page.locator('[data-action="resize-stretch"], [data-action="edit-stretch"]')).toHaveCount(0);
  const move = calendarChange({ op: "move", id: "santiago", first: "2026-12-02", last: "2026-12-04" });
  expect((await attempt(sam.page, trip, "calendar", move)).ok).toBe(false);

  // Granted edit access, he moves it.
  await ana.page.locator('[data-choice="calendar"] [data-value="edit"]').click();
  await expect(ana.page.locator('[data-choice="calendar"] [data-value="edit"]')).toHaveAttribute("aria-checked", "true");
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/calendar`, "calendar");
  await expect(sam.page.locator('[data-action="edit-stretch"]').first()).toBeVisible();
  expect((await attempt(sam.page, trip, "calendar", move)).ok).toBe(true);

  // With the access taken away, the calendar is hidden again.
  await ana.page.locator('[data-choice="calendar"] [data-value="none"]').click();
  await expect(ana.page.locator('[data-choice="calendar"] [data-value="none"]')).toHaveAttribute("aria-checked", "true");
  await catchUp(sam.page);
  expect((await held(sam.page, trip)).calendar).toBeUndefined();
  await screen(sam.page, `/trips/${trip}/calendar`, "home");

  // Kim, invited with view access to the calendar, sees the stretch once she accepts.
  await join(ana, kim, trip, "edit", "view");
  await screen(kim.page, `/trips/${trip}/calendar`, "calendar");
  await expect(kim.page.locator('[data-stretch="santiago"]').first()).toBeVisible();
  for (const t of [ana, sam, kim]) await t.context.close();
});

test("ACC-F6 — a traveller sees only the bookings that name them", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const sam = await traveller(browser, "Sam", "phone");
  const lee = await traveller(browser, "Lee", "phone");
  const kim = await traveller(browser, "Kim", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await join(ana, sam, trip);
  await join(ana, lee, trip);
  await join(ana, kim, trip, "edit", "view");
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "flight", travellers: [sam.account, lee.account], kind: "flight", seats: [], legs: [{ flight: "LA 98", from: { code: "SCL" }, to: { code: "PUQ" }, leaves: exact(SANTIAGO, "2026-12-05", "07:05"), arrives: exact("America/Punta_Arenas", "2026-12-05", "10:30") }] }) }));

  // Sam, named, with no access to the calendar, sees it on the bookings page.
  await catchUp(sam.page);
  await screen(sam.page, `/trips/${trip}/bookings`, "bookings");
  await expect(sam.page.getByText("LA 98")).toBeVisible();
  // Kim, not named, sees it neither on the bookings page nor on the calendar.
  await catchUp(kim.page);
  await screen(kim.page, `/trips/${trip}/bookings`, "bookings");
  await expect(kim.page.getByText("LA 98")).toHaveCount(0);
  await screen(kim.page, `/trips/${trip}/calendar`, "calendar");
  await expect(kim.page.locator("[data-booking]")).toHaveCount(0);
  // Ana, an admin the booking does not name, sees it.
  await screen(ana.page, `/trips/${trip}/bookings`, "bookings");
  await expect(ana.page.getByText("LA 98")).toBeVisible();
  // Kim asking for the flight by its identifier is given nothing.
  const asked = await kim.page.evaluate(async (trip) => {
    const answer = await fetch(`/api/trips/${trip}/bookings`, { method: "POST", headers: { "Itinero-Api": "2", "Content-Type": "application/json" }, body: JSON.stringify({ bookings: ["flight"] }) });
    return { status: answer.status, text: await answer.text() };
  }, trip);
  expect(asked.text).not.toContain("LA 98");
  for (const t of [ana, sam, lee, kim]) await t.context.close();
});

test("PLN-F2, PLN-F3, PLN-F4 — the calendar shows each day's countries, and firm items and travel, each in local time", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const trip = await createTrip(ana.page, "France and America", "2026-06-01", "2026-06-14", ["FR"]);
  const stretches = [
    { id: "france", place: { country: "FR" }, first: "2026-06-01", last: "2026-06-05" },
    { id: "lyon", place: { country: "FR", name: "Lyon" }, first: "2026-06-01", last: "2026-06-03" },
    { id: "new-york", place: { country: "US", name: "New York" }, first: "2026-06-05", last: "2026-06-08" },
    { id: "montreal", place: { country: "CA", name: "Montreal" }, first: "2026-06-09", last: "2026-06-12" },
  ];
  for (const stretch of stretches) await send(ana.page, trip, "calendar", calendarChange({ op: "pencil", stretch }));
  const day = (date: string) => ana.page.locator(`[data-date="${date}"]`);

  // PLN-F2: each day's countries.
  await screen(ana.page, `/trips/${trip}/calendar`, "calendar");
  await expect(day("2026-06-02").locator(".cal-countries")).toHaveText("France");
  await expect(day("2026-06-05").locator(".cal-countries")).toHaveText("France, United States");
  await expect(day("2026-06-09").locator(".cal-countries")).toHaveText("Canada");
  await drag(ana.page, day("2026-06-09").locator('[data-stretch="montreal"] [data-end="first"]'), day("2026-06-10"));
  await expect(day("2026-06-09").locator(".cal-countries")).toHaveCount(0);
  await drag(ana.page, day("2026-06-12").locator('[data-stretch="montreal"] [data-end="last"]'), day("2026-06-13"));
  await expect(day("2026-06-13").locator('[data-stretch="montreal"]')).toBeVisible();

  const firmForm = ana.page.locator('[data-form="firm"]');
  const addFirm = async (date: string) => {
    await day(date).locator('[data-action="add-to-day"]').click();
    await ana.page.locator('[data-action="add-firm"]').click();
  };
  const firm = async (title: string) => (await held(ana.page, trip)).calendar!.firm.find((f) => f.title === title)!;

  // PLN-F3: a museum visit on the afternoon of 4 June, Paris time.
  await addFirm("2026-06-04");
  await firmForm.locator('input[name="title"]').fill("Museum visit");
  await firmForm.locator('select[name="when-kind"]').selectOption("part");
  await firmForm.locator('select[name="when-part"]').selectOption("afternoon");
  await firmForm.locator('input[name="when-zone"]').fill(PARIS);
  await firmForm.locator('[data-action="save-firm"]').click();
  await expect(day("2026-06-04").locator(".fixed", { hasText: "Museum visit" })).toContainText("afternoon");
  expect((await firm("Museum visit")).when).toMatchObject({ kind: "part", date: "2026-06-04", part: "afternoon", zone: PARIS });
  // 3 June, the day to move on from Lyon, with no time.
  await addFirm("2026-06-03");
  await firmForm.locator('input[name="title"]').fill("Move on from Lyon");
  await firmForm.locator('input[name="all-day"]').check();
  await firmForm.locator('[data-action="save-firm"]').click();
  await expect(day("2026-06-03").locator(".fixed", { hasText: "Move on from Lyon" })).toContainText("All day");
  // The museum visit changed to 2 June moves there.
  await day("2026-06-04").locator(".fixed", { hasText: "Museum visit" }).locator('[data-action="edit-firm"]').click();
  await firmForm.locator('input[name="when-date"]').fill("2026-06-02");
  await firmForm.locator('[data-action="save-firm"]').click();
  await expect(day("2026-06-02").locator(".fixed", { hasText: "Museum visit" })).toBeVisible();
  await expect(day("2026-06-04").locator(".fixed", { hasText: "Museum visit" })).toHaveCount(0);

  // PLN-F4: a flight from Paris at 10:00, Paris time, to New York at 12:30, New York time.
  const travel = async (title: string, by: string, from: [string, string], to: [string, string]) => {
    await firmForm.locator('input[name="title"]').fill(title);
    await firmForm.locator('input[name="travel"]').check();
    await firmForm.locator('select[name="by"]').selectOption(by);
    await firmForm.locator('select[name="from-country"]').selectOption(from[0]);
    await firmForm.locator('input[name="from"]').fill(from[1]);
    await firmForm.locator('select[name="to-country"]').selectOption(to[0]);
    await firmForm.locator('input[name="to"]').fill(to[1]);
  };
  await addFirm("2026-06-05");
  await travel("Flight to New York", "flight", ["FR", "Paris"], ["US", "New York"]);
  await firmForm.locator('input[name="when-time"]').fill("10:00");
  await firmForm.locator('input[name="when-zone"]').fill(PARIS);
  await firmForm.locator('input[name="has-arrival"]').check();
  await firmForm.locator('input[name="arrive-time"]').fill("12:30");
  await firmForm.locator('input[name="arrive-zone"]').fill("America/New_York");
  await firmForm.locator('[data-action="save-firm"]').click();
  const flight = day("2026-06-05").locator(".fixed", { hasText: "Flight to New York" });
  await expect(flight).toContainText("10:00");
  await expect(flight).toContainText("arrives");
  await expect(flight).toContainText("12:30");
  await expect(flight).toContainText("8 h 30 min");
  // A train from Lyon to Paris on 3 June, with no times, is accepted.
  await addFirm("2026-06-03");
  await travel("Train to Paris", "train", ["FR", "Lyon"], ["FR", "Paris"]);
  await firmForm.locator('input[name="all-day"]').check();
  await firmForm.locator('[data-action="save-firm"]').click();
  await expect(day("2026-06-03").locator(".fixed", { hasText: "Train to Paris" })).toBeVisible();
  // Travel arriving at 03:00 the day it leaves at 10:00, both Paris time, is refused, with the reason.
  await addFirm("2026-06-06");
  await travel("Back in time", "train", ["FR", "Paris"], ["FR", "Lyon"]);
  await firmForm.locator('input[name="when-time"]').fill("10:00");
  await firmForm.locator('input[name="when-zone"]').fill(PARIS);
  await firmForm.locator('input[name="has-arrival"]').check();
  await firmForm.locator('input[name="arrive-time"]').fill("03:00");
  await firmForm.locator('input[name="arrive-zone"]').fill(PARIS);
  await firmForm.locator('[data-action="save-firm"]').click();
  await expect(firmForm.locator(".refused")).toContainText("arrives before it leaves");
  await ana.context.close();
});

test("PLN-F7 — a traveller writes research on the pages of a trip", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const trip = await createTrip(ana.page, "Lyon", "2026-06-01", "2026-06-05", ["FR"]);
  const other = await createTrip(ana.page, "Lisbon", "2027-03-01", "2027-03-05", ["PT"]);
  const text = "# Bouchons\n\n- [ ] Book Daniel et Denise\n- [x] Try the quenelles\n\n| Dish | Price |\n|---|---|\n| Quenelles | 24 € |\n\n[Daniel et Denise](https://www.danieletdenise.fr/)";
  await screen(ana.page, `/trips/${trip}/pages/new`, "page-editor");
  await ana.page.locator('input[name="title"]').fill("Eating in Lyon");
  await ana.page.locator('textarea[name="text"]').fill(text);
  await ana.page.locator('[data-action="save-page"]').click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Eating in Lyon");
  expect((await held(ana.page, trip)).pages.pages.find((p) => p.title === "Eating in Lyon")!.text).toBe(text);
  const prose = ana.page.locator(".prose");
  await expect(prose.locator("h1")).toHaveText("Bouchons");
  await expect(prose.locator('input[type="checkbox"]')).toHaveCount(2);
  await expect(prose.locator("table td").first()).toHaveText("Quenelles");

  // The link opens the restaurant's website, in a new tab.
  await ana.context.route("https://www.danieletdenise.fr/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Daniel et Denise</title>" }));
  const [site] = await Promise.all([ana.page.waitForEvent("popup"), prose.getByRole("link", { name: "Daniel et Denise" }).click()]);
  await site.waitForLoadState();
  expect(site.url()).toBe("https://www.danieletdenise.fr/");

  // The page is not among another trip's pages.
  await screen(ana.page, `/trips/${other}/pages`, "pages");
  await expect(ana.page.getByText("Eating in Lyon")).toHaveCount(0);
  expect((await held(ana.page, other)).pages.pages.some((p) => p.title === "Eating in Lyon")).toBe(false);
  await ana.context.close();
});

test("PLN-F8 — a trip's pages form a tree, which a traveller rearranges freely", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await chilePages(ana.page, trip);
  const parentOf = async (id: string) => (await held(ana.page, trip)).pages.pages.find((p) => p.id === id)?.parent;
  await screen(ana.page, `/trips/${trip}/pages`, "pages");
  await openTree(ana.page);

  // Chile moved under Eating in Santiago, which lies beneath it, is refused, with the reason.
  await drag(ana.page, ana.page.locator('[data-action="move-page"][data-page="country-cl"]'), ana.page.locator('.tree-row[data-drop="eating"]'));
  await expect(ana.page.locator('[data-screen="pages"] .refused')).toContainText("cannot move under itself");
  expect(await parentOf("country-cl")).toBeUndefined();

  // Santiago moved to the top takes Eating in Santiago with it.
  await drag(ana.page, ana.page.locator('[data-action="move-page"][data-page="santiago"]'), ana.page.locator(".tree-top"));
  await expect.poll(() => parentOf("santiago")).toBeUndefined();
  expect(await parentOf("eating")).toBe("santiago");

  // W trek added under Chile, then Santiago put under Chile before it, reads Santiago, W trek.
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "w-trek", title: "W trek", at: { parent: "country-cl" } }));
  await send(ana.page, trip, "pages", pageChange({ op: "move", id: "santiago", to: { parent: "country-cl" } }));
  await screen(ana.page, `/trips/${trip}/pages`, "pages");
  // The tree keeps open the branches opened above (WEB:SCREENS-F18), and opens any other.
  await openTree(ana.page);
  const underChile = ana.page.locator('[role="treeitem"]:has(> .tree-row[data-drop="country-cl"]) > .tree > li > .tree-row .tree-title');
  await expect(underChile).toHaveText(["Santiago", "W trek"]);

  // Deleting Santiago asks first, saying one page beneath it will go, then both go to the graveyard.
  await screen(ana.page, `/trips/${trip}/pages/santiago`, "page");
  await ana.page.locator('[data-action="delete-page"]').click();
  await expect(ana.page.getByRole("alertdialog")).toContainText("the 1 beneath it");
  await ana.page.locator('[data-dialog="confirm"]').click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Chile");
  const after = await held(ana.page, trip);
  expect(after.pages.pages.some((p) => p.id === "santiago" || p.id === "eating")).toBe(false);
  expect(after.graveyard.map((g) => g.id)).toEqual(["santiago"]);
  await screen(ana.page, `/trips/${trip}/graveyard`, "graveyard");
  await expect(ana.page.locator(".row", { hasText: "Santiago" })).toContainText("and 1 beneath");
  await ana.context.close();
});

test("PLN-F9 — a page links to any other page of its trip, and the link survives renaming and moving", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await chilePages(ana.page, trip);
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "w-trek", title: "W trek", at: { parent: "country-cl" } }));
  await send(ana.page, trip, "pages", pageChange({ op: "add", id: "transport", title: "Transport", text: `Buses from ${pageLink("santiago", "Santiago")} reach the ${pageLink("w-trek", "W trek")}.`, at: {} }));

  // Each link opens its page.
  for (const [words, title] of [["Santiago", "Santiago"], ["W trek", "W trek"]] as const) {
    await screen(ana.page, `/trips/${trip}/pages/transport`, "page");
    await ana.page.locator(".prose").getByRole("link", { name: words }).click();
    await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText(title);
  }
  // Santiago renamed and moved to the top: the link still opens it.
  await send(ana.page, trip, "pages", pageChange({ op: "rename", id: "santiago", title: "Santiago de Chile" }));
  await send(ana.page, trip, "pages", pageChange({ op: "move", id: "santiago", to: {} }));
  await screen(ana.page, `/trips/${trip}/pages/transport`, "page");
  await ana.page.locator(".prose").getByRole("link", { name: "Santiago" }).click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Santiago de Chile");
  // W trek deleted: its link stays in the text, shown as pointing to a page in the graveyard.
  await send(ana.page, trip, "pages", pageChange({ op: "bury", id: "w-trek" }));
  await screen(ana.page, `/trips/${trip}/pages/transport`, "page");
  await expect(ana.page.locator('.prose [data-graveyard="w-trek"]')).toHaveText("Page deleted");
  expect((await held(ana.page, trip)).pages.pages.find((p) => p.id === "transport")!.text).toBe(`Buses from ${pageLink("santiago", "Santiago")} reach the ${pageLink("w-trek", "W trek")}.`);
  await ana.context.close();
});

test("PLN-F11 — a stretch or a firm item links to a page of its trip", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await chilePages(ana.page, trip);
  await screen(ana.page, `/trips/${trip}/calendar`, "calendar");

  // Santiago pencilled in, linked to the page Santiago.
  await ana.page.locator('[data-date="2026-12-02"] [data-action="add-to-day"]').click();
  await ana.page.locator('[data-action="add-stretch"]').click();
  const stretchForm = ana.page.locator('[data-form="stretch"]');
  await stretchForm.locator('select[name="country"]').selectOption("CL");
  await stretchForm.locator('input[name="place"]').fill("Santiago");
  await stretchForm.locator('input[name="last"]').fill("2026-12-04");
  await stretchForm.locator('select[name="page"]').selectOption("santiago");
  await stretchForm.locator('[data-action="save-stretch"]').click();
  await ana.page.locator('[data-date="2026-12-02"] .stretch a[data-page="santiago"]').click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Santiago");

  // A market visit linked to Eating in Santiago.
  await screen(ana.page, `/trips/${trip}/calendar`, "calendar");
  await ana.page.locator('[data-date="2026-12-03"] [data-action="add-to-day"]').click();
  await ana.page.locator('[data-action="add-firm"]').click();
  const firmForm = ana.page.locator('[data-form="firm"]');
  await firmForm.locator('input[name="title"]').fill("Market visit");
  await firmForm.locator('input[name="all-day"]').check();
  await firmForm.locator('select[name="page"]').selectOption("eating");
  await firmForm.locator('[data-action="save-firm"]').click();
  await ana.page.locator('[data-date="2026-12-03"] .fixed a[data-page="eating"]').click();
  await expect(ana.page.locator('[data-screen="page"] .title')).toHaveText("Eating in Santiago");

  // The page Santiago deleted: the stretch shows its page is in the graveyard.
  await send(ana.page, trip, "pages", pageChange({ op: "bury", id: "santiago" }));
  await screen(ana.page, `/trips/${trip}/calendar`, "calendar");
  await expect(ana.page.locator('[data-date="2026-12-02"] .stretch [data-graveyard="santiago"]')).toHaveText("Page deleted");
  await ana.context.close();
});

test("WEB-F7 — every time shows in the local time of its place, in the clock and date order the traveller chooses", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const trip = await createTrip(ana.page, "Chile and Spain", "2026-12-01", "2026-12-20", ["CL", "ES"]);
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "flight", travellers: [ana.account], kind: "flight", seats: [], legs: [{ flight: "IB 6830", from: { code: "SCL" }, to: { code: "MAD" }, leaves: exact(SANTIAGO, "2026-12-10", "23:40"), arrives: exact("Europe/Madrid", "2026-12-11", "16:35") }] }) }));
  const leaves = (page: Page) => page.locator(".row", { hasText: "Leaves SCL" });
  const arrives = (page: Page) => page.locator(".row", { hasText: "Arrives MAD" });

  // On a device set to a 24-hour clock.
  await screen(ana.page, `/trips/${trip}/bookings/flight`, "booking");
  await expect(leaves(ana.page)).toContainText("23:40");
  await expect(arrives(ana.page)).toContainText("16:35");
  await expect(leaves(ana.page)).toContainText("10 Dec");
  // A 12-hour clock.
  await screen(ana.page, "/settings", "settings");
  await ana.page.getByRole("radio", { name: "12-hour" }).click();
  await screen(ana.page, `/trips/${trip}/bookings/flight`, "booking");
  await expect(leaves(ana.page)).toContainText("11:40 pm");
  await expect(arrives(ana.page)).toContainText("4:35 pm");
  // Month first.
  await screen(ana.page, "/settings", "settings");
  await ana.page.getByRole("radio", { name: "Dec 9" }).click();
  await screen(ana.page, `/trips/${trip}/bookings/flight`, "booking");
  await expect(leaves(ana.page)).toContainText("December 10");
  await expect(arrives(ana.page)).toContainText("December 11");

  // A device whose own time zone is Tokyo's shows every time unchanged.
  const tokyo = await device(browser, "computer", { timezoneId: "Asia/Tokyo" });
  const page = await tokyo.newPage();
  await page.goto(at("/sign-in"));
  await signIn(page, ana.person);
  await expect(page.locator('[data-screen="trips"]')).toBeVisible();
  await screen(page, `/trips/${trip}/bookings/flight`, "booking");
  await expect(leaves(page)).toContainText("23:40");
  await expect(arrives(page)).toContainText("16:35");
  await expect(leaves(page)).toContainText("10 Dec");
  await tokyo.close();
  await ana.context.close();
});

test("PLN-F15 — a trip opens on a home page for each traveller, with their own day, bookings and country", async ({ browser }) => {
  const ana = await traveller(browser, "Ana");
  const sam = await traveller(browser, "Sam", "phone");
  await sam.context.grantPermissions(["geolocation"]);
  await sam.context.setGeolocation({ latitude: -33.45, longitude: -70.66 });
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await join(ana, sam, trip);
  await send(sam.page, trip, "calendar", calendarChange({ op: "traveller-dates", traveller: sam.account, dates: { first: "2026-12-06", last: "2026-12-13" } }));
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "tour", travellers: [sam.account], kind: "activity", sort: "tour", title: "Torres del Paine full day", starts: exact("America/Punta_Arenas", "2026-12-09", "07:30") }) }));
  await send(ana.page, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "flight", travellers: [ana.account], kind: "flight", seats: [], legs: [{ flight: "LA 98", from: { code: "PUQ" }, to: { code: "SCL" }, leaves: exact("America/Punta_Arenas", "2026-12-09", "12:10"), arrives: exact(SANTIAGO, "2026-12-09", "15:35") }] }) }));
  await catchUp(sam.page);
  const day = sam.page.locator("[data-day]");

  await sam.page.clock.setFixedTime(new Date("2026-12-03T12:00:00"));
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(day).toHaveText("3 days to go");

  // On 9 December: day 4 of 8, the tour, and not the flight for Ana alone.
  await sam.page.clock.setFixedTime(new Date("2026-12-09T12:00:00"));
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(day).toHaveText("Day 4 of 8");
  await expect(sam.page.locator('[data-screen="home"]')).toContainText("Torres del Paine full day");
  await expect(sam.page.locator('[data-screen="home"]')).not.toContainText("LA 98");

  // In Chile, the home page links to the page made for Chile, and no request holds the location.
  const sent: string[] = [];
  sam.page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`));
  await sam.page.locator('[data-action="find-country"]').click();
  await sam.page.locator('a:has([data-country="CL"])').click();
  await expect(sam.page.locator('[data-screen="page"] .title')).toHaveText("Chile");
  for (const request of sent) expect(request).not.toMatch(/-33\.4|-70\.6|"CL"|country=CL/);

  await sam.page.clock.setFixedTime(new Date("2026-12-14T12:00:00"));
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(day).toHaveText("Your trip is over");
  for (const t of [ana, sam]) await t.context.close();
});
