// SHR:TRIP-TIME-NFR1 in each engine, with no connection: trip-time, with the rules the shell kept,
// writes, orders and measures times as it does online (docs/requirements/shared/trip-time.md).
// Milestone Planner-1.1 proved each of SHR:TRIP-TIME-F1 to F9 on Node.js. This proves that the
// rules they need reach a device with no connection, through the shell. The check on a phone is
// made by hand.

import { expect, test } from "@playwright/test";
import { closeAll, setOnline, connected, newerRules, open, openReady } from "./helpers.ts";
import { startOnline } from "./server.ts";
import { versionDir } from "./versions.ts";

/** A flight from Santiago to Madrid, written, ordered and measured in the window. */
async function flight(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const t = window.itineroTripTime;
    const leaves = t.create({ kind: "exact", zone: "America/Santiago", date: "2026-11-20", at: { time: "23:40" } });
    const arrives = t.create({ kind: "exact", zone: "Europe/Madrid", date: "2026-11-21", at: { time: "16:35" } });
    if (!leaves.ok || !arrives.ok) throw new Error("the flight's times were refused");
    const span = t.span(leaves.value, arrives.value);
    if (!span.ok) throw new Error("the flight's span was refused");
    const skipped = t.create({ kind: "exact", zone: "America/Santiago", date: "2026-09-06", at: { time: "00:30" } });
    const parsed = t.parse(t.toText(leaves.value));
    return {
      leaves: t.format(leaves.value, { clock: "24h", dateOrder: "day-first" }),
      arrives: t.format(arrives.value, { clock: "12h", dateOrder: "month-first" }),
      order: t.sort([arrives.value, leaves.value]).map((value) => value.zone),
      takes: t.formatDuration(t.duration(span.value)),
      skipped: skipped.ok ? "accepted" : skipped.refusal.code,
      roundTrip: parsed.ok && t.compare(parsed.value, leaves.value) === 0,
      rules: t.rulesVersion(),
    };
  });
}

test("SHR:TRIP-TIME-NFR1 — trip-time works with no connection, and takes newer rules once online", async ({ context }) => {
  const online = await startOnline(versionDir("one"));
  try {
    const page = await openReady(context, online.url);
    const withConnection = await flight(page);
    expect(withConnection).toEqual({
      leaves: "Fri 20 November 2026, 23:40, Santiago time",
      arrives: "Sat November 21, 2026, 4:35 pm, Madrid time",
      order: ["America/Santiago", "Europe/Madrid"],
      takes: "12 h 55 min",
      skipped: "skipped-time",
      roundTrip: true,
      rules: "2026f",
    });

    await setOnline(context, online, false);
    await closeAll(context);
    const offline = await open(context, online.url);
    expect(await flight(offline)).toEqual(withConnection);

    // Reconnected after newer rules are published, the device takes them.
    online.publishRules(newerRules("2099a"));
    await setOnline(context, online, true);
    await connected(offline);
    await expect.poll(async () => (await flight(offline)).rules).toBe("2099a");
  } finally {
    await online.close();
  }
});
