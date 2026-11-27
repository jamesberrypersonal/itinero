// A trip host that wakes with no time-zone rules loaded (docs/spec/planner/trip-host.md §4.1). The
// rules are the isolate's, and this file runs in an isolate of its own, so nothing has loaded them
// when it starts. A stored trip holding an item at a time can only be read with the rules, so every
// request, the list of trips and a catch-up included, needs them from the first.

import { changeToText as calendarChange } from "@itinero/itinerary";
import { create, rulesVersion } from "@itinero/trip-time";
import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { api, json, signIn } from "./helpers.ts";

describe("the trip host loads the time-zone rules as it starts", () => {
  test("a trip host loads them before its first request", async () => {
    expect(rulesVersion()).toBeUndefined();
    const stub = env.TRIPS.get(env.TRIPS.idFromName("woken"));
    expect(await runInDurableObject(stub, () => rulesVersion())).toBeDefined();
  });

  test("a trip holding an item at a time is listed, and caught up", async () => {
    const by = await signIn({ sub: "wake-1", email: "wake@example.com", name: "Wake", emailVerified: true });
    const made = await api("/api/trips", {
      method: "POST",
      session: by.session,
      body: { name: "Costa Rica", first: "2026-12-01", last: "2026-12-10", countries: ["CR"] },
    });
    expect(made.status).toBe(201);
    const { trip } = await json<{ trip: string }>(made);
    const when = create({ kind: "exact", zone: "America/Costa_Rica", date: "2026-12-05", at: { time: "09:00" } });
    if (!when.ok) throw new Error(when.refusal.message);
    const change = calendarChange({ op: "add-firm", item: { id: "tour", revision: 0, title: "Tour", when: when.value } });
    const changed = await api(`/api/trips/${trip}/changes`, { method: "POST", session: by.session, body: { target: "calendar", change } });
    expect(changed.status).toBe(200);

    const listed = await api("/api/trips", { session: by.session });
    expect(listed.status).toBe(200);
    expect((await json<{ trips: { trip: string; name: string }[] }>(listed)).trips).toEqual([
      { trip, name: "Costa Rica", dates: { first: "2026-12-01", last: "2026-12-10" } },
    ]);
    const synced = await api(`/api/trips/${trip}/sync`, { method: "POST", session: by.session, body: { holdsCalendar: false } });
    expect(synced.status).toBe(200);
  });
});
