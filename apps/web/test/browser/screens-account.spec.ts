// WEB:SCREENS-F9 and WEB:SCREENS-F10 in each engine, against the online side in Wrangler with
// stand-ins for Google and Resend (docs/spec/web/screens.md §4.9). Google's own button cannot be
// drawn in a test, so a test signs in with an ID token of the stand-in's, as the button would.

import { expect, test } from "@playwright/test";
import { startOutside, type Outside } from "./outside.ts";
import { booking, bookingChange, chooseName, createTrip, device, exact, invite, newTraveller, open, send, signIn } from "./screens-helpers.ts";
import { versionDir } from "./versions.ts";
import { startWrangler, type Wrangler } from "./wrangler.ts";

let online: Wrangler;
let outside: Outside;

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async ({ browserName }) => {
  outside = await startOutside();
  online = await startWrangler(versionDir("one"), [], `account-${browserName}`, {
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

const ANA = { sub: "ana", email: "ana@example.com", name: "Ana Rojas" };
const SAM = { sub: "sam", email: "sam@example.com", name: "Sam Taylor" };

test("WEB:SCREENS-F9 — a traveller signs in with Google, and a computer says its trips stay until they sign out", async ({ browser }) => {
  const phone = await device(browser, "phone");
  const page = await open(phone, online);
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator("[data-google-button]")).toBeAttached();
  await expect(page.locator('[data-notice="computer"]')).toHaveCount(0);
  await signIn(page, ANA);
  await chooseName(page, "Ana");
  await expect(page.locator('[data-screen="trips"]')).toBeVisible();

  const computer = await device(browser, "computer");
  const signingIn = await open(computer, online);
  await expect(signingIn.locator('[data-notice="computer"]')).toContainText("stay on this computer until you sign out");

  // Signing out from a trip's menu opens the sign-in screen.
  const trip = await createTrip(page, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  await page.goto(new URL(`/trips/${trip}`, online.url).href);
  await page.locator('[data-action="trip-menu"]').click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.locator('[data-screen="sign-in"]')).toBeVisible();
  await phone.close();
  await computer.close();
});

test("WEB:SCREENS-F10 — a traveller signing in for the first time chooses their name first, and changes it later", async ({ browser }) => {
  const anaDevice = await device(browser, "computer");
  const ana = await newTraveller(anaDevice, online, { ...ANA, sub: "ana-2", email: "ana2@example.com" }, "Ana");
  const trip = await createTrip(ana, "Patagonia", "2026-12-01", "2026-12-20", ["CL"]);
  const link = await invite(ana, outside, trip, SAM.email, "edit", "none");

  // Sam opens the invitation, signs in, and is asked for a name before it is accepted.
  const samDevice = await device(browser, "phone");
  const sam = await open(samDevice, online, link);
  await expect(sam).toHaveURL(/\/sign-in\?next=/);
  await signIn(sam, SAM);
  await expect(sam.locator('[data-screen="name"]')).toBeVisible();
  await expect(sam.locator('input[name="name"]')).toHaveValue("Sam Taylor");
  expect(await ana.evaluate(async (id) => (await (window as unknown as { itineroStore: { trip(id: string): Promise<{ members: { name: string }[] }> } }).itineroStore.trip(id)).members.length, trip)).toBe(1);
  await chooseName(sam, "Sam");
  await expect(sam.locator('[data-screen="home"]')).toBeVisible();
  await expect(sam.locator(".title")).toHaveText("Patagonia");

  // Sam is named on the members screen, and on each booking naming them.
  const samAccount = await sam.evaluate(async () => (await (window as unknown as { itineroStore: { open(): Promise<{ account?: string }> } }).itineroStore.open()).account!);
  await send(ana, trip, "bookings", bookingChange({ op: "add", booking: booking({ id: "tour", travellers: [samAccount], kind: "activity", sort: "tour", title: "Torres del Paine", starts: exact("America/Punta_Arenas", "2026-12-09", "07:30") }) }));
  await ana.goto(new URL(`/trips/${trip}/members`, online.url).href);
  await expect(ana.locator(`[data-member="${samAccount}"]`)).toContainText("Sam");
  await ana.goto(new URL(`/trips/${trip}/bookings/tour`, online.url).href);
  await expect(ana.getByText("Sam", { exact: true })).toBeVisible();

  // In the settings, Sam changes their name, and every screen shows it.
  await sam.goto(new URL("/settings", online.url).href);
  await sam.locator('input[name="name"]').first().fill("Sam T");
  await sam.getByRole("button", { name: "Save" }).first().click();
  await expect(sam.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await ana.evaluate(() => (window as unknown as { itineroStore: { catchUpAll(): Promise<void> } }).itineroStore.catchUpAll());
  await ana.goto(new URL(`/trips/${trip}/members`, online.url).href);
  await expect(ana.locator(`[data-member="${samAccount}"]`)).toContainText("Sam T");
  await ana.goto(new URL(`/trips/${trip}/bookings/tour`, online.url).href);
  await expect(ana.getByText("Sam T", { exact: true })).toBeVisible();
  await anaDevice.close();
  await samDevice.close();
});
