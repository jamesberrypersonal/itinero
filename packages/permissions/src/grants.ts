// newGrants and applyGrant (spec §4.1). Every check is made before anything is changed, and a
// refused change leaves the grants passed in as they were.

import type { Pages } from "@itinero/pages";
import { makeGrant, makeGrants, readChange, readGrants } from "./form.ts";
import { grantOf, levelsDown, Tree } from "./levels.ts";
import { attempt, fail, type Grant, type GrantChange, type Grants, type Id, type Result } from "./types.ts";

export function newGrants(trip: Id): Grants {
  return makeGrants(trip, 1, []);
}

function title(pages: Pages, page: Id): string {
  return pages.pages.find((p) => p.id === page)?.title ?? page;
}

export function applyGrant(grants: Grants, pages: Pages, change: GrantChange): Result<Grants> {
  return attempt(() => {
    const current = readGrants(grants);
    const c = readChange(change);
    const held = grantOf(current, c.traveller);
    const others = current.grants.filter((g) => g.traveller !== c.traveller);
    const done = (grant?: Grant) => makeGrants(current.trip, current.revision + 1, grant ? [...others, grant] : others);

    if (c.op === "add") {
      if (held) fail("already-on-trip", "This traveller is on the trip already.");
      return done(makeGrant(c.traveller, c.trip, c.calendar, []));
    }
    if (!held) fail("not-on-trip", "This traveller is not on the trip.");
    switch (c.op) {
      case "remove":
        return done();
      case "trip":
        return done(makeGrant(held.traveller, c.level, held.calendar, held.pages));
      case "calendar":
        return done(makeGrant(held.traveller, held.trip, c.level, held.pages));
      case "unpage":
        return done(makeGrant(held.traveller, held.trip, held.calendar, held.pages.filter((e) => e.page !== c.page)));
      case "page": {
        const tree = Tree.of(pages);
        const path = tree.path(c.page);
        if (!path) fail("unknown-page", "The trip holds no such page.");
        if (c.level !== "none") {
          // The page's level is worked out with the change not yet made. The first page above it
          // whose level is none is the highest, since every page beneath it is none too (§4.2).
          const above = path.slice(0, -1);
          const hidden = above[levelsDown(held, above).indexOf("none")];
          if (hidden !== undefined) {
            fail("hidden-above", `The traveller cannot see "${title(pages, hidden)}", so they cannot be given a page beneath it. Give them access to "${title(pages, hidden)}" first.`, { page: hidden });
          }
        }
        const exceptions = [...held.pages.filter((e) => e.page !== c.page), { page: c.page, level: c.level }];
        return done(makeGrant(held.traveller, held.trip, held.calendar, exceptions));
      }
    }
  });
}
