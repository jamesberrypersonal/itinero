// Each refusal of spec §3.3, and each row of the tables of §4.1 and §4.4.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Change } from "@itinero/pages";
import { applyGrant, authorise, grantChangeFromText, grantsFromText, grantsToText, newGrants, pageLevel, type GrantChange, type Request } from "../src/index.ts";
import { ADMIN, admin, ana, chile, grantsWith, ok, pagesWith, refusal, SAM, sam, samViews } from "./helpers.ts";

const pages = pagesWith(chile(), { op: "add", id: "peru", title: "Peru", at: {} });
const code = (change: unknown, grants = samViews(pages)) => refusal(applyGrant(grants, pages, change as GrantChange)).code;
const asked = (request: unknown, who = sam, grants = samViews(pages)) => authorise(grants, who, pages, request as Request);

describe("the refusals of §3.3", () => {
  test("malformed", () => {
    for (const change of [null, {}, { op: "fly", traveller: SAM }, { op: "add", traveller: "u-x", trip: "view" },
      { op: "add", traveller: "u-x", trip: "admin", calendar: "none" }, { op: "page", traveller: SAM, page: "chile", level: "all" },
      { op: "remove", traveller: SAM, extra: 1 }, { op: "calendar", traveller: 7, level: "view" }]) {
      assert.equal(code(change), "malformed", JSON.stringify(change));
    }
    assert.equal(refusal(applyGrant({ format: 1, trip: "t", revision: 0, grants: [] }, pages, { op: "remove", traveller: SAM })).code, "malformed");
    for (const request of [null, { kind: "fly" }, { kind: "read-page" }, { kind: "change-page", change: { op: "fly", id: "chile" } }, { kind: "read-booking", travellers: "u-sam" }, { kind: "grant", change: {} }]) {
      assert.equal(refusal(asked(request)).code, "malformed", JSON.stringify(request));
    }
    assert.equal(refusal(grantsFromText("not json")).code, "malformed");
    assert.equal(refusal(grantsFromText('{"format":1,"grants":[],"revision":1}')).code, "malformed");
    assert.equal(refusal(grantChangeFromText('{"op":"trip","traveller":"u-sam","level":"none"}')).code, "malformed");
    assert.equal(refusal(applyGrant(newGrants(""), pages, { op: "remove", traveller: SAM })).code, "malformed");
  });

  test("not-on-trip, from applyGrant and authorise", () => {
    const changes: GrantChange[] = [
      { op: "remove", traveller: "u-nobody" },
      { op: "trip", traveller: "u-nobody", level: "view" },
      { op: "calendar", traveller: "u-nobody", level: "view" },
      { op: "page", traveller: "u-nobody", page: "chile", level: "view" },
      { op: "unpage", traveller: "u-nobody", page: "chile" },
    ];
    for (const change of changes) assert.equal(code(change), "not-on-trip", change.op);
    assert.equal(refusal(asked({ kind: "read-calendar" }, ana)).code, "not-on-trip");
    assert.equal(refusal(asked({ kind: "read-page", page: "chile" }, { traveller: "u-nobody", admin: true })).code, "not-on-trip");
  });

  test("already-on-trip", () => {
    assert.equal(code({ op: "add", traveller: SAM, trip: "edit", calendar: "edit" }), "already-on-trip");
  });

  test("unknown-page, from applyGrant and authorise, for an admin too", () => {
    assert.equal(code({ op: "page", traveller: SAM, page: "bolivia", level: "view" }), "unknown-page");
    for (const request of [{ kind: "read-page", page: "bolivia" }, { kind: "read-buried", page: "bolivia" },
      { kind: "change-page", change: { op: "add", id: "x", title: "X", at: { parent: "bolivia" } } },
      { kind: "change-page", change: { op: "move", id: "chile", to: { parent: "bolivia" } } }]) {
      assert.equal(refusal(asked(request, admin)).code, "unknown-page", JSON.stringify(request));
    }
  });

  test("hidden-above names the page in details", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "chile", level: "none" });
    const refused = refusal(applyGrant(grants, pages, { op: "page", traveller: SAM, page: "santiago", level: "view" }));
    assert.deepEqual([refused.code, refused.details], ["hidden-above", { page: "chile" }]);
  });

  test("no-view, no-edit and admin-only", () => {
    const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "peru", level: "none" });
    assert.equal(refusal(asked({ kind: "read-page", page: "peru" }, sam, grants)).code, "no-view");
    assert.equal(refusal(asked({ kind: "change-page", change: { op: "rename", id: "peru", title: "P" } }, sam, grants)).code, "no-edit");
    assert.equal(refusal(asked({ kind: "read-buried", page: "peru" })).code, "admin-only");
  });

  test("unknown-format", () => {
    assert.equal(refusal(grantsFromText('{"format":2,"grants":[],"revision":1,"trip":"t"}')).code, "unknown-format");
  });
});

describe("the changes of §4.1", () => {
  const base = samViews(pages);

  test("add gives the traveller the access given, and no exceptions", () => {
    const grants = ok(applyGrant(base, pages, { op: "add", traveller: "u-ana", trip: "edit", calendar: "view" }));
    assert.deepEqual(grants.grants.find((g) => g.traveller === "u-ana"), { traveller: "u-ana", trip: "edit", calendar: "view", pages: [] });
    assert.equal(grants.revision, base.revision + 1);
  });

  test("remove takes away the traveller and every exception they hold", () => {
    const grants = grantsWith(base, pages, { op: "page", traveller: SAM, page: "chile", level: "edit" }, { op: "remove", traveller: SAM });
    assert.deepEqual(grants.grants.map((g) => g.traveller), [ADMIN]);
  });

  test("trip sets the traveller's access to the trip", () => {
    const grants = grantsWith(base, pages, { op: "trip", traveller: SAM, level: "edit" });
    assert.equal(pageLevel(grants, sam, pages, "eating"), "edit");
  });

  test("calendar sets the traveller's level for the calendar", () => {
    assert.equal(grantsWith(base, pages, { op: "calendar", traveller: SAM, level: "edit" }).grants.find((g) => g.traveller === SAM)!.calendar, "edit");
  });

  test("page replaces any exception the traveller holds for the page, and of two changes the later stands", () => {
    const grants = grantsWith(base, pages, { op: "page", traveller: SAM, page: "santiago", level: "edit" }, { op: "page", traveller: SAM, page: "santiago", level: "none" });
    assert.deepEqual(grants.grants.find((g) => g.traveller === SAM)!.pages, [{ page: "santiago", level: "none" }]);
  });

  test("unpage removes the traveller's exception for the page, and does nothing where there is none", () => {
    const grants = grantsWith(base, pages, { op: "page", traveller: SAM, page: "santiago", level: "edit" }, { op: "unpage", traveller: SAM, page: "santiago" }, { op: "unpage", traveller: SAM, page: "peru" });
    assert.deepEqual(grants.grants.find((g) => g.traveller === SAM)!.pages, []);
  });

  test("an exception for a page the trip no longer holds is kept, and does nothing", () => {
    const grants = grantsWith(base, pages, { op: "page", traveller: SAM, page: "peru", level: "none" });
    const fewer = { trip: pages.trip, pages: pages.pages.filter((p) => p.id !== "peru") };
    const after = ok(applyGrant(grants, fewer, { op: "calendar", traveller: SAM, level: "view" }));
    assert.deepEqual(after.grants.find((g) => g.traveller === SAM)!.pages, [{ page: "peru", level: "none" }]);
    assert.equal(pageLevel(after, sam, fewer, "chile"), "view");
  });

  test("every object returned is frozen, and the grants passed in are unchanged", () => {
    const before = grantsToText(base);
    const after = ok(applyGrant(base, pages, { op: "page", traveller: SAM, page: "chile", level: "edit" }));
    assert.equal(grantsToText(base), before);
    assert.ok(Object.isFrozen(after) && Object.isFrozen(after.grants) && after.grants.every((g) => Object.isFrozen(g) && Object.isFrozen(g.pages)));
  });

  test("newGrants gives no traveller and revision 1", () => {
    assert.deepEqual(newGrants("trip-1"), { format: 1, trip: "trip-1", revision: 1, grants: [] });
  });
});

describe("the requests of §4.4", () => {
  // Sam may view the trip, edit Santiago and the pages beneath it, and may not see Peru.
  const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "edit" }, { op: "page", traveller: SAM, page: "peru", level: "none" });
  const editor = grantsWith(grants, pages, { op: "trip", traveller: SAM, level: "edit" });
  const result = (request: unknown, g = grants) => {
    const r = asked(request, sam, g);
    return r.ok ? "allowed" : r.refusal.code;
  };
  const change = (c: Change) => ({ kind: "change-page", change: c });

  test("read-page needs view for the page", () => {
    assert.equal(result({ kind: "read-page", page: "chile" }), "allowed");
    assert.equal(result({ kind: "read-page", page: "peru" }), "no-view");
  });

  test("an add needs edit for the parent given, or edit access to the trip for a page at the top", () => {
    assert.equal(result(change({ op: "add", id: "x", title: "X", at: { parent: "santiago" } })), "allowed");
    assert.equal(result(change({ op: "add", id: "x", title: "X", at: { parent: "chile" } })), "no-edit");
    assert.equal(result(change({ op: "add", id: "x", title: "X", at: {} })), "no-edit");
    assert.equal(result(change({ op: "add", id: "x", title: "X", at: {} }), editor), "allowed");
  });

  test("rename, write and bury need edit for the page", () => {
    for (const c of [{ op: "rename", id: "PAGE", title: "T" }, { op: "write", id: "PAGE", text: "t", base: 1 }, { op: "bury", id: "PAGE" }]) {
      assert.equal(result(change({ ...c, id: "eating" } as Change)), "allowed", c.op);
      assert.equal(result(change({ ...c, id: "chile" } as Change)), "no-edit", c.op);
    }
  });

  test("a move needs edit for the page, and edit for the new parent or the trip", () => {
    assert.equal(result(change({ op: "move", id: "eating", to: { parent: "santiago" } })), "allowed");
    assert.equal(result(change({ op: "move", id: "chile", to: { parent: "santiago" } })), "no-edit");
    assert.equal(result(change({ op: "move", id: "eating", to: {} })), "no-edit");
    assert.equal(result(change({ op: "move", id: "eating", to: {} }), editor), "allowed");
  });

  test("restore and read-buried need an admin", () => {
    assert.equal(result(change({ op: "restore", id: "eating" })), "admin-only");
    assert.equal(result({ kind: "read-buried", page: "eating" }), "admin-only");
  });

  test("read-calendar and change-calendar need view, or edit, for the calendar", () => {
    const viewer = grantsWith(grants, pages, { op: "calendar", traveller: SAM, level: "view" });
    assert.equal(result({ kind: "read-calendar" }), "no-view");
    assert.equal(result({ kind: "read-calendar" }, viewer), "allowed");
    assert.equal(result({ kind: "change-calendar" }, viewer), "no-edit");
  });

  test("read-booking and change-booking need view, or edit, for the booking", () => {
    assert.equal(result({ kind: "read-booking", travellers: [SAM] }), "allowed");
    assert.equal(result({ kind: "change-booking", travellers: [SAM] }), "no-edit");
    assert.equal(result({ kind: "change-booking", travellers: [SAM] }, editor), "allowed");
    assert.equal(result({ kind: "read-booking", travellers: ["u-ana"] }), "no-view");
  });

  test("grant needs an admin", () => {
    assert.equal(result({ kind: "grant", change: { op: "calendar", traveller: SAM, level: "view" } }), "admin-only");
  });
});
