// Shared by the tests: loading the rules, and building values that must be accepted.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { create, loadRules, type Result, type TripTime } from "../src/index.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The newest rules file in rules/, the one a server loads (spec §4.10). */
export function newestRulesFile(): { name: string; text: string } {
  const files = readdirSync(join(packageRoot, "rules")).filter((f) => f.endsWith(".json")).sort();
  const name = files[files.length - 1];
  assert.ok(name, "rules/ holds no rules file");
  return { name, text: readFileSync(join(packageRoot, "rules", name), "utf8") };
}

export function loadNewestRules(): string {
  const { text } = newestRulesFile();
  const loaded = loadRules(text);
  assert.ok(loaded.ok, "the newest rules file loads");
  return loaded.value.version;
}

export function loadFixture(name: string): void {
  const loaded = loadRules(readFileSync(join(packageRoot, "test", "fixtures", name), "utf8"));
  assert.ok(loaded.ok, `the fixture ${name} loads`);
}

export function ok<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`refused: ${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

export function refusal<T>(result: Result<T>) {
  if (result.ok) assert.fail(`accepted: ${JSON.stringify(result.value)}`);
  return result.refusal;
}

export const PARIS = "Europe/Paris";
export const NEW_YORK = "America/New_York";
export const TOKYO = "Asia/Tokyo";

export const exact = (zone: string, date: string, time: string, second?: true): TripTime =>
  ok(create({ kind: "exact", zone, date, at: second ? { time, second } : { time } }));
export const wholeDate = (zone: string, date: string): TripTime => ok(create({ kind: "date", zone, date }));
export const tbd = (zone: string, date: string): TripTime => ok(create({ kind: "tbd", zone, date }));
export const part = (zone: string, date: string, p: "morning" | "afternoon" | "evening" | "night"): TripTime =>
  ok(create({ kind: "part", zone, date, part: p }));
export const approx = (zone: string, date: string, time: string): TripTime =>
  ok(create({ kind: "approx", zone, date, at: { time } }));
export const windowOf = (zone: string, date: string, from: string, to: string, endDate = date): TripTime =>
  ok(create({ kind: "window", zone, date, from: { time: from }, endDate, to: { time: to } }));
