// seen (spec §4.5), what a traveller and their phone may hold, and widens (§4.6), the travellers
// a move would let see a page.

import { forPhone, type Pages } from "@itinero/pages";
import { readGrants } from "./form.ts";
import { calendarLevel, grantOf, levelIn, Tree } from "./levels.ts";
import type { Grants, Id, Seen, Who } from "./types.ts";

export function seen(grants: Grants, who: Who, pages: Pages): Seen {
  const current = readGrants(grants);
  const inTree = forPhone(pages);
  const tree = Tree.of(pages);
  const grant = grantOf(current, who.traveller);
  const kept = who.admin ? inTree.pages : inTree.pages.filter((page) => levelIn(grant, tree, page.id) !== "none");
  return Object.freeze({
    pages: Object.freeze({ trip: inTree.trip, pages: Object.freeze([...kept]) }),
    calendar: calendarLevel(current, who),
  });
}

export function widens(grants: Grants, pages: Pages, page: Id, to: { parent?: Id }): number {
  const current = readGrants(grants);
  const before = Tree.of(pages);
  const after = before.moved(page, to.parent);
  return current.grants.filter((grant) => levelIn(grant, before, page) === "none" && levelIn(grant, after, page) !== "none").length;
}
