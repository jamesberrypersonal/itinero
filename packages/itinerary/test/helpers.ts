// Shared by the tests: loading trip-time's rules, building trips, and reading results.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { create, loadRules, type TripTime } from "@itinero/trip-time";
import { apply, newTrip, type Change, type FirmItem, type Result, type Stretch, type Trip, type When } from "../src/index.ts";

const tripTimeRoot = join(dirname(fileURLToPath(import.meta.resolve("@itinero/trip-time"))), "..");

/** Loads the newest rules file of @itinero/trip-time, as a server does. */
export function loadNewestRules(): void {
  const files = readdirSync(join(tripTimeRoot, "rules")).filter((f) => f.endsWith(".json")).sort();
  const loaded = loadRules(readFileSync(join(tripTimeRoot, "rules", files[files.length - 1]!), "utf8"));
  assert.ok(loaded.ok);
}

/** Loads one of trip-time's test fixtures, which differ for Paris. */
export function loadFixture(name: "summer-time.json" | "no-summer-time.json"): void {
  const loaded = loadRules(readFileSync(join(tripTimeRoot, "test", "fixtures", name), "utf8"));
  assert.ok(loaded.ok);
}

export function ok<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`refused: ${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

export function refusal<T>(result: Result<T>) {
  if (result.ok) assert.fail(`accepted: ${JSON.stringify(result.value)}`);
  return result.refusal;
}

export const trip = (): Trip => ok(newTrip("trip-1", "June 2026"));

/** Applies changes in order, each of which must be accepted. */
export function applyAll(start: Trip, ...changes: Change[]): Trip {
  return changes.reduce((t, change) => ok(apply(t, change)), start);
}

export const stretch = (id: string, country: string, first: string, last: string, name?: string, page?: string): Stretch => {
  const s: Stretch = { id, place: name ? { country, name } : { country }, first, last };
  if (page) s.page = page;
  return s;
};

export const pencil = (s: Stretch): Change => ({ op: "pencil", stretch: s });

export const day = (date: string): When => ({ kind: "day", date });
export const time = (fields: TripTime): TripTime => ok(create(fields));
export const exact = (zone: string, date: string, at: string): TripTime => time({ kind: "exact", zone, date, at: { time: at } });

export const item = (id: string, title: string, when: When, extra: Partial<FirmItem> = {}): FirmItem => ({
  id,
  revision: 0,
  title,
  when,
  ...extra,
});

export const addFirm = (i: FirmItem): Change => ({ op: "add-firm", item: i });

export const PARIS = "Europe/Paris";
export const NEW_YORK = "America/New_York";
