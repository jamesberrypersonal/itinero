// WEB:SHELL-NFR1 on the machine running the tests (docs/spec/web/shell.md §4.5): with every file
// already on the device and no connection, the shell is ready within 300 milliseconds of opening,
// each of ten times. The check on a phone at least four years old is made by hand before each
// release.

import { expect, test } from "@playwright/test";
import { closeAll, setOnline, open, openReady } from "./helpers.ts";
import { startOnline } from "./server.ts";
import { versionDir } from "./versions.ts";

test("WEB:SHELL-NFR1 — the shell is ready within 300 milliseconds of opening, ten times", async ({ context }) => {
  const online = await startOnline(versionDir("one"));
  try {
    await openReady(context, online.url);
    await setOnline(context, online, false);
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      await closeAll(context);
      const page = await open(context, online.url);
      times.push(await page.evaluate(() => performance.getEntriesByName("itinero-shell-ready")[0]!.startTime));
    }
    console.log(`Shell ready after ${times.map((time) => Math.round(time)).join(", ")} ms`);
    for (const time of times) expect(time).toBeLessThan(300);
  } finally {
    await online.close();
  }
});
