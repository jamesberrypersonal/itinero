// What the screens' browser tests share: the online side in Wrangler with stand-ins for Google and
// Resend, signing travellers in through the sign-in screen, and making a trip's parts quickly.

import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { changeToText as bookingChange, type Booking } from "@itinero/bookings";
import { changeToText as calendarChange } from "@itinero/itinerary";
import { changeToText as pageChange } from "@itinero/pages";
import { idToken, invitationTo, type Outside, type Person } from "./outside.ts";
import type { Wrangler } from "./wrangler.ts";

export { bookingChange, calendarChange, pageChange };

export const PHONE = { width: 360, height: 760 };
export const COMPUTER = { width: 1280, height: 860 };

/** A device: a phone 360 pixels wide, or a computer 1280 wide, in English and London time. */
export async function device(browser: Browser, kind: "phone" | "computer", options: Parameters<Browser["newContext"]>[0] = {}): Promise<BrowserContext> {
  return browser.newContext({
    viewport: kind === "phone" ? PHONE : COMPUTER,
    hasTouch: kind === "phone",
    isMobile: false,
    locale: "en-GB",
    timezoneId: "Europe/London",
    ...options,
  });
}

/** Opens Itinero at an address, and waits for the screens to draw. */
export async function open(context: BrowserContext, online: Wrangler, path = "/"): Promise<Page> {
  const page = await context.newPage();
  await page.goto(new URL(path, online.url).href);
  await page.waitForFunction(() => document.querySelector("[data-screen]") !== null);
  return page;
}

/** Signs a person in from the sign-in screen, as Google's button would, with a token of the stand-in's. */
export async function signIn(page: Page, person: Person): Promise<void> {
  await expect(page.locator('[data-screen="sign-in"]')).toBeVisible();
  const nonce = await page.evaluate(async () => {
    const answer = await fetch("/api/auth/nonce", { method: "POST", headers: { "Itinero-Api": "2" } });
    return ((await answer.json()) as { nonce: string }).nonce;
  });
  const token = await idToken(person, nonce);
  const next = new URL(page.url()).searchParams.get("next") ?? "/";
  const error = await page.evaluate(
    ({ token, nonce, next }) => (window as unknown as { itineroAuth: { complete(t: string, n: string, x: string): Promise<string | undefined> } }).itineroAuth.complete(token, nonce, next),
    { token, nonce, next },
  );
  expect(error).toBeUndefined();
}

/**
 * Chooses a name on the name screen, submitted with Enter from the field. The name screen is the
 * first a new page is pressed on, and Firefox now and then loses the first press on a new page:
 * Continue receives the mouse's release but never its press, so nothing is sent.
 */
export async function chooseName(page: Page, name: string): Promise<void> {
  await expect(page.locator('[data-screen="name"]')).toBeVisible();
  const field = page.locator('input[name="name"]');
  await field.fill(name);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await field.press("Enter");
}

/** Signs a new traveller in on a device, and has them choose their name. */
export async function newTraveller(context: BrowserContext, online: Wrangler, person: Person, name = person.name): Promise<Page> {
  const page = await open(context, online);
  await signIn(page, person);
  await chooseName(page, name);
  await expect(page.locator('[data-screen="trips"]')).toBeVisible();
  return page;
}

/** Sends a change through the window's trip store, which must be applied. */
export async function send(page: Page, trip: string, target: string, change: string): Promise<void> {
  const result = await page.evaluate(
    ({ trip, target, change }) => (window as unknown as { itineroStore: { send(t: string, g: string, c: string): Promise<{ ok: boolean }> } }).itineroStore.send(trip, target, change),
    { trip, target, change },
  );
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
}

type StoreWindow = {
  itineroStore: {
    create(name: string, dates: { first: string; last: string }, countries: string[]): Promise<{ ok: true; value: { trip: string } } | { ok: false }>;
    invite(trip: string, email: string, level: string, calendar: string): Promise<{ ok: boolean }>;
  };
};

/** Creates a trip through the window's trip store. */
export async function createTrip(page: Page, name: string, first: string, last: string, countries: string[]): Promise<string> {
  const made = await page.evaluate(
    ({ name, first, last, countries }) => (window as unknown as StoreWindow).itineroStore.create(name, { first, last }, countries),
    { name, first, last, countries },
  );
  if (!made.ok) throw new Error("The trip was not created");
  return made.value.trip;
}

/** Invites an address to a trip, and gives the invitation's link from the email the stand-in kept. */
export async function invite(page: Page, outside: Outside, trip: string, email: string, level = "edit", calendar = "none"): Promise<string> {
  const sent = await page.evaluate(
    ({ trip, email, level, calendar }) => (window as unknown as StoreWindow).itineroStore.invite(trip, email, level, calendar),
    { trip, email, level, calendar },
  );
  expect(sent.ok).toBe(true);
  return invitationTo(outside, email);
}

export const exact = (zone: string, date: string, time: string) => ({ kind: "exact", zone, date, at: { time } });

/** A booking, as the bookings package takes it, from its kind's own fields. */
export const booking = (fields: Record<string, unknown>) => ({ revision: 0, details: {}, ...fields }) as unknown as Booking;

/** Nothing on the screen is wider than the window: no sideways scrolling. */
export async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `the page at ${page.url()} scrolls sideways`).toBeLessThanOrEqual(client);
}
