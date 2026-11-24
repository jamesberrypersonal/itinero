// Each refusal of spec §3.3, each row of the table of §4.2, and the order of §4.5.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  apply,
  changeFromText,
  checklistFromText,
  checklistToText,
  copyChecklist,
  newChecklist,
  ordered,
  placeAfter,
  type Change,
  type Checklist,
} from "../src/index.ts";
import { between } from "../src/order.ts";
import { applyAll, beforeLeaving, OWNER, ok, onTrip, refusal, texts, TRIP } from "./helpers.ts";

const code = (c: Checklist, change: unknown) => refusal(apply(c, change as Change)).code;

describe("refusals", () => {
  test("malformed", () => {
    for (const change of [
      null,
      {},
      { op: "fly", checklist: "before" },
      { op: "rename", checklist: "before" },
      { op: "add", checklist: "before", item: "x" },
      { op: "tick", checklist: "trip-before", item: "i1", ticked: "yes" },
      { op: "remove", checklist: "before", item: "i1", extra: true },
      { op: "write", checklist: "before", item: "i1", text: 3 },
    ]) {
      const c = (change as { checklist?: string } | null)?.checklist === "trip-before" ? onTrip() : beforeLeaving();
      assert.equal(code(c, change), "malformed", JSON.stringify(change));
    }
    assert.equal(refusal(changeFromText("{}")).code, "malformed");
    assert.equal(refusal(changeFromText('{"op":"tick","checklist":"a","item":"b","ticked":1}')).code, "malformed");
    assert.equal(refusal(newChecklist("a", OWNER, "A", "not a list" as never)).code, "malformed");
    assert.equal(refusal(newChecklist("a", OWNER, "A", [{ id: "b" } as never])).code, "malformed");
  });

  test("malformed stored forms: a bad order, two items of one identifier, and a ticked template", () => {
    const good = JSON.parse(checklistToText(onTrip())) as Record<string, unknown>;
    const variants: Record<string, unknown>[] = [
      { ...good, order: "10" },
      { ...good, items: [{ id: "a", text: "A" }, { id: "a", text: "B" }] },
      { ...good, items: [{ id: "a", text: "A", ticked: false }] },
      { ...Object.fromEntries(Object.entries(good).filter(([k]) => k !== "trip")), items: [{ id: "a", text: "A", ticked: true }] },
      { ...good, colour: "red" },
    ];
    for (const v of variants) assert.equal(refusal(checklistFromText(JSON.stringify(v))).code, "malformed", JSON.stringify(v));
  });

  test("bad-id", () => {
    assert.equal(refusal(newChecklist("a b", OWNER, "A", [])).code, "bad-id");
    assert.equal(refusal(newChecklist("a", "", "A", [])).code, "bad-id");
    assert.equal(refusal(newChecklist("a", OWNER, "A", [], "trip/1")).code, "bad-id");
    assert.equal(refusal(copyChecklist(beforeLeaving(), "x".repeat(65), [])).code, "bad-id");
    assert.equal(refusal(copyChecklist(beforeLeaving(), "copy", [], "a b")).code, "bad-id");
    assert.equal(code(beforeLeaving(), { op: "add", checklist: "before", item: "a/b", text: "X" }), "bad-id");
  });

  test("bad-title, trimmed first, with a line break refused", () => {
    assert.equal(refusal(newChecklist("a", OWNER, " ", [])).code, "bad-title");
    assert.equal(refusal(newChecklist("a", OWNER, "t".repeat(201), [])).code, "bad-title");
    assert.equal(code(beforeLeaving(), { op: "rename", checklist: "before", title: "Before\rleaving" }), "bad-title");
    assert.equal(ok(newChecklist("a", OWNER, `  ${"é".repeat(200)}\n`, [])).title, "é".repeat(200));
  });

  test("bad-text, counted in code points", () => {
    assert.equal(code(beforeLeaving(), { op: "add", checklist: "before", item: "x", text: " " }), "bad-text");
    ok(apply(beforeLeaving(), { op: "add", checklist: "before", item: "x", text: "😀".repeat(500) }));
    assert.equal(code(beforeLeaving(), { op: "add", checklist: "before", item: "x", text: "😀".repeat(501) }), "bad-text");
  });

  test("duplicate-id", () => {
    assert.equal(code(beforeLeaving(), { op: "add", checklist: "before", item: "i2", text: "Again" }), "duplicate-id");
  });

  test("unknown-item, for an item or an after", () => {
    const c = onTrip();
    for (const change of [
      { op: "add", checklist: c.id, item: "x", text: "X", after: "nowhere" },
      { op: "write", checklist: c.id, item: "nowhere", text: "X" },
      { op: "move", checklist: c.id, item: "nowhere" },
      { op: "move", checklist: c.id, item: "i1", after: "nowhere" },
      { op: "remove", checklist: c.id, item: "nowhere" },
      { op: "tick", checklist: c.id, item: "nowhere", ticked: true },
    ]) {
      assert.equal(code(c, change), "unknown-item", JSON.stringify(change));
    }
  });

  test("wrong-checklist, before any other check", () => {
    assert.equal(code(beforeLeaving(), { op: "remove", checklist: "packing", item: "nowhere" }), "wrong-checklist");
  });

  test("template-tick", () => {
    assert.equal(code(beforeLeaving(), { op: "tick", checklist: "before", item: "i1", ticked: false }), "template-tick");
  });

  test("bad-order", () => {
    for (const order of ["", "10", "a-b", "é"]) {
      assert.equal(code(beforeLeaving(), { op: "place", checklist: "before", order }), "bad-order", order);
    }
  });

  test("unknown-checklist", () => {
    const list = [{ id: "a", order: "V" }];
    assert.equal(refusal(placeAfter(list, "b")).code, "unknown-checklist");
    assert.equal(refusal(placeAfter(list, "a", "b")).code, "unknown-checklist");
  });

  test("unknown-format", () => {
    const text = checklistToText(beforeLeaving()).replace('"format":1', '"format":2');
    assert.equal(refusal(checklistFromText(text)).code, "unknown-format");
  });
});

describe("the changes of §4.2", () => {
  test("add without after puts the item first, unticked, trimmed", () => {
    const c = applyAll(onTrip(), { op: "add", checklist: "trip-before", item: "x", text: "  First of all  " });
    assert.deepEqual(c.items[0], { id: "x", text: "First of all" });
  });

  test("write keeps the item's tick", () => {
    const c = applyAll(onTrip(), { op: "tick", checklist: "trip-before", item: "i2", ticked: true }, { op: "write", checklist: "trip-before", item: "i2", text: "Copies" });
    assert.deepEqual(c.items[1], { id: "i2", text: "Copies", ticked: true });
  });

  test("move after itself keeps its place, and move after another follows it", () => {
    assert.deepEqual(texts(applyAll(beforeLeaving(), { op: "move", checklist: "before", item: "i2", after: "i2" })), texts(beforeLeaving()));
    const c = applyAll(beforeLeaving(), { op: "move", checklist: "before", item: "i1", after: "i3" });
    assert.deepEqual(c.items.map((i) => i.id), ["i2", "i3", "i1"]);
  });

  test("remove takes a ticked item too", () => {
    const c = applyAll(onTrip(), { op: "tick", checklist: "trip-before", item: "i1", ticked: true }, { op: "remove", checklist: "trip-before", item: "i1" });
    assert.deepEqual(c.items.map((i) => i.id), ["i2", "i3"]);
  });

  test("place sets the order and nothing else", () => {
    const c = applyAll(beforeLeaving(), { op: "place", checklist: "before", order: "k" });
    assert.equal(c.order, "k");
    assert.deepEqual(c.items, beforeLeaving().items);
  });

  test("a new checklist and a copy keep the owner, and no change sets owner or trip", () => {
    const c = ok(copyChecklist(onTrip(), "copy", [], "trip-other"));
    assert.equal(c.owner, OWNER);
    assert.equal(c.trip, "trip-other");
    assert.equal(code(c, { op: "rename", checklist: "copy", title: "X", owner: "someone" }), "malformed");
  });

  test("every result is frozen, and apply changes nothing it is given", () => {
    const start = onTrip();
    const before = checklistToText(start);
    const c = applyAll(start, { op: "tick", checklist: "trip-before", item: "i1", ticked: true });
    assert.equal(checklistToText(start), before);
    assert.ok(Object.isFrozen(c) && Object.isFrozen(c.items) && Object.isFrozen(c.items[0]));
  });
});

describe("the order of §4.5", () => {
  test("a list is ordered by order, then by identifier", () => {
    assert.deepEqual(ordered([{ id: "b", order: "V" }, { id: "a", order: "V" }, { id: "c", order: "1" }]).map((c) => c.id), ["c", "a", "b"]);
  });

  test("the first of an empty list takes the shortest order there is, and each later one sorts after it", () => {
    const first = ok(newChecklist("a", OWNER, "A", [], TRIP));
    assert.equal(first.order, between(undefined, undefined));
    const second = ok(newChecklist("b", OWNER, "B", [first], TRIP));
    assert.ok(first.order < second.order);
  });

  test("placeAfter puts a checklist between two neighbours, or first", () => {
    const list = [{ id: "a", order: "1" }, { id: "b", order: "2" }, { id: "c", order: "3" }];
    const middle = ok(placeAfter(list, "c", "a"));
    assert.ok(middle.op === "place" && "1" < middle.order && middle.order < "2");
    const start = ok(placeAfter(list, "c"));
    assert.ok(start.op === "place" && start.order < "1");
    const same = ok(placeAfter(list, "b", "b"));
    assert.ok(same.op === "place" && same.order === "2");
  });
});
