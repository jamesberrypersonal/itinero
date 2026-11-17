// What the browser tests share: opening Itinero, reading the shell's state, and playing the part of
// web/trip-store, which is built in Milestone Web-1.3 (docs/spec/web/shell.md §4.5).

import { expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ShellState } from "../../src/shell/index.ts";
import type { Online } from "./server.ts";
import { versionDir, type VersionName } from "./versions.ts";

type ShellModule = typeof import("../../src/shell/index.ts");
type TripTimeModule = typeof import("@itinero/trip-time");

declare global {
  interface Window {
    itineroShell: ShellModule;
    itineroTripTime: TripTimeModule;
  }
}

/** The name the build gave a version, from its version.json. */
export function versionOf(name: VersionName): string {
  return (JSON.parse(readFileSync(join(versionDir(name), "version.json"), "utf8")) as { version: string }).version;
}

/** The time-zone rules the build carried, with its release changed: rules newer than any version's. */
export function newerRules(release: string): string {
  const own = JSON.parse(readFileSync(join(versionDir("one"), "time-zone-rules.json"), "utf8")) as { version: string };
  return JSON.stringify({ ...own, version: release });
}

/** Opens Itinero in a new window, and waits until the shell has started. */
export async function open(context: BrowserContext, url: string, path = "/"): Promise<Page> {
  const page = await context.newPage();
  await page.goto(new URL(path, url).href);
  await expect(page.locator('[data-shell="version"]')).not.toBeEmpty();
  return page;
}

/** Opens Itinero, and waits until it says it is ready to use offline. */
export async function openReady(context: BrowserContext, url: string): Promise<Page> {
  const page = await open(context, url);
  await expect(page.locator('[data-shell="ready-offline"]')).toBeVisible();
  return page;
}

/** Takes the device offline, or back online. */
export async function setOnline(context: BrowserContext, online: Online, yes: boolean): Promise<void> {
  online.reachable(yes);
  await context.setOffline(!yes);
}

/** Closes every window of Itinero in the browser. */
export async function closeAll(context: BrowserContext): Promise<void> {
  for (const page of context.pages()) await page.close();
}

/** The version a window is running, as it says. */
export async function running(page: Page): Promise<string> {
  return (await page.locator('[data-shell="version"]').textContent()) ?? "";
}

export async function shellState(page: Page): Promise<ShellState> {
  return page.evaluate(() => window.itineroShell.current()!);
}

/** Tells the shell the device has connected, as web/trip-store will each time it connects. */
export async function connected(page: Page): Promise<void> {
  await page.evaluate(() => window.itineroShell.online());
}

/**
 * Sends a request to the online side with the version's `Itinero-Api`, as web/trip-store will, and
 * calls `updateFirst` on an `update-first` refusal. Gives the status.
 */
export async function reachOnline(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const shell = window.itineroShell;
    const response = await fetch("/api/trips", { headers: { [shell.API_HEADER]: String(shell.API) } });
    if (response.status === 426) {
      const body = (await response.json()) as { code: string };
      if (body.code === "update-first") shell.updateFirst();
    }
    return response.status;
  });
}

/**
 * Waits until the browser has installed a version that waits behind the running one. Browsers check
 * for a new service worker when asked, so this tells the shell the device connected until it has.
 */
export async function untilUpdateWaiting(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await connected(page);
        return (await shellState(page)).updateWaiting;
      },
      { timeout: 20_000, intervals: [250, 500, 1000] },
    )
    .toBe(true);
}
