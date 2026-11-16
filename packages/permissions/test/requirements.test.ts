// Every check in the verification of each requirement the permissions component claims (spec §4.8,
// §7). The checks of ACC:PERMISSIONS-NFR1 on a server under two languages and time zones are in
// independence.test.ts.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { page as pageOf } from "@itinero/pages";
import {
  applyGrant,
  authorise,
  bookingLevel,
  calendarLevel,
  grantsFromText,
  grantsToText,
  newGrants,
  pageLevel,
  seen,
  widens,
  type GrantChange,
} from "../src/index.ts";
import { ADMIN, admin, ana, ANA, chile, grantsWith, noPages, ok, pagesWith, refusal, SAM, sam, samViews } from "./helpers.ts";

const PAGES = ["chile", "santiago", "eating"];

describe("ACC:PERMISSIONS-F1 — a traveller's level for a page comes from their access to the trip and the exceptions above it", () => {
  const pages = chile();
  const levels = (grants = samViews(pages), who = sam) => PAGES.map((p) => pageLevel(grants, who, pages, p));

  test("with view access to the trip, the traveller's level for all three pages is view", () => {
    assert.deepEqual(levels(), ["view", "view", "view"]);
  });

  test("given edit access to Santiago, their levels read view, edit, edit", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "edit" });
    assert.deepEqual(levels(grants), ["view", "edit", "edit"]);
  });

  test("given no access to Chile, all three read none", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "edit" }, { op: "page", traveller: SAM, page: "chile", level: "none" });
    assert.deepEqual(levels(grants), ["none", "none", "none"]);
  });

  test("an admin's level for every page is edit", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: ADMIN, page: "chile", level: "none" });
    assert.deepEqual(levels(grants, admin), ["edit", "edit", "edit"]);
  });

  test("a page in the graveyard has its level worked out as a page in the tree's", () => {
    const buried = pagesWith(pages, { op: "bury", id: "santiago" });
    const grants = grantsWith(samViews(buried), buried, { op: "page", traveller: SAM, page: "santiago", level: "edit" });
    assert.equal(pageLevel(grants, sam, buried, "eating"), "edit");
  });

  test("a traveller the grants do not hold, and a page the trip does not hold, have level none", () => {
    assert.equal(pageLevel(samViews(pages), ana, pages, "chile"), "none");
    assert.equal(pageLevel(samViews(pages), sam, pages, "peru"), "none");
  });
});

describe("ACC:PERMISSIONS-F2 — a grant beneath a page hidden from the traveller is refused, naming the page", () => {
  const pages = chile();

  test("view access to Eating in Santiago, beneath a Santiago given no access, is refused, naming Santiago", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "none" });
    const refused = refusal(applyGrant(grants, pages, { op: "page", traveller: SAM, page: "eating", level: "view" }));
    assert.equal(refused.code, "hidden-above");
    assert.equal(refused.details?.page, "santiago");
    assert.match(refused.message, /"Santiago"/);
  });

  test("the highest hidden page is named", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "none" }, { op: "page", traveller: SAM, page: "chile", level: "none" });
    assert.equal(refusal(applyGrant(grants, pages, { op: "page", traveller: SAM, page: "eating", level: "edit" })).details?.page, "chile");
  });

  test("removing the exception on Santiago gives view for all three pages again", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "none" }, { op: "unpage", traveller: SAM, page: "santiago" });
    assert.deepEqual(PAGES.map((p) => pageLevel(grants, sam, pages, p)), ["view", "view", "view"]);
  });

  test("setting the traveller's access to the trip to none is refused, with the reason", () => {
    const refused = refusal(applyGrant(samViews(pages), pages, { op: "trip", traveller: SAM, level: "none" } as unknown as GrantChange));
    assert.equal(refused.code, "malformed");
    assert.match(refused.message, /remove them/);
  });

  test("an exception of none beneath a hidden page is never refused for it", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "chile", level: "none" });
    ok(applyGrant(grants, pages, { op: "page", traveller: SAM, page: "eating", level: "none" }));
  });
});

describe("ACC:PERMISSIONS-F3 — the calendar's level is none until an admin grants it, and a booking's follows the travellers it names", () => {
  const pages = chile();
  const grants = grantsWith(newGrants("trip-1"), pages, { op: "add", traveller: ADMIN, trip: "edit", calendar: "edit" }, { op: "add", traveller: SAM, trip: "edit", calendar: "none" }, { op: "add", traveller: ANA, trip: "edit", calendar: "none" });
  const booking = [SAM];

  test("the traveller's level for the calendar is none, and for a booking naming them is edit", () => {
    assert.equal(calendarLevel(grants, sam), "none");
    assert.equal(bookingLevel(grants, sam, booking), "edit");
  });

  test("granted view access to the calendar, it reads view", () => {
    assert.equal(calendarLevel(grantsWith(grants, pages, { op: "calendar", traveller: SAM, level: "view" }), sam), "view");
  });

  test("a second traveller, whom the booking does not name, has level none for it", () => {
    assert.equal(bookingLevel(grants, ana, booking), "none");
  });

  test("an admin has edit for the calendar and the booking", () => {
    assert.equal(calendarLevel(grants, admin), "edit");
    assert.equal(bookingLevel(grants, admin, booking), "edit");
  });
});

describe("ACC:PERMISSIONS-F4 — each request is allowed or refused, with the reason", () => {
  const pages = pagesWith(chile(), { op: "add", id: "peru", title: "Peru", at: {} }, { op: "add", id: "lima", title: "Lima", at: { parent: "peru" } }, { op: "bury", id: "lima" });
  const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "eating", level: "edit" });

  test("reading Santiago as the traveller is allowed", () => {
    assert.equal(ok(authorise(grants, sam, pages, { kind: "read-page", page: "santiago" })), true);
  });

  test("renaming Santiago is refused, because the traveller may only view it", () => {
    const refused = refusal(authorise(grants, sam, pages, { kind: "change-page", change: { op: "rename", id: "santiago", title: "Santiago de Chile" } }));
    assert.equal(refused.code, "no-edit");
    assert.match(refused.message, /only view this page/);
  });

  test("moving a page the traveller may edit under one they may only view is refused, with the reason", () => {
    ok(authorise(grants, sam, pages, { kind: "change-page", change: { op: "write", id: "eating", text: "Empanadas", base: 1 } }));
    const refused = refusal(authorise(grants, sam, pages, { kind: "change-page", change: { op: "move", id: "eating", to: { parent: "chile" } } }));
    assert.equal(refused.code, "no-edit");
    assert.match(refused.message, /the place it is moved to/);
  });

  test("restoring a page in the graveyard, reading one, and making a grant are refused, because only an admin may", () => {
    const requests = [
      { kind: "change-page", change: { op: "restore", id: "lima" } },
      { kind: "read-buried", page: "lima" },
      { kind: "grant", change: { op: "calendar", traveller: SAM, level: "edit" } },
    ] as const;
    for (const request of requests) assert.equal(refusal(authorise(grants, sam, pages, request)).code, "admin-only", request.kind);
  });

  test("each request made as an admin is allowed", () => {
    const requests = [
      { kind: "read-page", page: "santiago" },
      { kind: "change-page", change: { op: "rename", id: "santiago", title: "Santiago de Chile" } },
      { kind: "change-page", change: { op: "move", id: "eating", to: { parent: "chile" } } },
      { kind: "change-page", change: { op: "restore", id: "lima" } },
      { kind: "read-buried", page: "lima" },
      { kind: "grant", change: { op: "calendar", traveller: SAM, level: "edit" } },
      { kind: "read-calendar" },
      { kind: "change-calendar" },
      { kind: "change-booking", travellers: [SAM] },
    ] as const;
    for (const request of requests) ok(authorise(grants, admin, pages, request));
  });
});

describe("ACC:PERMISSIONS-F5 — the permissions component gives what a traveller may see, and what their phone may hold", () => {
  const pages = chile();
  const hidden = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "none" });
  const deleted = pagesWith(pages, { op: "bury", id: "santiago" });

  test("with no access to Santiago, and Santiago then deleted, the pages given are Chile only", () => {
    assert.deepEqual(seen(hidden, sam, deleted).pages.pages.map((p) => p.title), ["Chile"]);
    assert.deepEqual(seen(hidden, sam, pages).pages.pages.map((p) => p.title), ["Chile"]);
  });

  test("the phone's copy holds no calendar until the traveller is granted view access to it", () => {
    assert.equal(seen(hidden, sam, deleted).calendar, "none");
    const granted = grantsWith(hidden, deleted, { op: "calendar", traveller: SAM, level: "view" });
    assert.equal(seen(granted, sam, deleted).calendar, "view");
  });

  test("an admin is given every page of the tree, and never the graveyard", () => {
    assert.deepEqual(seen(hidden, admin, deleted).pages.pages.map((p) => p.id), ["chile"]);
    assert.deepEqual(seen(hidden, admin, pages).pages.pages.map((p) => p.id).sort(), ["chile", "eating", "santiago"]);
  });
});

describe("ACC:PERMISSIONS-F6 — a traveller added to or removed from a trip gains or loses every grant at once", () => {
  const pages = chile();

  test("added with edit access to the trip and view access to the calendar, both levels read back", () => {
    const grants = grantsWith(newGrants("trip-1"), pages, { op: "add", traveller: SAM, trip: "edit", calendar: "view" });
    assert.equal(pageLevel(grants, sam, pages, "chile"), "edit");
    assert.equal(calendarLevel(grants, sam), "view");
  });

  test("given an exception, then removed, their level for every page, the calendar and every booking is none", () => {
    const grants = grantsWith(newGrants("trip-1"), pages, { op: "add", traveller: SAM, trip: "edit", calendar: "view" }, { op: "page", traveller: SAM, page: "santiago", level: "view" }, { op: "remove", traveller: SAM });
    assert.deepEqual(PAGES.map((p) => pageLevel(grants, sam, pages, p)), ["none", "none", "none"]);
    assert.equal(calendarLevel(grants, sam), "none");
    assert.equal(bookingLevel(grants, sam, [SAM]), "none");
    assert.deepEqual(grants.grants, []);
  });

  test("adding the same traveller a second time is refused, with the reason", () => {
    const grants = grantsWith(newGrants("trip-1"), pages, { op: "add", traveller: SAM, trip: "edit", calendar: "view" });
    const refused = refusal(applyGrant(grants, pages, { op: "add", traveller: SAM, trip: "view", calendar: "none" }));
    assert.equal(refused.code, "already-on-trip");
    assert.match(refused.message, /on the trip already/);
  });
});

describe("ACC:PERMISSIONS-F7 — the permissions component counts the travellers a move would let see a page", () => {
  const pages = pagesWith(
    noPages(),
    { op: "add", id: "chile", title: "Chile", at: {} },
    { op: "add", id: "peru", title: "Peru", at: {} },
    { op: "add", id: "private", title: "Private", at: {} },
    { op: "add", id: "surprise", title: "Surprise", at: { parent: "private" } },
  );
  const three = ["u-1", "u-2", "u-3"];
  const grants = grantsWith(
    newGrants("trip-1"),
    pages,
    { op: "add", traveller: ADMIN, trip: "edit", calendar: "edit" },
    ...three.flatMap((t): GrantChange[] => [
      { op: "add", traveller: t, trip: "view", calendar: "none" },
      { op: "page", traveller: t, page: "private", level: "none" },
    ]),
  );

  test("moving Surprise under Chile gives 3", () => {
    assert.equal(widens(grants, pages, "surprise", { parent: "chile" }), 3);
  });

  test("moving Chile under Peru gives 0", () => {
    assert.equal(widens(grants, pages, "chile", { parent: "peru" }), 0);
  });

  test("moving Surprise to the top gives 3, and the move changes nothing of the pages passed", () => {
    assert.equal(widens(grants, pages, "surprise", {}), 3);
    assert.equal(pageOf(pages, "surprise")!.parent, "private");
  });
});

describe("ACC:PERMISSIONS-F8 — a trip's grants are written as text, read back unchanged, and changed the same way everywhere", () => {
  const pages = chile();
  const trip = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "edit" }, { op: "page", traveller: SAM, page: "chile", level: "none" });

  test("the grants of the trip of ACC:PERMISSIONS-F1, written as text, read back equal", () => {
    assert.deepEqual(ok(grantsFromText(grantsToText(trip))), trip);
  });

  test("the same ten grants, applied in the same order to two copies, give equal copies", () => {
    const ten: GrantChange[] = [
      { op: "add", traveller: ANA, trip: "view", calendar: "none" },
      { op: "page", traveller: ANA, page: "santiago", level: "edit" },
      { op: "calendar", traveller: SAM, level: "view" },
      { op: "trip", traveller: SAM, level: "edit" },
      { op: "page", traveller: SAM, page: "eating", level: "view" },
      { op: "add", traveller: "u-leo", trip: "edit", calendar: "edit" },
      { op: "page", traveller: "u-leo", page: "chile", level: "none" },
      { op: "unpage", traveller: ANA, page: "santiago" },
      { op: "remove", traveller: "u-leo" },
      { op: "calendar", traveller: ANA, level: "edit" },
    ];
    const one = grantsWith(samViews(pages), pages, ...ten);
    const two = grantsWith(samViews(pages), pages, ...ten);
    assert.deepEqual(one, two);
    assert.equal(grantsToText(one), grantsToText(two));
    assert.equal(one.revision, 13);
  });

  test("a grant naming a traveller not on the trip is refused, with the reason, and the grants are unchanged", () => {
    const before = grantsToText(trip);
    const refused = refusal(applyGrant(trip, pages, { op: "calendar", traveller: "u-nobody", level: "view" }));
    assert.equal(refused.code, "not-on-trip");
    assert.match(refused.message, /not on the trip/);
    assert.equal(grantsToText(trip), before);
  });
});
