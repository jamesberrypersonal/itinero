// A traveller's level for a page (spec §4.2), for the calendar and for a booking (§4.3).

import type { Pages } from "@itinero/pages";
import type { Grant, Grants, Id, Level, Who } from "./types.ts";

/** The grant the grants hold for a traveller, if any. */
export function grantOf(grants: Grants, traveller: Id): Grant | undefined {
  return grants.grants.find((g) => g.traveller === traveller);
}

/** Each page's parent, from the pages' own records. A page in the graveyard keeps its parent. */
export class Tree {
  private readonly parents: ReadonlyMap<Id, Id | undefined>;

  constructor(parents: ReadonlyMap<Id, Id | undefined>) {
    this.parents = parents;
  }

  static of(pages: Pages): Tree {
    return new Tree(new Map(pages.pages.map((page) => [page.id, page.parent])));
  }

  has(page: Id): boolean {
    return this.parents.has(page);
  }

  /**
   * The pages from the top of the trip down to the page, the page last. Undefined for a page the
   * trip does not hold, or one whose pages above are missing or form a loop, so that it fails closed.
   */
  path(page: Id): Id[] | undefined {
    const path: Id[] = [];
    const seen = new Set<Id>();
    let at: Id | undefined = page;
    while (at !== undefined) {
      if (!this.parents.has(at) || seen.has(at)) return undefined;
      seen.add(at);
      path.push(at);
      at = this.parents.get(at);
    }
    return path.reverse();
  }

  /** A copy with one page moved under a new parent, or to the top. */
  moved(page: Id, parent: Id | undefined): Tree {
    return new Tree(new Map(this.parents).set(page, parent));
  }
}

/** A traveller's level at each page of a path, worked down from their access to the trip. */
export function levelsDown(grant: Grant, path: readonly Id[]): Level[] {
  const exceptions = new Map(grant.pages.map((e) => [e.page, e.level]));
  const levels: Level[] = [];
  let level: Level = grant.trip;
  for (const page of path) {
    if (level !== "none") level = exceptions.get(page) ?? level;
    levels.push(level);
  }
  return levels;
}

/** The level of a grant for a page, by one walk from the top of the trip to the page. */
export function levelIn(grant: Grant | undefined, tree: Tree, page: Id): Level {
  const path = tree.path(page);
  if (!grant || !path) return "none";
  return levelsDown(grant, path).at(-1) ?? "none";
}

export function pageLevel(grants: Grants, who: Who, pages: Pages, page: Id): Level {
  if (who.admin) return "edit";
  return levelIn(grantOf(grants, who.traveller), Tree.of(pages), page);
}

export function calendarLevel(grants: Grants, who: Who): Level {
  if (who.admin) return "edit";
  return grantOf(grants, who.traveller)?.calendar ?? "none";
}

export function bookingLevel(grants: Grants, who: Who, travellers: readonly Id[]): Level {
  if (who.admin) return "edit";
  const grant = grantOf(grants, who.traveller);
  return grant && travellers.includes(who.traveller) ? grant.trip : "none";
}
