// newPages (spec §4.1) and apply (§4.2 to §4.5).

import { between } from "./order.ts";
import { Index } from "./tree.ts";
import { attempt, fail, type Applied, type Change, type Id, type Page, type Pages, type Result, type Where } from "./types.ts";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TITLE = 200;
const MAX_TEXT = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks a value is an object holding only the keys given, with every required key present. */
export function fields(value: unknown, what: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!isRecord(value)) fail("malformed", `The ${what} is not an object.`);
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) fail("malformed", `The ${what} has no field ${key}.`);
  }
  for (const key of required) {
    if (value[key] === undefined) fail("malformed", `The ${what} needs the field ${key}.`);
  }
  return value;
}

export function text(value: unknown, what: string): string {
  if (typeof value !== "string") fail("malformed", `The ${what} is not text.`);
  return value;
}

export function whole(value: unknown, what: string): number {
  if (!Number.isSafeInteger(value)) fail("malformed", `The ${what} is not a whole number.`);
  return value as number;
}

/** A character is one Unicode code point (§3.3). */
export function length(value: string): number {
  let count = 0;
  for (const _ of value) count++;
  return count;
}

function checkId(id: string, what: string): void {
  if (!ID.test(id)) fail("bad-id", `The ${what} ${JSON.stringify(id)} is not 1 to 64 letters, digits, hyphens or underscores.`);
}

/** Trims a title, and checks it (§4.2). */
function checkTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed === "") fail("bad-title", "The page's title is empty.");
  if (length(trimmed) > MAX_TITLE) fail("bad-title", `The page's title is longer than ${MAX_TITLE} characters.`);
  return trimmed;
}

function checkText(value: string): void {
  if (length(value) > MAX_TEXT) fail("text-length", `The page's text is longer than 100,000 characters.`);
}

export function readWhere(value: unknown, what: string): Where {
  const r = fields(value, what, [], ["parent", "after"]);
  const where: Where = {};
  if (r.parent !== undefined) where.parent = text(r.parent, `${what}'s parent`);
  if (r.after !== undefined) where.after = text(r.after, `${what}'s after`);
  return Object.freeze(where);
}

export function makePage(fieldsOf: Omit<Page, "format">): Page {
  const page: Page = {
    format: 1,
    id: fieldsOf.id,
    trip: fieldsOf.trip,
    revision: fieldsOf.revision,
    order: fieldsOf.order,
    title: fieldsOf.title,
    text: fieldsOf.text,
  };
  if (fieldsOf.parent !== undefined) page.parent = fieldsOf.parent;
  if (fieldsOf.buried !== undefined) page.buried = fieldsOf.buried;
  if (fieldsOf.country !== undefined) page.country = fieldsOf.country;
  return Object.freeze(page);
}

function makePages(trip: Id, pages: Iterable<Page>): Pages {
  return Object.freeze({ trip, pages: Object.freeze([...pages].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) });
}

export function newPages(trip: Id, countries: readonly { id: Id; title: string; country: string }[]): Result<Pages> {
  return attempt(() => {
    checkId(text(trip, "trip's identifier"), "trip's identifier");
    if (!Array.isArray(countries)) fail("malformed", "The countries are not a list.");
    const made: Page[] = [];
    let order: string | undefined;
    for (const entry of countries) {
      const r = fields(entry, "country's page", ["id", "title", "country"]);
      const id = text(r.id, "page's identifier");
      checkId(id, "page's identifier");
      if (made.some((p) => p.id === id)) duplicate(id);
      const title = checkTitle(text(r.title, "page's title"));
      order = between(order, undefined);
      made.push(makePage({ id, trip, revision: 1, order, title, text: "", country: text(r.country, "page's country") }));
    }
    return makePages(trip, made);
  });
}

function duplicate(id: Id): never {
  fail("duplicate-id", `The trip already holds a page ${JSON.stringify(id)}, in its tree or its graveyard.`);
}

const OPS: Record<Change["op"], { required: readonly string[]; optional?: readonly string[] }> = {
  add: { required: ["id", "title", "at"], optional: ["text"] },
  rename: { required: ["id", "title"] },
  write: { required: ["id", "text", "base"] },
  move: { required: ["id", "to"] },
  bury: { required: ["id"] },
  restore: { required: ["id"] },
};

export function apply(pages: Pages, change: Change): Result<Applied> {
  return attempt(() => {
    const op = (change as { op?: unknown } | null)?.op;
    if (typeof op !== "string" || !(op in OPS)) fail("malformed", `The change ${JSON.stringify(op)} is not one the pages component makes.`);
    const shape = OPS[op as Change["op"]];
    const r = fields(change, `change ${op}`, ["op", ...shape.required], shape.optional ?? []);
    const index = new Index(pages);
    const id = text(r.id, "page's identifier");

    let written: Page;
    if (op === "add") {
      checkId(id, "page's identifier");
      if (index.byId.has(id)) duplicate(id);
      const title = checkTitle(text(r.title, "page's title"));
      const body = r.text === undefined ? "" : text(r.text, "page's text");
      checkText(body);
      const at = readWhere(r.at, "place");
      const order = place(index, at, undefined);
      const page: Omit<Page, "format"> = { id, trip: pages.trip, revision: 1, order, title, text: body };
      if (at.parent !== undefined) page.parent = at.parent;
      written = makePage(page);
    } else {
      const current = index.byId.get(id);
      if (!current) fail("unknown-id", `The trip holds no page ${JSON.stringify(id)}.`);
      const inTree = index.inTree(id);
      const next = { ...current, revision: current.revision + 1 };
      if (op === "restore") {
        if (inTree) fail("not-in-graveyard", `The page ${JSON.stringify(current.title)} is in the tree, not the graveyard.`);
        if (!index.listed(current)) {
          const first = index.above(id).find((p) => index.listed(p))!;
          fail(
            "parent-in-graveyard",
            `The page ${JSON.stringify(current.title)} goes back under a page in the graveyard, so restore ${JSON.stringify(first.title)} first.`,
            { page: first.id },
          );
        }
        delete next.buried;
      } else {
        if (!inTree) fail("in-graveyard", `The page ${JSON.stringify(current.title)} is in the graveyard, so it cannot be changed.`);
        switch (op) {
          case "rename":
            next.title = checkTitle(text(r.title, "page's title"));
            break;
          case "write": {
            const base = whole(r.base, "write's base");
            const body = text(r.text, "page's text");
            if (base !== current.revision) {
              fail(
                "stale",
                `The page ${JSON.stringify(current.title)} has changed since revision ${base}, and is now at revision ${current.revision}.`,
                { text: current.text, revision: String(current.revision) },
              );
            }
            checkText(body);
            next.text = body;
            break;
          }
          case "move": {
            const to = readWhere(r.to, "place");
            if (to.parent !== undefined && (to.parent === id || index.above(to.parent).some((p) => p.id === id))) {
              fail("cycle", `The page ${JSON.stringify(current.title)} cannot move under itself, or under a page beneath it.`);
            }
            next.order = place(index, to, current);
            if (to.parent === undefined) delete next.parent;
            else next.parent = to.parent;
            break;
          }
          case "bury": {
            const highest = Math.max(0, ...pages.pages.map((p) => p.buried ?? 0));
            next.buried = highest + 1;
            break;
          }
        }
      }
      written = makePage(next);
    }

    const all = new Map(index.byId);
    all.set(written.id, written);
    return Object.freeze({ pages: makePages(pages.trip, all.values()), written: Object.freeze([written]) });
  });
}

/** Checks a Where, and gives the order a page placed there takes (§4.3). */
function place(index: Index, where: Where, moving: Page | undefined): string {
  const { parent, after } = where;
  if (parent !== undefined && !index.inTree(parent)) fail("not-in-tree", `The page ${JSON.stringify(parent)} is not in the tree.`);
  if (after !== undefined && !index.inTree(after)) fail("not-in-tree", `The page ${JSON.stringify(after)} is not in the tree.`);
  const afterPage = after === undefined ? undefined : index.byId.get(after)!;
  if (afterPage && afterPage.parent !== parent) {
    fail("not-a-sibling", `The page ${JSON.stringify(after)} is not under the parent given.`);
  }
  if (moving && afterPage && afterPage.id === moving.id) return moving.order;
  const siblings = index.inTreeUnder(parent).filter((p) => p.id !== moving?.id);
  if (!afterPage) return between(undefined, siblings[0]?.order);
  const at = siblings.findIndex((p) => p.id === afterPage.id);
  return between(afterPage.order, siblings[at + 1]?.order);
}
