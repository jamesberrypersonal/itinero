// The requirements of web/places, each by the verification it carries, in each engine
// (docs/requirements/web/places.md, docs/spec/web/places.md §4.6). A stand-in trip store in the
// page gives the trips whose countries the places component fetches, as web/trip-store will.

import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type * as PlacesModule from "../../src/places/index.ts";
import { closeAll, open, openReady, setOnline } from "./helpers.ts";
import { startOnline, type Online } from "./server.ts";
import { versionDir } from "./versions.ts";

type StandIn = {
  copies: Map<string, PlacesModule.CopyCountries>;
  online: boolean;
  tripListeners: Set<(trips: readonly { id: string }[]) => void>;
  onlineListeners: Set<(online: boolean) => void>;
};

declare global {
  interface Window {
    itineroPlaces: typeof PlacesModule;
    standIn: StandIn;
  }
}

let online: Online;

test.beforeEach(async () => {
  online = await startOnline(versionDir("one"));
});

test.afterEach(async () => {
  await online.close();
});

/** Starts the places component with a stand-in trip store holding a trip through Chile. */
async function startWithChile(page: Page): Promise<void> {
  await page.evaluate(() => {
    const standIn: StandIn = {
      copies: new Map([["t-chile", { pages: { pages: [{ country: "CL" }] }, calendar: { stretches: [] } }]]),
      online: true,
      tripListeners: new Set(),
      onlineListeners: new Set(),
    };
    window.standIn = standIn;
    window.itineroPlaces.startPlaces({
      trips: async () => [...standIn.copies.keys()].map((id) => ({ id })),
      trip: async (id) => standIn.copies.get(id),
      onTrips: (listener) => (standIn.tripListeners.add(listener), () => standIn.tripListeners.delete(listener)),
      isOnline: () => standIn.online,
      onOnline: (listener) => (standIn.onlineListeners.add(listener), () => standIn.onlineListeners.delete(listener)),
    });
  });
}

/** Tells the places component, as the trip store would, that the trips have changed. */
async function tripsChanged(page: Page): Promise<void> {
  await page.evaluate(() => {
    const trips = [...window.standIn.copies.keys()].map((id) => ({ id }));
    for (const listener of window.standIn.tripListeners) listener(trips);
  });
}

async function held(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => window.itineroPlaces.held());
}

async function airportsHeld(page: Page): Promise<boolean> {
  return page.evaluate(async () => (await window.itineroPlaces.airport("SCL")) !== undefined);
}

const fetches = (path: string) => online.requests.filter((requested) => requested === path).length;

test.describe("WEB:PLACES-F1 — an airport's code, or a town's name, gives the place and its time zone, with no connection", () => {
  test("on a device holding the places of Chile, with no connection", async ({ context }) => {
    await startWithChile(await openReady(context, online.url));
    const first = context.pages()[0]!;
    await expect.poll(() => held(first)).toEqual(["CL"]);
    await expect.poll(() => airportsHeld(first)).toBe(true);

    await setOnline(context, online, false);
    await closeAll(context);
    const page = await open(context, online.url);
    const found = await page.evaluate(async () => {
      const places = window.itineroPlaces;
      return {
        scl: await places.airport("SCL"),
        mad: await places.airport("MAD"),
        natales: (await places.towns("Puerto Nat"))[0],
        santiago: (await places.towns("Santiago"))[0],
        valparaiso: (await places.towns("valparaiso"))[0]?.name,
        peru: await places.towns("Arequipa"),
      };
    });
    expect(found.scl).toMatchObject({ kind: "airport", code: "SCL", town: "Santiago", country: "CL", zone: "America/Santiago" });
    expect(found.mad).toMatchObject({ code: "MAD", zone: "Europe/Madrid" });
    expect(found.natales).toMatchObject({ kind: "town", name: "Puerto Natales", country: "CL", zone: "America/Punta_Arenas" });
    expect(found.santiago).toMatchObject({ name: "Santiago", region: "Santiago Metropolitan", zone: "America/Santiago" });
    expect(found.valparaiso).toBe("Valparaíso");
    expect(found.peru).toEqual([]);
  });
});

test.describe("WEB:PLACES-F2 — a device holds the towns of every country its trips visit, fetched in the background", () => {
  test("Chile and the airports are held, then Argentina once a stretch is added, then Peru once chosen", async ({ context }) => {
    const page = await openReady(context, online.url);
    await startWithChile(page);
    await expect.poll(() => held(page)).toEqual(["CL"]);
    await expect.poll(() => airportsHeld(page)).toBe(true);

    // A stretch in Argentina, added while the device is offline, is fetched once it connects.
    await page.evaluate(() => {
      window.standIn.online = false;
      window.standIn.copies.get("t-chile")!.calendar = { stretches: [{ place: { country: "AR" } }] };
      for (const listener of window.standIn.onlineListeners) listener(false);
    });
    await tripsChanged(page);
    await page.waitForTimeout(300);
    expect(await held(page)).toEqual(["CL"]);
    await page.evaluate(() => {
      window.standIn.online = true;
      for (const listener of window.standIn.onlineListeners) listener(true);
    });
    await expect.poll(() => held(page)).toEqual(["AR", "CL"]);

    // Online, a traveller fetches Peru by choosing it.
    expect(await page.evaluate(() => window.itineroPlaces.fetchCountry("PE"))).toEqual({ ok: true, value: true });
    expect(await held(page)).toEqual(["AR", "CL", "PE"]);
  });

  test("a country's towns are fetched once, and again only when a newer list is published", async ({ context }) => {
    const page = await openReady(context, online.url);
    await startWithChile(page);
    await expect.poll(() => held(page)).toEqual(["CL"]);
    await expect.poll(() => airportsHeld(page)).toBe(true);
    for (let i = 0; i < 3; i++) {
      await tripsChanged(page);
      await page.waitForTimeout(150);
    }
    expect(fetches("/places/CL.json")).toBe(1);
    expect(fetches("/places/airports.json")).toBe(1);

    const index = JSON.parse(readFileSync(join(versionDir("one"), "places", "index.json"), "utf8")) as { version: string };
    online.publishFile("/places/index.json", JSON.stringify({ ...index, version: "2099-01-01" }));
    await tripsChanged(page);
    await expect.poll(() => fetches("/places/CL.json")).toBe(2);
    await expect.poll(() => fetches("/places/airports.json")).toBe(2);
  });

  test("a country chosen is kept up to date like a trip's", async ({ context }) => {
    const page = await openReady(context, online.url);
    await startWithChile(page);
    await expect.poll(() => held(page)).toEqual(["CL"]);
    await page.evaluate(() => window.itineroPlaces.fetchCountry("PE"));
    await page.evaluate(async () => (await caches.open("itinero-places")).delete("/places/PE.json"));
    await tripsChanged(page);
    await expect.poll(() => held(page)).toEqual(["CL", "PE"]);
  });

  test("fetching a country refuses with offline, or with unknown-country", async ({ context }) => {
    const page = await openReady(context, online.url);
    await startWithChile(page);
    const unknown = await page.evaluate(() => window.itineroPlaces.fetchCountry("ZZ"));
    expect(unknown.ok ? undefined : unknown.refusal.code).toBe("unknown-country");
    await page.evaluate(() => {
      window.standIn.online = false;
    });
    const offline = await page.evaluate(() => window.itineroPlaces.fetchCountry("BO"));
    expect(offline.ok ? undefined : offline.refusal.code).toBe("offline");
    expect(fetches("/places/BO.json")).toBe(0);
  });

  test("no version of Itinero deletes the places", async ({ context }) => {
    const page = await openReady(context, online.url);
    await startWithChile(page);
    await expect.poll(() => held(page)).toEqual(["CL"]);
    online.publish(versionDir("two"));
    await expect
      .poll(async () => {
        await page.evaluate(() => window.itineroShell.online());
        return (await page.evaluate(() => window.itineroShell.current()!)).updateWaiting;
      })
      .toBe(true);
    await closeAll(context);
    const reopened = await open(context, online.url);
    await expect(reopened.locator('[data-shell="ready-offline"]')).toBeVisible();
    expect(await held(reopened)).toEqual(["CL"]);
  });
});
