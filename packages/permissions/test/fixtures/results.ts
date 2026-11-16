// Prints, as JSON, the results of the checks of ACC:PERMISSIONS-F1 and ACC:PERMISSIONS-F5 on a
// trip of 300 pages. independence.test.ts runs it under two languages and two time zones.

import { apply, newPages, type Pages } from "@itinero/pages";
import { applyGrant, authorise, grantsToText, newGrants, pageLevel, seen, widens, type Grants } from "../../src/index.ts";
import { ok, random } from "../helpers.ts";

const next = random(7);
let pages: Pages = ok(newPages("trip-1", []));
for (let i = 0; i < 300; i++) {
  const parent = i === 0 || next() < 0.1 ? undefined : `p${Math.floor(next() * i)}`;
  pages = ok(apply(pages, { op: "add", id: `p${i}`, title: `Página ${i} İ`, at: parent === undefined ? {} : { parent } })).pages;
}
let grants: Grants = newGrants("trip-1");
const travellers = ["u-İstanbul", "u-istanbul", "u-Ana", "u-ana"];
for (const traveller of travellers) grants = ok(applyGrant(grants, pages, { op: "add", traveller, trip: "view", calendar: "none" }));
for (let i = 0; i < 60; i++) {
  const r = applyGrant(grants, pages, { op: "page", traveller: travellers[i % 4]!, page: `p${Math.floor(next() * 300)}`, level: (["none", "view", "edit"] as const)[i % 3]! });
  if (r.ok) grants = r.value;
}
const results = travellers.map((traveller) => {
  const who = { traveller, admin: false };
  return {
    levels: pages.pages.map((p) => pageLevel(grants, who, pages, p.id)),
    seen: seen(grants, who, pages).pages.pages.map((p) => p.id),
    rename: authorise(grants, who, pages, { kind: "change-page", change: { op: "rename", id: "p5", title: "X" } }).ok,
  };
});
console.log(JSON.stringify({ text: grantsToText(grants), results, widens: widens(grants, pages, "p9", {}) }));
