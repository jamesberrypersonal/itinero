// The text form of a checklist and of a change (spec §4.6, §5.1): JSON with its keys in sorted
// order. Reading checks the form only, so a checklist stored once can always be read back.

import { fields, text } from "./checks.ts";
import { makeChecklist, makeItem } from "./checklist.ts";
import { ORDER } from "./order.ts";
import { attempt, fail, type Change, type Checklist, type Item, type Result } from "./types.ts";

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

export function checklistToText(checklist: Checklist): string {
  return canonical(JSON.parse(JSON.stringify(checklist)) as Json);
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

export function checklistFromText(source: string): Result<Checklist> {
  return attempt(() => {
    const json = readJson(source, "checklist");
    if (typeof json === "object" && json !== null && "format" in json && (json as { format: unknown }).format !== 1) {
      fail("unknown-format", `The checklist is written in format ${JSON.stringify((json as { format: unknown }).format)}, and the checklists component reads format 1.`);
    }
    const r = fields(json, "checklist", ["format", "id", "owner", "order", "title", "items"], ["trip"]);
    const order = text(r.order, "checklist's order");
    if (!ORDER.test(order)) fail("malformed", `The checklist's order ${JSON.stringify(order)} is not in the form of an order.`);
    if (!Array.isArray(r.items)) fail("malformed", "The checklist's items are not a list.");
    const template = r.trip === undefined;
    const seen = new Set<string>();
    const items: Item[] = (r.items as unknown[]).map((entry) => {
      const i = fields(entry, "item", ["id", "text"], ["ticked"]);
      const id = text(i.id, "item's identifier");
      if (seen.has(id)) fail("malformed", `The checklist holds two items ${JSON.stringify(id)}.`);
      seen.add(id);
      if (i.ticked !== undefined && i.ticked !== true) fail("malformed", "An item's ticked is not true.");
      if (i.ticked === true && template) fail("malformed", "An item of a template is ticked.");
      return makeItem(id, text(i.text, "item's text"), i.ticked === true);
    });
    const checklist: Omit<Checklist, "format"> = {
      id: text(r.id, "checklist's identifier"),
      owner: text(r.owner, "checklist's owner"),
      order,
      title: text(r.title, "checklist's title"),
      items,
    };
    if (!template) checklist.trip = text(r.trip, "checklist's trip");
    return makeChecklist(checklist);
  });
}

export function changeFromText(source: string): Result<Change> {
  return attempt((): Change => {
    const json = readJson(source, "change");
    const op = (json as { op?: unknown } | null)?.op;
    switch (op) {
      case "rename": {
        const r = fields(json, "change", ["op", "checklist", "title"]);
        return Object.freeze({ op, checklist: text(r.checklist, "checklist"), title: text(r.title, "title") });
      }
      case "add": {
        const r = fields(json, "change", ["op", "checklist", "item", "text"], ["after"]);
        const change: Change = { op, checklist: text(r.checklist, "checklist"), item: text(r.item, "item"), text: text(r.text, "text") };
        if (r.after !== undefined) change.after = text(r.after, "after");
        return Object.freeze(change);
      }
      case "write": {
        const r = fields(json, "change", ["op", "checklist", "item", "text"]);
        return Object.freeze({ op, checklist: text(r.checklist, "checklist"), item: text(r.item, "item"), text: text(r.text, "text") });
      }
      case "move": {
        const r = fields(json, "change", ["op", "checklist", "item"], ["after"]);
        const change: Change = { op, checklist: text(r.checklist, "checklist"), item: text(r.item, "item") };
        if (r.after !== undefined) change.after = text(r.after, "after");
        return Object.freeze(change);
      }
      case "remove": {
        const r = fields(json, "change", ["op", "checklist", "item"]);
        return Object.freeze({ op, checklist: text(r.checklist, "checklist"), item: text(r.item, "item") });
      }
      case "tick": {
        const r = fields(json, "change", ["op", "checklist", "item", "ticked"]);
        if (typeof r.ticked !== "boolean") fail("malformed", "The tick's ticked is not true or false.");
        return Object.freeze({ op, checklist: text(r.checklist, "checklist"), item: text(r.item, "item"), ticked: r.ticked });
      }
      case "place": {
        const r = fields(json, "change", ["op", "checklist", "order"]);
        return Object.freeze({ op, checklist: text(r.checklist, "checklist"), order: text(r.order, "order") });
      }
      default:
        fail("malformed", `The change ${JSON.stringify(op)} is not one the checklists component makes.`);
    }
  });
}
