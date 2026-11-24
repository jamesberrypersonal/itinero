// The order of a traveller's checklists (spec §4.5). An order is one or more of the 62 characters
// 0–9, A–Z and a–z, in that order, and never ends in 0. Comparing code unit by code unit sorts them
// in that order, and between any two there is always another. The form and the choice are those
// docs/spec/planner/pages.md §4.3 gives the pages under one parent.

import { fields, text } from "./checks.ts";
import { attempt, fail, type Change, type Id, type List, type Placed, type Result } from "./types.ts";

export const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const ORDER = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

/** The smallest valid order of exactly `length` characters that sorts after `low`, or undefined. */
function smallestAfter(low: string | undefined, length: number): string | undefined {
  if (low === undefined) return "0".repeat(length - 1) + "1";
  if (low.length < length) return low + "0".repeat(length - low.length - 1) + "1";
  const digits = [...low.slice(0, length)].map((c) => DIGITS.indexOf(c));
  let at = length - 1;
  while (at >= 0 && digits[at] === 61) digits[at--] = 0;
  if (at < 0) return undefined;
  digits[at]!++;
  if (digits[length - 1] === 0) digits[length - 1] = 1;
  return digits.map((d) => DIGITS[d]).join("");
}

/** The shortest order that sorts between `low` and `high`, either of which may be absent, taking the lower of equally short ones. */
export function between(low: string | undefined, high: string | undefined): string {
  if (low !== undefined && high !== undefined && !(low < high)) {
    // Neighbours with equal orders, told apart by identifier: any order after the lower one will do.
    high = undefined;
  }
  for (let length = 1; ; length++) {
    const candidate = smallestAfter(low, length);
    if (candidate !== undefined && (high === undefined || candidate < high)) return candidate;
  }
}

function compare(a: Placed, b: Placed): number {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Checks a list holds identifiers and orders, and gives it sorted. */
export function readList<T extends Placed>(list: readonly T[]): T[] {
  if (!Array.isArray(list)) fail("malformed", "The list is not a list.");
  for (const entry of list) {
    const r = fields(entry, "list's checklist", ["id", "order"], [], true);
    text(r.id, "list's identifier");
    text(r.order, "list's order");
  }
  return [...list].sort(compare);
}

export function ordered<T extends Placed>(list: readonly T[]): readonly T[] {
  return Object.freeze(readList(list));
}

/** The order of a checklist put after every one of the list (§4.1, §4.3). */
export function last(list: List): string {
  return between(readList(list).at(-1)?.order, undefined);
}

export function placeAfter(list: List, id: Id, after?: Id): Result<Change> {
  return attempt((): Change => {
    const sorted = readList(list);
    const moving = sorted.find((c) => c.id === id);
    if (!moving) fail("unknown-checklist", `The list holds no checklist ${JSON.stringify(id)}.`);
    if (after !== undefined && !sorted.some((c) => c.id === after)) {
      fail("unknown-checklist", `The list holds no checklist ${JSON.stringify(after)}.`);
    }
    let order: string;
    if (after === id) {
      order = moving.order;
    } else {
      const others = sorted.filter((c) => c.id !== id);
      if (after === undefined) {
        order = between(undefined, others[0]?.order);
      } else {
        const at = others.findIndex((c) => c.id === after);
        order = between(others[at]!.order, others[at + 1]?.order);
      }
    }
    return Object.freeze({ op: "place", checklist: id, order });
  });
}
