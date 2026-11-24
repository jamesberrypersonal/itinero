// Shared by the tests: building checklists, applying changes, and reading results.

import assert from "node:assert/strict";
import { apply, newChecklist, type Change, type Checklist, type Result } from "../src/index.ts";

export function ok<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`refused: ${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

export function refusal<T>(result: Result<T>) {
  if (result.ok) assert.fail(`accepted: ${JSON.stringify(result.value)}`);
  return result.refusal;
}

/** Applies changes in order, each of which must be accepted. */
export function applyAll(start: Checklist, ...changes: Change[]): Checklist {
  return changes.reduce((c, change) => ok(apply(c, change)), start);
}

/** Adds items in order, each after the last. */
export function withItems(start: Checklist, ...texts: string[]): Checklist {
  let after: string | undefined;
  return texts.reduce((c, text, n) => {
    const item = `i${n + 1}`;
    const change: Change = { op: "add", checklist: c.id, item, text };
    if (after !== undefined) change.after = after;
    after = item;
    return ok(apply(c, change));
  }, start);
}

export const OWNER = "u-traveller";
export const TRIP = "trip-chile";

/** The template Before leaving, with the items PLN:CHECKLISTS-F1's verification starts from. */
export function beforeLeaving(): Checklist {
  return withItems(ok(newChecklist("before", OWNER, "Before leaving", [])), "Passport valid for six months", "Copies of documents", "Travel insurance");
}

/** The same three items, in a checklist on a trip. */
export function onTrip(): Checklist {
  return withItems(ok(newChecklist("trip-before", OWNER, "Before leaving", [], TRIP)), "Passport valid for six months", "Copies of documents", "Travel insurance");
}

export const texts = (c: Checklist): string[] => c.items.map((i) => i.text);
