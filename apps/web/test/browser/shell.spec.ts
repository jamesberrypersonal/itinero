// The requirements of web/shell, each by the verification it carries, in each engine
// (docs/requirements/web/shell.md, docs/spec/web/shell.md §4.5). The checks that need a real
// phone, such as adding Itinero to its home screen, are made by hand.

import { expect, test } from "@playwright/test";
import {
  closeAll,
  setOnline,
  connected,
  newerRules,
  open,
  openReady,
  reachOnline,
  running,
  shellState,
  untilUpdateWaiting,
  versionOf,
} from "./helpers.ts";
import { startOnline, type Online } from "./server.ts";
import { versionDir } from "./versions.ts";

let online: Online;

test.beforeEach(async () => {
  online = await startOnline(versionDir("one"));
});

test.afterEach(async () => {
  await online.close();
});

/** Every screen's address the web app has. Signed out, as these tests are, each opens the sign-in screen. */
const SCREENS = ["/", "/sign-in", "/trips/t-1", "/trips/t-1/bookings", "/trips/t-1/pages/p-1", "/settings", "/invitations/i-1"];

test.describe("WEB:SHELL-F1 — once opened with a connection, Itinero opens with none", () => {
  test("it opens with no connection after closing, and opens every screen", async ({ context }) => {
    await openReady(context, online.url);
    await setOnline(context, online, false);
    await closeAll(context);

    const page = await open(context, online.url);
    expect(await running(page)).toBe(versionOf("one"));
    for (const screen of SCREENS) {
      await page.goto(new URL(screen, online.url).href);
      await expect(page.locator('[data-screen="sign-in"]')).toBeVisible();
      expect(await running(page)).toBe(versionOf("one"));
    }
  });

  test("a screen opened by its own address with no connection opens too", async ({ context }) => {
    await openReady(context, online.url);
    await setOnline(context, online, false);
    await closeAll(context);
    const page = await open(context, online.url, "/trips/t-1/members");
    await expect(page.locator('[data-screen="sign-in"]')).toBeVisible();
  });
});

test.describe("WEB:SHELL-F2 — a new version takes over only when no window of Itinero is open", () => {
  test("an open window keeps the old version, and the new one opens once every window has closed", async ({ context }) => {
    const page = await openReady(context, online.url);
    online.publish(versionDir("two"));
    await untilUpdateWaiting(page);

    // The open window keeps working on the old version.
    expect(await running(page)).toBe(versionOf("one"));
    await page.goto(new URL("/settings", online.url).href);
    expect(await running(page)).toBe(versionOf("one"));

    await closeAll(context);
    const reopened = await open(context, online.url);
    expect(await running(reopened)).toBe(versionOf("two"));
    await expect(reopened.locator('[data-shell="ready-offline"]')).toBeVisible();
  });

  test("a version published while the device is offline opens only once it connects", async ({ context }) => {
    await openReady(context, online.url);
    await setOnline(context, online, false);
    online.publish(versionDir("two"));
    await closeAll(context);
    for (let i = 0; i < 2; i++) {
      const page = await open(context, online.url);
      expect(await running(page)).toBe(versionOf("one"));
      await closeAll(context);
    }

    // Once connected, the browser finds the new version as Itinero opens. Where no other window
    // uses the old one, some engines open the new version at once; otherwise it waits behind the
    // window that found it, and opens the next time.
    await setOnline(context, online, true);
    let page = await open(context, online.url);
    if ((await running(page)) !== versionOf("two")) {
      await untilUpdateWaiting(page);
      await closeAll(context);
      page = await open(context, online.url);
    }
    expect(await running(page)).toBe(versionOf("two"));
  });

  test("a version is used whole: the old one's files come from its own cache", async ({ context }) => {
    const page = await openReady(context, online.url);
    online.publish(versionDir("two"));
    await untilUpdateWaiting(page);
    const files = await page.evaluate(async () =>
      Promise.all(
        [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[rel=stylesheet]")]
          .map((element) => ("src" in element ? element.src : element.href))
          // Itinero's own files: the sign-in screen also loads Google's script, from Google.
          .filter((address) => new URL(address).origin === location.origin)
          .map(async (address) => (await fetch(address)).status),
      ),
    );
    expect(files.every((status) => status === 200)).toBe(true);
    const caches = await page.evaluate(() => window.caches.keys());
    expect(caches).toContain(`itinero-${versionOf("one")}`);
    expect(caches).toContain(`itinero-${versionOf("two")}`);

    await closeAll(context);
    const reopened = await open(context, online.url);
    await expect(reopened.locator('[data-shell="ready-offline"]')).toBeVisible();
    await expect.poll(() => reopened.evaluate(() => window.caches.keys())).not.toContain(`itinero-${versionOf("one")}`);
  });
});

test.describe("WEB:SHELL-F3 — Itinero can be added to a home screen, and asks the browser to keep what it stores", () => {
  test("the manifest names Itinero, opens standalone, and gives its icons", async ({ page }) => {
    await page.goto(online.url);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = (await (await page.request.get(new URL(href!, online.url).href)).json()) as {
      name: string;
      display: string;
      start_url: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(manifest.name).toBe("Itinero");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const response = await page.request.get(new URL(icon.src, online.url).href);
      expect(response.headers()["content-type"]).toBe("image/png");
    }
    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    expect((await page.request.get(new URL(touchIcon!, online.url).href)).ok()).toBe(true);
  });

  test("the browser is asked to keep what Itinero stores, once on each device", async ({ context }) => {
    await context.addInitScript(() => {
      const asked = { count: 0 };
      Object.assign(window, { persistAsked: asked });
      if (navigator.storage) {
        const original = navigator.storage.persist?.bind(navigator.storage);
        navigator.storage.persist = () => {
          asked.count++;
          return original ? original() : Promise.resolve(false);
        };
      }
    });
    const first = await open(context, online.url);
    expect(await first.evaluate(() => (window as unknown as { persistAsked: { count: number } }).persistAsked.count)).toBe(1);
    const second = await open(context, online.url);
    expect(await second.evaluate(() => (window as unknown as { persistAsked: { count: number } }).persistAsked.count)).toBe(0);
  });

  test("an iPhone in Safari is told how to add Itinero, and why", async ({ browser }) => {
    const iphone = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
    const page = await open(iphone, online.url);
    const notice = page.locator('[data-shell="suggest-install"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Share");
    await expect(notice).toContainText("Add to Home Screen");
    await expect(notice).toContainText("stay on this phone");
    // Nothing is wider than an upright phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    // Opened from the home screen, Safari sets navigator.standalone, and the notice is gone.
    await iphone.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
    const standalone = await open(iphone, online.url);
    await expect(standalone.locator('[data-shell="suggest-install"]')).toHaveCount(0);
    await iphone.close();
  });

  test("a computer is not told to add Itinero to a home screen", async ({ context }) => {
    const page = await open(context, online.url);
    await expect(page.locator('[data-shell="suggest-install"]')).toHaveCount(0);
  });
});

test.describe("WEB:SHELL-F4 — the newest time-zone rules are loaded before any time is shown", () => {
  test("a new version opened with no connection loads the rules it was built with", async ({ context }) => {
    await openReady(context, online.url);
    await setOnline(context, online, false);
    await closeAll(context);
    const page = await open(context, online.url);
    await expect(page.locator('[data-shell="rules-version"]')).toHaveText("2026f");
  });

  test("newer rules published without a new version are loaded once online, and kept offline", async ({ context }) => {
    const page = await openReady(context, online.url);
    online.publishRules(newerRules("2099a"));
    await connected(page);
    await expect(page.locator('[data-shell="rules-version"]')).toHaveText("2099a");
    expect(await running(page)).toBe(versionOf("one"));

    await setOnline(context, online, false);
    await closeAll(context);
    const reopened = await open(context, online.url);
    await expect(reopened.locator('[data-shell="rules-version"]')).toHaveText("2099a");
  });

  test("older rules fetched are not taken", async ({ context }) => {
    const page = await openReady(context, online.url);
    online.publishRules(newerRules("2001a"));
    await connected(page);
    await page.waitForTimeout(500);
    await expect(page.locator('[data-shell="rules-version"]')).toHaveText("2026f");
  });

  test("the rules fetched outlive a new version", async ({ context }) => {
    const page = await openReady(context, online.url);
    online.publishRules(newerRules("2099a"));
    await connected(page);
    await expect(page.locator('[data-shell="rules-version"]')).toHaveText("2099a");
    online.publish(versionDir("two"));
    await untilUpdateWaiting(page);
    await closeAll(context);
    await setOnline(context, online, false);
    const reopened = await open(context, online.url);
    expect(await running(reopened)).toBe(versionOf("two"));
    await expect(reopened.locator('[data-shell="rules-version"]')).toHaveText("2099a");
  });

  test("a kept rules file trip-time refuses is deleted, and the version's own is loaded", async ({ context }) => {
    const page = await openReady(context, online.url);
    await page.evaluate(async () => {
      const cache = await caches.open("itinero-rules");
      await cache.put(
        "/time-zone-rules.json",
        new Response('{"version":"2099z","zones":"broken"}', { headers: { "Itinero-Rules-Release": "2099z" } }),
      );
    });
    await setOnline(context, online, false);
    await closeAll(context);
    const reopened = await open(context, online.url);
    await expect(reopened.locator('[data-shell="rules-version"]')).toHaveText("2026f");
    expect(await reopened.evaluate(async () => !!(await (await caches.open("itinero-rules")).match("/time-zone-rules.json")))).toBe(false);
  });
});

test.describe("WEB:SHELL-F5 — a version too old for the online side says so, and updates when asked", () => {
  test("the notice shows without losing typed text, and Update now starts the new version in every window", async ({
    context,
  }) => {
    const first = await openReady(context, online.url);
    expect(await reachOnline(first)).toBe(200);

    // A traveller is writing. The editor stands in for web/screens' page editor.
    await first.evaluate(() => {
      const editor = document.createElement("textarea");
      editor.id = "editor";
      document.querySelector("main")!.append(editor);
      Object.assign(window, { notReloaded: true });
    });
    await first.locator("#editor").fill("Half a page about Torres del Paine");

    online.publish(versionDir("three"), 2);
    expect(await reachOnline(first)).toBe(426);
    const notice = first.locator('[data-shell="update-required"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("reloads every window");
    await expect(first.locator("#editor")).toHaveValue("Half a page about Torres del Paine");
    expect(await first.evaluate(() => "notReloaded" in window)).toBe(true);

    // The new version is fetched, and the traveller starts it.
    await expect(notice.getByRole("button", { name: "Update now" })).toBeVisible({ timeout: 20_000 });
    const second = await open(context, online.url);
    expect(await running(second)).toBe(versionOf("one"));

    await Promise.all([
      first.waitForEvent("load"),
      second.waitForEvent("load"),
      notice.getByRole("button", { name: "Update now" }).click(),
    ]);
    for (const page of [first, second]) {
      await expect(page.locator('[data-shell="version"]')).toHaveText(versionOf("three"));
      await expect(page.locator('[data-shell="update-required"]')).toHaveCount(0);
    }
    expect(await reachOnline(first)).toBe(200);
  });

  test("Update now does nothing until the new version is held", async ({ context }) => {
    const page = await openReady(context, online.url);
    await page.evaluate(() => {
      Object.assign(window, { notReloaded: true });
      window.itineroShell.applyUpdate();
    });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => "notReloaded" in window)).toBe(true);
    expect((await shellState(page)).updateWaiting).toBe(false);
  });
});

test.describe("WEB:SHELL-F6 — a new version waiting says so, and starts when the traveller asks", () => {
  test("every open window says so without taking the focus, and Update now starts it in every window", async ({
    context,
  }) => {
    const first = await openReady(context, online.url);
    const second = await open(context, online.url);

    // A traveller is writing. The editor stands in for web/screens' page editor.
    await first.evaluate(() => {
      const editor = document.createElement("textarea");
      editor.id = "editor";
      document.querySelector("main")!.append(editor);
      Object.assign(window, { notReloaded: true });
    });
    await first.locator("#editor").fill("Half a page about Torres del Paine");

    online.publish(versionDir("two"));
    await untilUpdateWaiting(first);
    for (const page of [first, second]) {
      const notice = page.locator('[data-shell="update-waiting"]');
      await expect(notice).toBeVisible();
      await expect(notice).toHaveAttribute("role", "status");
      await expect(notice).toContainText("once every window of Itinero is closed");
      await expect(notice).toContainText("reloads every window");
    }
    await expect(first.locator("#editor")).toBeFocused();
    await expect(first.locator("#editor")).toHaveValue("Half a page about Torres del Paine");
    expect(await first.evaluate(() => "notReloaded" in window)).toBe(true);
    expect(await running(first)).toBe(versionOf("one"));

    await Promise.all([
      first.waitForEvent("load"),
      second.waitForEvent("load"),
      first.locator('[data-shell="update-waiting"]').getByRole("button", { name: "Update now" }).click(),
    ]);
    for (const page of [first, second]) {
      await expect(page.locator('[data-shell="version"]')).toHaveText(versionOf("two"));
      await expect(page.locator('[data-shell="update-waiting"]')).toHaveCount(0);
    }
  });

  test("Later puts the notice away until the window reloads", async ({ context }) => {
    const page = await openReady(context, online.url);
    online.publish(versionDir("two"));
    await untilUpdateWaiting(page);
    const notice = page.locator('[data-shell="update-waiting"]');
    await notice.getByRole("button", { name: "Later" }).click();
    await expect(notice).toHaveCount(0);

    // Moving between screens keeps it away; reloading the window brings it back.
    await page.evaluate(() => {
      history.pushState(null, "", "/settings");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(notice).toHaveCount(0);
    await page.reload();
    expect(await running(page)).toBe(versionOf("one"));
    await untilUpdateWaiting(page);
    await expect(notice).toBeVisible();
  });

  test("a version too old shows only its own notice", async ({ context }) => {
    const page = await openReady(context, online.url);
    online.publish(versionDir("three"), 2);
    expect(await reachOnline(page)).toBe(426);
    await untilUpdateWaiting(page);
    await expect(page.locator('[data-shell="update-required"]')).toBeVisible();
    await expect(page.locator('[data-shell="update-waiting"]')).toHaveCount(0);
  });
});
