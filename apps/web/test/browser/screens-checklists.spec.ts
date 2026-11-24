// The requirements of web/screens for checklists and the library, and the checks of PLN-F17 and
// PLN-F18 that need the screens, each by the verification it carries, in each engine, at a phone's
// width and a computer's (docs/spec/web/screens.md §4.9, §4.10). The online side runs in Wrangler,
// with stand-ins for Google and Resend.

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { startOutside, type Outside } from "./outside.ts";
import { calendarChange, createTrip, device, invite, newTraveller, noSidewaysScroll, send } from "./screens-helpers.ts";
import { versionDir } from "./versions.ts";
import { startWrangler, type Wrangler } from "./wrangler.ts";

let online: Wrangler;
let outside: Outside;
let engine = "";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async ({ browserName }) => {
  engine = browserName;
  outside = await startOutside();
  online = await startWrangler(versionDir("one"), [], `checklists-${browserName}`, {
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

/** The identifiers of the templates each library starts with (PLN:LIBRARY-F6). */
const DEFAULTS = ["default-before-leaving", "default-packing"];

/**
 * A traveller signed in on a device of their own. Their library is emptied of its default
 * templates, through the online side, unless `defaults` keeps them.
 */
async function traveller(browser: Browser, name: string, kind: "phone" | "computer" = "phone", defaults = false): Promise<Traveller> {
  count++;
  const email = `${name.toLowerCase()}${count}@example.com`;
  const context = await device(browser, kind);
  const page = await newTraveller(context, online, { sub: `${engine}-checklists-${name}-${count}`, email, name }, name);
  const account = await page.evaluate(async () => (await (window as unknown as { itineroStore: { open(): Promise<{ account?: string }> } }).itineroStore.open()).account!);
  if (!defaults) {
    const statuses = await page.evaluate(async (ids) => {
      await fetch("/api/library/sync", { method: "POST", headers: { "content-type": "application/json", "Itinero-Api": "1" }, body: "{}" });
      return Promise.all(ids.map(async (id) => (await fetch(`/api/library/templates/${id}`, { method: "DELETE", headers: { "Itinero-Api": "1" } })).status));
    }, DEFAULTS);
    expect(statuses).toEqual(DEFAULTS.map(() => 200));
  }
  return { context, page, account, email };
}

async function join(admin: Traveller, who: Traveller, trip: string): Promise<void> {
  const link = await invite(admin.page, outside, trip, who.email, "edit", "none");
  await who.page.goto(new URL(link, online.url).href);
  await expect(who.page.locator('[data-screen="home"]')).toBeVisible();
}

const at = (path: string) => new URL(path, online.url).href;

async function screen(page: Page, path: string, name: string): Promise<void> {
  await page.goto(at(path));
  await expect(page.locator(`[data-screen="${name}"]`)).toBeVisible();
}

/** Makes the template Before leaving, with four items, on the library's screen. */
async function beforeLeaving(page: Page): Promise<void> {
  await screen(page, "/library", "library");
  await page.locator('[data-action="new-template"]').click();
  await page.locator('[data-form="new-template"] input[name="title"]').fill("Before leaving");
  await page.locator('[data-action="add-template"]').click();
  await expect(page.locator('[data-screen="template"]')).toBeVisible();
  for (const item of ["Passport valid for six months", "Copies of documents", "Travel insurance", "Order pesos"]) {
    await page.locator('input[name="new-item"]').fill(item);
    await page.locator('[data-action="add-item"]').click();
    await expect(page.locator(".item-text", { hasText: item })).toBeVisible();
  }
}

const items = (page: Page) => page.locator("[data-item] .item-text");

/** Holds the pointer down on one element, then drags it onto another. */
async function drag(page: Page, from: ReturnType<Page["locator"]>, to: ReturnType<Page["locator"]>): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = (await from.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 4);
  const end = (await to.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("WEB:SCREENS-F11, PLN-F18 — a trip's checklists have a screen of their own, where the traveller starts, ticks and arranges theirs", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "phone");
  await beforeLeaving(ana.page);
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);

  // The checklists open from the trip's bar, which fits a phone's width with its six entries.
  await screen(ana.page, `/trips/${trip}`, "home");
  await noSidewaysScroll(ana.page);
  await ana.page.locator(".trip-bar-item", { hasText: "Checklists" }).click();
  await expect(ana.page.locator('[data-screen="checklists"]')).toBeVisible();

  // Started from Before leaving: listed with 0 of 4.
  await ana.page.locator('[data-action="new-checklist"]').click();
  await ana.page.locator("[data-template]", { hasText: "Before leaving" }).click();
  await expect(ana.page.locator('[data-screen="checklist"]')).toBeVisible();
  await ana.page.locator(".back").click();
  await expect(ana.page.locator("[data-checklist]", { hasText: "Before leaving" }).locator("[data-progress]")).toHaveText("0 of 4");

  // The second item ticked stays second, marked as done, and the list says 1 of 4.
  await ana.page.locator("[data-checklist] a", { hasText: "Before leaving" }).click();
  await ana.page.locator('[data-item] .item-text', { hasText: "Copies of documents" }).click();
  await expect(ana.page.locator("[data-item]").nth(1)).toHaveAttribute("data-ticked", "yes");
  await expect(items(ana.page).nth(1)).toHaveText("Copies of documents");
  await expect(ana.page.locator(".lead[data-progress]")).toHaveText("1 of 4 done");
  expect(await items(ana.page).nth(1).evaluate((e) => getComputedStyle(e).textDecorationLine)).toContain("line-through");

  // An item added, moved to the top, and rewritten, each shown at once.
  await ana.page.locator('input[name="new-item"]').fill("Charge the camera");
  await ana.page.locator('[data-action="add-item"]').click();
  await expect(items(ana.page).last()).toHaveText("Charge the camera");
  await drag(ana.page, ana.page.locator('[data-action="move-item"]').last(), ana.page.locator("[data-item]").first());
  await expect(items(ana.page).first()).toHaveText("Charge the camera");
  await ana.page.locator("[data-item]").first().locator('[data-action="item-menu"]').click();
  await ana.page.locator('[data-action="edit-item"]').click();
  await ana.page.locator('input[name="item-text"]').fill("Charge the camera and the phone");
  await ana.page.locator('[data-action="save-item"]').click();
  await expect(items(ana.page).first()).toHaveText("Charge the camera and the phone");

  // Saved as a template, the library lists it.
  await ana.page.locator('[data-action="save-template"]').click();
  await expect(ana.page.locator("[data-saved]")).toBeVisible();
  await screen(ana.page, "/library", "library");
  await expect(ana.page.locator("[data-checklist]")).toHaveCount(2);

  // With the device offline, the checklists show, and no control ticks or changes them.
  await screen(ana.page, `/trips/${trip}/checklists`, "checklists");
  await ana.context.setOffline(true);
  await ana.page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(ana.page.locator("[data-offline]")).toBeVisible();
  await expect(ana.page.locator("[data-checklist]")).toHaveCount(1);
  await expect(ana.page.locator('[data-action="new-checklist"], [data-action="move-checklist"]')).toHaveCount(0);
  await ana.page.locator("[data-checklist] a").first().click();
  await expect(ana.page.locator('[data-screen="checklist"]')).toBeVisible();
  await expect(ana.page.locator('input[type="checkbox"], [data-action="add-item"], [data-action="item-menu"], [data-action="move-item"], [data-action="delete"], [data-action="rename"]')).toHaveCount(0);
  await ana.page.locator(".item-text").nth(2).click();
  await expect(ana.page.locator(".lead[data-progress]")).toHaveText("1 of 5 done");
  await ana.context.setOffline(false);
  await ana.context.close();
});

test("PLN:LIBRARY-F6 — a new traveller's library lists the default templates, each with its items", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "phone", true);
  await screen(ana.page, "/library", "library");
  await expect(ana.page.locator("[data-checklist]")).toHaveCount(2);
  for (const [n, [title, count]] of [["Before leaving", 7], ["Packing", 7]].entries()) {
    await expect(ana.page.locator("[data-checklist]").nth(n)).toContainText(title as string);
    await expect(ana.page.locator("[data-checklist]").nth(n).locator("[data-progress]")).toHaveText(`${count} items`);
  }
  await ana.context.close();
});

test("WEB:SCREENS-F12, PLN-F17 — a traveller keeps their templates on a screen of their own, reached from any trip", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  await beforeLeaving(ana.page);
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);

  // From a trip's menu, and from the list of trips, the library lists Before leaving with its items.
  await screen(ana.page, `/trips/${trip}`, "home");
  await ana.page.locator('[data-action="trip-menu"]').click();
  await ana.page.getByRole("menuitem", { name: "Your templates" }).click();
  await expect(ana.page.locator('[data-screen="library"]')).toBeVisible();
  await expect(ana.page.locator("[data-checklist]", { hasText: "Before leaving" }).locator("[data-progress]")).toHaveText("4 items");
  // The library's way back opens the list of trips, which links to the library again.
  await ana.page.locator(".back").click();
  await expect(ana.page.locator('[data-screen="trips"]')).toBeVisible();
  await ana.page.locator("a", { hasText: "Your templates" }).click();
  await expect(ana.page.locator("[data-checklist]", { hasText: "Before leaving" })).toBeVisible();

  // Packing, with three items, moved to the top, is listed first with 3 items.
  await ana.page.locator('[data-action="new-template"]').click();
  await ana.page.locator('[data-form="new-template"] input[name="title"]').fill("Packing");
  await ana.page.locator('[data-action="add-template"]').click();
  for (const item of ["Boots", "Adaptor", "Charger"]) {
    await ana.page.locator('input[name="new-item"]').fill(item);
    await ana.page.locator('[data-action="add-item"]').click();
    await expect(ana.page.locator(".item-text", { hasText: item })).toBeVisible();
  }
  // A template offers no way to tick an item.
  await expect(ana.page.locator('input[type="checkbox"]')).toHaveCount(0);
  await ana.page.locator(".back").click();
  await drag(ana.page, ana.page.locator('[data-action="move-checklist"]').last(), ana.page.locator("[data-checklist]").first());
  await expect(ana.page.locator("[data-checklist]").first()).toContainText("Packing");
  await expect(ana.page.locator("[data-checklist]").first().locator("[data-progress]")).toHaveText("3 items");

  // Renamed in place, by tapping its title.
  await ana.page.locator("[data-checklist] a", { hasText: "Packing" }).click();
  await ana.page.locator('[data-action="rename"]').click();
  await ana.page.locator('.rename input[name="title"]').fill("Packing for Chile");
  await ana.page.locator('[data-action="save-title"]').click();
  await expect(ana.page.locator('[data-action="rename"]')).toHaveText("Packing for Chile");

  // With the device offline, the library shows, and no control changes it.
  await screen(ana.page, "/library", "library");
  await ana.context.setOffline(true);
  await ana.page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(ana.page.locator("[data-checklist]")).toHaveCount(2);
  await expect(ana.page.locator('[data-action="new-template"], [data-action="move-checklist"]')).toHaveCount(0);
  await ana.context.setOffline(false);
  await ana.context.close();
});

test("WEB:SCREENS-F8 — deleting a checklist and a template each ask first", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "computer");
  await beforeLeaving(ana.page);
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await screen(ana.page, `/trips/${trip}/checklists`, "checklists");
  await ana.page.locator('[data-action="new-checklist"]').click();
  await ana.page.locator("[data-template]", { hasText: "Before leaving" }).click();
  await expect(ana.page.locator('[data-screen="checklist"]')).toBeVisible();

  await ana.page.locator('[data-action="delete"]').click();
  await expect(ana.page.getByRole("alertdialog")).toContainText("go for good");
  await expect(ana.page.locator('[data-dialog="cancel"]')).toBeFocused();
  await ana.page.locator('[data-dialog="cancel"]').click();
  await expect(ana.page.getByRole("alertdialog")).toHaveCount(0);
  await ana.page.locator('[data-action="delete"]').click();
  await ana.page.locator('[data-dialog="confirm"]').click();
  await expect(ana.page.locator('[data-screen="checklists"]')).toBeVisible();
  await expect(ana.page.locator("[data-checklist]")).toHaveCount(0);

  await screen(ana.page, "/library", "library");
  await ana.page.locator("[data-checklist] a", { hasText: "Before leaving" }).click();
  await ana.page.locator('[data-action="delete"]').click();
  await expect(ana.page.getByRole("alertdialog")).toContainText("Before leaving");
  await ana.page.locator('[data-dialog="confirm"]').click();
  await expect(ana.page.locator('[data-screen="library"]')).toBeVisible();
  await expect(ana.page.locator("[data-checklist]")).toHaveCount(0);
  await ana.context.close();
});

test("WEB:SCREENS-F13 — until their trip starts, the home page lists the traveller's checklists not yet done", async ({ browser }) => {
  const ana = await traveller(browser, "Ana", "phone");
  const sam = await traveller(browser, "Sam", "phone");
  const trip = await createTrip(ana.page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await join(ana, sam, trip);
  await send(sam.page, trip, "calendar", calendarChange({ op: "traveller-dates", traveller: sam.account, dates: { first: "2026-12-06", last: "2026-12-13" } }));

  // Before leaving, 2 of 5 ticked, and Packing, 4 of 4 ticked.
  for (const [title, count, ticked] of [["Before leaving", 5, 2], ["Packing", 4, 4]] as const) {
    await screen(sam.page, `/trips/${trip}/checklists`, "checklists");
    await sam.page.locator('[data-action="new-checklist"]').click();
    await sam.page.locator('[data-form="empty-checklist"] input[name="title"]').fill(title);
    await sam.page.locator('[data-action="start-empty"]').click();
    await expect(sam.page.locator('[data-screen="checklist"]')).toBeVisible();
    for (let n = 1; n <= count; n++) {
      await sam.page.locator('input[name="new-item"]').fill(`${title} ${n}`);
      await sam.page.locator('[data-action="add-item"]').click();
      await expect(items(sam.page)).toHaveCount(n);
    }
    for (let n = 0; n < ticked; n++) {
      await sam.page.locator('[data-action="tick"]').nth(n).check();
      await expect(sam.page.locator("[data-item]").nth(n)).toHaveAttribute("data-ticked", "yes");
    }
  }

  await sam.page.clock.setFixedTime(new Date("2026-12-03T12:00:00"));
  await screen(sam.page, `/trips/${trip}`, "home");
  const group = sam.page.locator(".group", { hasText: "Before you go" });
  await expect(group.locator("[data-not-done]")).toHaveCount(1);
  await expect(group).toContainText("Before leaving");
  await expect(group).toContainText("2 of 5");
  await group.locator("a").click();
  await expect(sam.page.locator('[data-screen="checklist"] [data-action="rename"]')).toHaveText("Before leaving");

  await sam.page.clock.setFixedTime(new Date("2026-12-06T12:00:00"));
  await screen(sam.page, `/trips/${trip}`, "home");
  await expect(sam.page.locator("[data-not-done]")).toHaveCount(0);

  // The admin sees none of Sam's checklists (PLN-F18, ACC-F14).
  await screen(ana.page, `/trips/${trip}/checklists`, "checklists");
  await expect(ana.page.locator("[data-checklist]")).toHaveCount(0);
  for (const t of [ana, sam]) await t.context.close();
});
