// authorise (spec §4.4): allows a request, or refuses it with the first refusal that applies. It
// answers only; the caller carries out an allowed request (ACC:PERMISSIONS-NR1).

import type { Pages } from "@itinero/pages";
import { readChange, readGrants } from "./form.ts";
import { bookingLevel, calendarLevel, grantOf, levelIn, Tree } from "./levels.ts";
import { atLeast, attempt, fail, type Grants, type Id, type Level, type Request, type Result, type Who } from "./types.ts";

type Need = { level: Level; of: string } | "admin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pageId(value: unknown): Id {
  if (typeof value !== "string" || value === "") fail("malformed", "The request names no page.");
  return value;
}

function travellers(value: unknown): readonly Id[] {
  if (!Array.isArray(value) || !value.every((t) => typeof t === "string")) fail("malformed", "The request does not list the travellers the booking names.");
  return value as Id[];
}

export function authorise(grants: Grants, who: Who, pages: Pages, request: Request): Result<true> {
  return attempt((): true => {
    const current = readGrants(grants);
    if (!isRecord(request)) fail("malformed", "The request is not an object.");
    const grant = grantOf(current, who.traveller);
    if (!grant) fail("not-on-trip", "You are not on this trip.");
    const tree = Tree.of(pages);
    const known = (page: Id) => {
      if (!tree.has(page)) fail("unknown-page", "The trip holds no such page.");
      return page;
    };
    const forPage = (page: Id) => levelIn(grant, tree, known(page));
    const forParent = (parent: Id | undefined) => (parent === undefined ? grant.trip : forPage(parent));

    const needs: { level: Level; need: Need }[] = [];
    switch (request.kind) {
      case "read-page":
        needs.push({ level: forPage(pageId(request.page)), need: { level: "view", of: "this page" } });
        break;
      case "read-buried":
        known(pageId(request.page));
        needs.push({ level: "none", need: "admin" });
        break;
      case "change-page": {
        const change = request.change as unknown;
        if (!isRecord(change)) fail("malformed", "The request holds no change.");
        const at = change.at as { parent?: unknown } | undefined;
        const to = change.to as { parent?: unknown } | undefined;
        switch (change.op) {
          case "add":
            needs.push({ level: forParent(at?.parent === undefined ? undefined : pageId(at.parent)), need: { level: "edit", of: at?.parent === undefined ? "the trip" : "the page it is added under" } });
            break;
          case "rename":
          case "write":
          case "bury":
            needs.push({ level: forPage(pageId(change.id)), need: { level: "edit", of: "this page" } });
            break;
          case "move":
            needs.push({ level: forPage(pageId(change.id)), need: { level: "edit", of: "this page" } });
            needs.push({ level: forParent(to?.parent === undefined ? undefined : pageId(to.parent)), need: { level: "edit", of: "the place it is moved to" } });
            break;
          case "restore":
            known(pageId(change.id));
            needs.push({ level: "none", need: "admin" });
            break;
          default:
            fail("malformed", `The change ${JSON.stringify(change.op)} is not one a page takes.`);
        }
        break;
      }
      case "read-calendar":
      case "change-calendar":
        needs.push({ level: calendarLevel(current, who), need: { level: request.kind === "read-calendar" ? "view" : "edit", of: "the calendar" } });
        break;
      case "read-booking":
      case "change-booking":
        needs.push({ level: bookingLevel(current, who, travellers(request.travellers)), need: { level: request.kind === "read-booking" ? "view" : "edit", of: "this booking" } });
        break;
      case "grant":
        readChange(request.change);
        needs.push({ level: "none", need: "admin" });
        break;
      default:
        fail("malformed", `The request ${JSON.stringify((request as { kind?: unknown }).kind)} is not one the permissions component checks.`);
    }

    if (who.admin) return true;
    for (const { level, need } of needs) refuseShort(level, need);
    return true;
  });
}

function refuseShort(level: Level, need: Need): void {
  if (need === "admin") fail("admin-only", "Only an admin of the trip may do this.");
  if (atLeast(level, need.level)) return;
  if (need.level === "view") fail("no-view", `You may not see ${need.of}.`);
  fail("no-edit", level === "view" ? `You may only view ${need.of}, so you cannot change it.` : `You may not change ${need.of}.`);
}
