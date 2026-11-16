// Shared by the tests: building a trip's pages and grants, and reading results.

import assert from "node:assert/strict";
import { apply, newPages, type Change, type Pages } from "@itinero/pages";
import { applyGrant, newGrants, type GrantChange, type Grants, type Result, type Who } from "../src/index.ts";

export function ok<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`refused: ${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

export function refusal<T>(result: Result<T>) {
  if (result.ok) assert.fail(`accepted: ${JSON.stringify(result.value)}`);
  return result.refusal;
}

/** Applies page changes in order, each of which must be accepted. */
export function pagesWith(start: Pages, ...changes: Change[]): Pages {
  return changes.reduce((p, change) => ok(apply(p, change)).pages, start);
}

export const noPages = (): Pages => ok(newPages("trip-1", []));

/** The trip ACC:PERMISSIONS-F1's verification sets up: Chile, Santiago under it, and Eating in Santiago under that. */
export function chile(): Pages {
  return pagesWith(
    noPages(),
    { op: "add", id: "chile", title: "Chile", at: {} },
    { op: "add", id: "santiago", title: "Santiago", at: { parent: "chile" } },
    { op: "add", id: "eating", title: "Eating in Santiago", at: { parent: "santiago" } },
  );
}

/** Applies grant changes in order, each of which must be accepted. */
export function grantsWith(start: Grants, pages: Pages, ...changes: GrantChange[]): Grants {
  return changes.reduce((g, change) => ok(applyGrant(g, pages, change)), start);
}

export const ADMIN = "u-admin";
export const SAM = "u-sam";
export const ANA = "u-ana";

export const admin: Who = { traveller: ADMIN, admin: true };
export const sam: Who = { traveller: SAM, admin: false };
export const ana: Who = { traveller: ANA, admin: false };

/** A trip's grants with its admin, who has edit access, and Sam, with view access to the trip. */
export function samViews(pages: Pages = chile()): Grants {
  return grantsWith(
    newGrants("trip-1"),
    pages,
    { op: "add", traveller: ADMIN, trip: "edit", calendar: "edit" },
    { op: "add", traveller: SAM, trip: "view", calendar: "none" },
  );
}

/** A small random number generator, so that the tree tests are the same on every run. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
