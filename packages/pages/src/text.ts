// The text form of a page and of a change (spec §4.8, §5.1): JSON with its keys in sorted order.
// Reading checks the form only, so a page stored once can always be read back.

import { fields, makePage, readWhere, text, whole } from "./apply.ts";
import { ORDER } from "./order.ts";
import { attempt, fail, type Change, type Page, type Result } from "./types.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k]!)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function pageToText(page: Page): string {
  return canonical(JSON.parse(JSON.stringify(page)) as Json);
}

export function changeToText(change: Change): string {
  return canonical(JSON.parse(JSON.stringify(change)) as Json);
}

function readJson(source: string, what: string): unknown {
  if (typeof source !== "string") fail("malformed", `The ${what} is not text.`);
  try {
    return JSON.parse(source);
  } catch {
    fail("malformed", `The ${what} is not JSON.`);
  }
}

export function pageFromText(source: string): Result<Page> {
  return attempt(() => {
    const json = readJson(source, "page");
    if (typeof json === "object" && json !== null && "format" in json && (json as { format: unknown }).format !== 1) {
      fail("unknown-format", `The page is written in format ${JSON.stringify((json as { format: unknown }).format)}, and the pages component reads format 1.`);
    }
    const r = fields(json, "page", ["format", "id", "trip", "revision", "order", "title", "text"], ["parent", "buried", "country"]);
    const order = text(r.order, "page's order");
    if (!ORDER.test(order)) fail("malformed", `The page's order ${JSON.stringify(order)} is not in the form of an order.`);
    const page: Omit<Page, "format"> = {
      id: text(r.id, "page's identifier"),
      trip: text(r.trip, "page's trip"),
      revision: whole(r.revision, "page's revision"),
      order,
      title: text(r.title, "page's title"),
      text: text(r.text, "page's text"),
    };
    if (r.parent !== undefined) page.parent = text(r.parent, "page's parent");
    if (r.buried !== undefined) page.buried = whole(r.buried, "page's buried");
    if (r.country !== undefined) page.country = text(r.country, "page's country");
    return makePage(page);
  });
}

export function changeFromText(source: string): Result<Change> {
  return attempt((): Change => {
    const json = readJson(source, "change");
    const op = (json as { op?: unknown } | null)?.op;
    switch (op) {
      case "add": {
        const r = fields(json, "change", ["op", "id", "title", "at"], ["text"]);
        const change: Change = { op, id: text(r.id, "identifier"), title: text(r.title, "title"), at: readWhere(r.at, "place") };
        if (r.text !== undefined) change.text = text(r.text, "text");
        return Object.freeze(change);
      }
      case "rename": {
        const r = fields(json, "change", ["op", "id", "title"]);
        return Object.freeze({ op, id: text(r.id, "identifier"), title: text(r.title, "title") });
      }
      case "write": {
        const r = fields(json, "change", ["op", "id", "text", "base"]);
        return Object.freeze({ op, id: text(r.id, "identifier"), text: text(r.text, "text"), base: whole(r.base, "base") });
      }
      case "move": {
        const r = fields(json, "change", ["op", "id", "to"]);
        return Object.freeze({ op, id: text(r.id, "identifier"), to: readWhere(r.to, "place") });
      }
      case "bury":
      case "restore": {
        const r = fields(json, "change", ["op", "id"]);
        return Object.freeze({ op, id: text(r.id, "identifier") });
      }
      default:
        fail("malformed", `The change ${JSON.stringify(op)} is not one the pages component makes.`);
    }
  });
}
