// newChecklist (spec §4.1), apply (§4.2), copyChecklist (§4.3) and progress (§4.4).

import { checkId, checkText, checkTitle, fields, MAX_ITEMS, text } from "./checks.ts";
import { last, ORDER } from "./order.ts";
import { attempt, fail, type Change, type Checklist, type Id, type Item, type List, type Progress, type Result } from "./types.ts";

export function makeItem(id: Id, value: string, ticked: boolean): Item {
  return Object.freeze(ticked ? { id, text: value, ticked: true as const } : { id, text: value });
}

export function makeChecklist(fieldsOf: Omit<Checklist, "format">): Checklist {
  const checklist: Checklist = {
    format: 1,
    id: fieldsOf.id,
    owner: fieldsOf.owner,
    order: fieldsOf.order,
    title: fieldsOf.title,
    items: Object.freeze([...fieldsOf.items]),
  };
  if (fieldsOf.trip !== undefined) checklist.trip = fieldsOf.trip;
  return Object.freeze(checklist);
}

export function newChecklist(id: Id, owner: Id, title: string, list: List, trip?: Id): Result<Checklist> {
  return attempt(() => {
    const fieldsOf: Omit<Checklist, "format"> = {
      id: checkId(id, "checklist's identifier"),
      owner: checkId(owner, "checklist's owner"),
      order: "",
      title: checkTitle(title),
      items: [],
    };
    if (trip !== undefined) fieldsOf.trip = checkId(trip, "checklist's trip");
    fieldsOf.order = last(list);
    return makeChecklist(fieldsOf);
  });
}

export function copyChecklist(from: Checklist, id: Id, list: List, trip?: Id): Result<Checklist> {
  return attempt(() => {
    const r = fields(from, "checklist copied", ["format", "id", "owner", "order", "title", "items"], ["trip"]);
    if (!Array.isArray(r.items)) fail("malformed", "The checklist copied holds no list of items.");
    const items = (r.items as unknown[]).map((item) => {
      const i = fields(item, "item", ["id", "text"], ["ticked"]);
      return makeItem(text(i.id, "item's identifier"), text(i.text, "item's text"), false);
    });
    const fieldsOf: Omit<Checklist, "format"> = {
      id: checkId(id, "checklist's identifier"),
      owner: text(r.owner, "checklist's owner"),
      order: "",
      title: text(r.title, "checklist's title"),
      items,
    };
    if (trip !== undefined) fieldsOf.trip = checkId(trip, "checklist's trip");
    fieldsOf.order = last(list);
    return makeChecklist(fieldsOf);
  });
}

const OPS: Record<Change["op"], { required: readonly string[]; optional?: readonly string[] }> = {
  rename: { required: ["title"] },
  add: { required: ["item", "text"], optional: ["after"] },
  write: { required: ["item", "text"] },
  move: { required: ["item"], optional: ["after"] },
  remove: { required: ["item"] },
  tick: { required: ["item", "ticked"] },
  place: { required: ["order"] },
};

function find(checklist: Checklist, id: string): number {
  const at = checklist.items.findIndex((i) => i.id === id);
  if (at < 0) fail("unknown-item", `The checklist ${JSON.stringify(checklist.title)} holds no item ${JSON.stringify(id)}.`);
  return at;
}

/** Puts an item into items after the item `after` names, or first where it is absent. */
function insert(items: Item[], item: Item, after: string | undefined): Item[] {
  if (after === undefined) return [item, ...items];
  const at = items.findIndex((i) => i.id === after);
  return [...items.slice(0, at + 1), item, ...items.slice(at + 1)];
}

export function apply(checklist: Checklist, change: Change): Result<Checklist> {
  return attempt(() => {
    const op = (change as { op?: unknown } | null)?.op;
    if (typeof op !== "string" || !(op in OPS)) fail("malformed", `The change ${JSON.stringify(op)} is not one the checklists component makes.`);
    const shape = OPS[op as Change["op"]];
    const r = fields(change, `change ${op}`, ["op", "checklist", ...shape.required], shape.optional ?? []);
    if (text(r.checklist, "change's checklist") !== checklist.id) {
      fail("wrong-checklist", `The change names the checklist ${JSON.stringify(r.checklist)}, not ${JSON.stringify(checklist.id)}.`);
    }
    const after = r.after === undefined ? undefined : text(r.after, "change's after");
    const next: Omit<Checklist, "format"> = { ...checklist };
    let items = [...checklist.items];

    switch (op as Change["op"]) {
      case "rename":
        next.title = checkTitle(r.title);
        break;
      case "add": {
        const id = checkId(r.item, "item's identifier");
        if (items.some((i) => i.id === id)) fail("duplicate-id", `The checklist ${JSON.stringify(checklist.title)} already holds an item ${JSON.stringify(id)}.`);
        if (after !== undefined) find(checklist, after);
        const value = checkText(r.text);
        if (items.length >= MAX_ITEMS) fail("too-many-items", `The checklist ${JSON.stringify(checklist.title)} already holds ${MAX_ITEMS} items.`);
        items = insert(items, makeItem(id, value, false), after);
        break;
      }
      case "write": {
        const at = find(checklist, text(r.item, "item's identifier"));
        const value = checkText(r.text);
        const item = items[at]!;
        items[at] = makeItem(item.id, value, item.ticked === true);
        break;
      }
      case "move": {
        const id = text(r.item, "item's identifier");
        const at = find(checklist, id);
        if (after !== undefined) find(checklist, after);
        if (after === id) break;
        const item = items[at]!;
        items = insert(items.filter((i) => i.id !== id), item, after);
        break;
      }
      case "remove": {
        const at = find(checklist, text(r.item, "item's identifier"));
        items.splice(at, 1);
        break;
      }
      case "tick": {
        const at = find(checklist, text(r.item, "item's identifier"));
        if (typeof r.ticked !== "boolean") fail("malformed", "The tick's ticked is not true or false.");
        if (checklist.trip === undefined) fail("template-tick", `The template ${JSON.stringify(checklist.title)} is never ticked.`);
        const item = items[at]!;
        items[at] = makeItem(item.id, item.text, r.ticked);
        break;
      }
      case "place": {
        const order = text(r.order, "change's order");
        if (!ORDER.test(order)) fail("bad-order", `The order ${JSON.stringify(order)} is not in the form of an order.`);
        next.order = order;
        break;
      }
    }
    next.items = items;
    return makeChecklist(next);
  });
}

export function progress(checklist: Checklist): Progress {
  return Object.freeze({ ticked: checklist.items.filter((i) => i.ticked === true).length, of: checklist.items.length });
}
