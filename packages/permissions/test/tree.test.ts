// Tree tests (spec §4.8): trees of up to a thousand pages, with exceptions at random places, and no
// page of `seen` without its parent (ADR-0012). Each page's level also matches a walk made apart
// from the package, and `widens` matches a count made the same way.

import assert from "node:assert/strict";
import { test } from "node:test";
import { apply, newPages, type Pages } from "@itinero/pages";
import { applyGrant, newGrants, pageLevel, seen, widens, type GrantChange, type Grants, type Level } from "../src/index.ts";
import { ok, random } from "./helpers.ts";

const TRAVELLERS = ["u-1", "u-2", "u-3", "u-4", "u-5"];
const LEVELS: Level[] = ["none", "view", "edit"];

function build(size: number, seed: number): { pages: Pages; grants: Grants } {
  const next = random(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  let pages = ok(newPages("trip-1", []));
  const ids: string[] = [];
  for (let i = 0; i < size; i++) {
    const id = `p${i}`;
    const parent = ids.length === 0 || next() < 0.1 ? undefined : pick(ids);
    pages = ok(apply(pages, { op: "add", id, title: `Page ${i}`, at: parent === undefined ? {} : { parent } })).pages;
    ids.push(id);
  }
  for (let i = 0; i < size / 20; i++) {
    const buried = apply(pages, { op: "bury", id: pick(ids) });
    if (buried.ok) pages = buried.value.pages;
  }
  let grants = newGrants("trip-1");
  for (const traveller of TRAVELLERS) {
    grants = ok(applyGrant(grants, pages, { op: "add", traveller, trip: pick(["view", "edit"] as const), calendar: "none" }));
  }
  for (let i = 0; i < size / 5; i++) {
    const change: GrantChange = { op: "page", traveller: pick(TRAVELLERS), page: pick(ids), level: pick(LEVELS) };
    const result = applyGrant(grants, pages, change);
    if (result.ok) grants = result.value;
    else assert.equal(result.refusal.code, "hidden-above");
  }
  return { pages, grants };
}

/** A traveller's level for a page, by a walk made apart from the package. */
function walked(grants: Grants, pages: Pages, traveller: string, id: string, parentOf = (p: string) => pages.pages.find((x) => x.id === p)!.parent): Level {
  const grant = grants.grants.find((g) => g.traveller === traveller)!;
  const path: string[] = [];
  for (let at: string | undefined = id; at !== undefined; at = parentOf(at)) path.unshift(at);
  let level: Level = grant.trip;
  for (const page of path) {
    if (level === "none") return "none";
    level = grant.pages.find((e) => e.page === page)?.level ?? level;
  }
  return level;
}

for (const [size, seed] of [[10, 1], [100, 2], [300, 3], [1000, 4]] as const) {
  test(`a tree of ${size} pages: no page of seen lacks its parent, and every level matches the walk`, () => {
    const { pages, grants } = build(size, seed);
    for (const traveller of TRAVELLERS) {
      const who = { traveller, admin: false };
      const kept = new Set(seen(grants, who, pages).pages.pages.map((p) => p.id));
      for (const page of seen(grants, who, pages).pages.pages) {
        if (page.parent !== undefined) assert.ok(kept.has(page.parent), `${page.id} without its parent ${page.parent}`);
        assert.ok(page.buried === undefined);
      }
      for (const page of pages.pages) assert.equal(pageLevel(grants, who, pages, page.id), walked(grants, pages, traveller, page.id), page.id);
    }
  });
}

test("widens matches a count made apart from the package, on a tree of 300 pages", () => {
  const { pages, grants } = build(300, 5);
  const next = random(6);
  const ids = pages.pages.map((p) => p.id);
  for (let i = 0; i < 50; i++) {
    const page = ids[Math.floor(next() * ids.length)]!;
    const parent = next() < 0.2 ? undefined : ids[Math.floor(next() * ids.length)]!;
    const beneath = (p: string | undefined): boolean => p !== undefined && (p === page || beneath(pages.pages.find((x) => x.id === p)!.parent));
    if (beneath(parent)) continue;
    const moved = (p: string) => (p === page ? parent : pages.pages.find((x) => x.id === p)!.parent);
    const expected = TRAVELLERS.filter((t) => walked(grants, pages, t, page) === "none" && walked(grants, pages, t, page, moved) !== "none").length;
    assert.equal(widens(grants, pages, page, parent === undefined ? {} : { parent }), expected);
  }
});
