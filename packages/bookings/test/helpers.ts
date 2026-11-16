// Shared by the tests: loading trip-time's rules, making times, and reading results.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { create, loadRules, type TripTime } from "@itinero/trip-time";
import type { ActivityBooking, Airport, Details, FlightBooking, JourneyBooking, Leg, Result, StayBooking } from "../src/index.ts";

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

export const SANTIAGO = "America/Santiago";
export const PUNTA_ARENAS = "America/Punta_Arenas";
export const MADRID = "Europe/Madrid";
export const SAO_PAULO = "America/Sao_Paulo";
export const MENDOZA = "America/Argentina/Mendoza";

export const time = (fields: TripTime): TripTime => ok(create(fields));
export const exact = (zone: string, date: string, at: string): TripTime => time({ kind: "exact", zone, date, at: { time: at } });
export const approx = (zone: string, date: string, at: string): TripTime => time({ kind: "approx", zone, date, at: { time: at } });
export const date = (zone: string, on: string): TripTime => time({ kind: "date", zone, date: on });
export const tbd = (zone: string, on: string): TripTime => time({ kind: "tbd", zone, date: on });
export const window = (zone: string, on: string, from: string, to: string, endDate = on): TripTime =>
  time({ kind: "window", zone, date: on, from: { time: from }, endDate, to: { time: to } });

/** A date in December 2026, when every example of the specifications happens. */
export const december = (d: number) => `2026-12-${String(d).padStart(2, "0")}`;

export const PARIS = "Europe/Paris";
export const NEW_YORK = "America/New_York";

/** The fields every booking has, as a caller gives them. */
export const common = (id: string, travellers: string[] = ["acct-1"], details: Details = {}) => ({ id, revision: 0, travellers, details });

export const airport = (code: string, name?: string): Airport => (name === undefined ? { code } : { code, name });

export const leg = (flight: string, from: Airport, leaves: TripTime, to: Airport, arrives: TripTime): Leg => ({ flight, from, to, leaves, arrives });

export const flight = (id: string, legs: Leg[], extra: Partial<FlightBooking> = {}): FlightBooking => ({
  ...common(id),
  kind: "flight",
  legs,
  seats: [],
  ...extra,
});

/** LA 800 from Santiago at 07:05 on 6 December to Punta Arenas at 10:30, as BKG:FLIGHT-F1 gives it. */
export const la800 = (id = "la800", extra: Partial<FlightBooking> = {}): FlightBooking =>
  flight(
    id,
    [leg("LA 800", airport("SCL", "Santiago"), exact(SANTIAGO, december(6), "07:05"), airport("PUQ", "Punta Arenas"), exact(PUNTA_ARENAS, december(6), "10:30"))],
    extra,
  );

export const stay = (id: string, name: string, checkIn: TripTime, checkOut: TripTime, extra: Partial<StayBooking> = {}): StayBooking => ({
  ...common(id),
  kind: "stay",
  name,
  checkIn,
  checkOut,
  ...extra,
});

/** Hostal Lady Florence, from 9 to 12 December, in Punta Arenas time, as BKG:STAY-F1 gives it. */
export const ladyFlorence = (id = "5d1a", extra: Partial<StayBooking> = {}): StayBooking =>
  stay(id, "Hostal Lady Florence", date(PUNTA_ARENAS, december(9)), date(PUNTA_ARENAS, december(12)), extra);

export const journey = (id: string, by: JourneyBooking["by"], from: string, to: string, leaves: TripTime, extra: Partial<JourneyBooking> = {}): JourneyBooking => ({
  ...common(id),
  kind: "journey",
  by,
  from,
  to,
  leaves,
  ...extra,
});

/** The bus from Punta Arenas to Puerto Natales, leaving at 13:00 on 9 December and arriving at 16:00, as BKG:JOURNEY-F1 gives it. */
export const busToNatales = (id = "bus", extra: Partial<JourneyBooking> = {}): JourneyBooking =>
  journey(id, "bus", "Punta Arenas", "Puerto Natales", exact(PUNTA_ARENAS, december(9), "13:00"), {
    arrives: exact(PUNTA_ARENAS, december(9), "16:00"),
    ...extra,
  });

export const activity = (id: string, sort: ActivityBooking["sort"], title: string, starts: TripTime, extra: Partial<ActivityBooking> = {}): ActivityBooking => ({
  ...common(id),
  kind: "activity",
  sort,
  title,
  starts,
  ...extra,
});

/** The tour of BKG:ACTIVITY-F1: Torres del Paine full day, from 07:30 to 19:00 on 10 December. */
export const torresDelPaine = (id = "tdp", extra: Partial<ActivityBooking> = {}): ActivityBooking =>
  activity(id, "tour", "Torres del Paine full day", exact(PUNTA_ARENAS, december(10), "07:30"), {
    ends: exact(PUNTA_ARENAS, december(10), "19:00"),
    ...extra,
  });
