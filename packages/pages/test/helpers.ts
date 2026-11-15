// Shared by the tests: building pages, applying changes, and reading results.

import assert from "node:assert/strict";
import { apply, newPages, tree, type Branch, type Change, type Pages, type Result } from "../src/index.ts";

export function ok<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`refused: ${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

export function refusal<T>(result: Result<T>) {
  if (result.ok) assert.fail(`accepted: ${JSON.stringify(result.value)}`);
  return result.refusal;
}

export const empty = (): Pages => ok(newPages("trip-1", []));

/** Applies changes in order, each of which must be accepted. */
export function applyAll(start: Pages, ...changes: Change[]): Pages {
  return changes.reduce((p, change) => ok(apply(p, change)).pages, start);
}

/** The trip PLN:PAGES-F1's verification sets up: Chile, Santiago under it, and Eating in Santiago under that. */
export function chile(text = ""): Pages {
  return applyAll(
    empty(),
    { op: "add", id: "chile", title: "Chile", at: {} },
    { op: "add", id: "santiago", title: "Santiago", at: { parent: "chile" } },
    { op: "add", id: "eating", title: "Eating in Santiago", text, at: { parent: "santiago" } },
  );
}

/** The tree as nested titles, such as ["Chile", ["Santiago", ["Eating in Santiago"]]]. */
export function shape(pages: Pages): unknown[] {
  const of = (branches: readonly Branch[]): unknown[] =>
    branches.flatMap((b) => (b.under.length === 0 ? [b.page.title] : [b.page.title, of(b.under)]));
  return of(tree(pages));
}
