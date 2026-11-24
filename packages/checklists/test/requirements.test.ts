// Every check in the verification of each requirement the checklists component claims (spec §4.7,
// §7). The changes of PLN:CHECKLISTS-NFR1 under two languages and time zones are in
// independence.test.ts.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  apply,
  changeFromText,
  changeToText,
  checklistFromText,
  checklistToText,
  copyChecklist,
  newChecklist,
  ordered,
  placeAfter,
  progress,
  type Change,
  type Checklist,
} from "../src/index.ts";
import { ORDER } from "../src/order.ts";
import { applyAll, beforeLeaving, OWNER, ok, onTrip, refusal, texts, TRIP, withItems } from "./helpers.ts";

describe("PLN:CHECKLISTS-F1 — a checklist holds items in the order a caller gives, which it rearranges freely", () => {
  test("Order pesos added after Copies of documents sits between it and Travel insurance", () => {
    const c = applyAll(beforeLeaving(), { op: "add", checklist: "before", item: "pesos", text: "Order pesos", after: "i2" });
    assert.deepEqual(texts(c), ["Passport valid for six months", "Copies of documents", "Order pesos", "Travel insurance"]);
  });

  test("Travel insurance moved to the start is the first item", () => {
    const c = applyAll(beforeLeaving(), { op: "move", checklist: "before", item: "i3" });
    assert.equal(c.items[0]!.text, "Travel insurance");
  });

  test("a rewrite and a removal give Travel insurance, Passport valid for six months, Copies of passport and insurance", () => {
    const c = applyAll(
      beforeLeaving(),
      { op: "add", checklist: "before", item: "pesos", text: "Order pesos", after: "i2" },
      { op: "move", checklist: "before", item: "i3" },
      { op: "write", checklist: "before", item: "i2", text: "Copies of passport and insurance" },
      { op: "remove", checklist: "before", item: "pesos" },
    );
    assert.deepEqual(texts(c), ["Travel insurance", "Passport valid for six months", "Copies of passport and insurance"]);
  });

  test("a rename leaves the items unchanged", () => {
    const start = beforeLeaving();
    const c = applyAll(start, { op: "rename", checklist: "before", title: "Before any trip" });
    assert.equal(c.title, "Before any trip");
    assert.deepEqual(c.items, start.items);
  });
});

describe("PLN:CHECKLISTS-F2 — a title and an item's text are kept as written, up to a limit on each", () => {
  const one = () => withItems(ok(newChecklist("one", OWNER, "One", [], TRIP)), "First");
  const write = (c: Checklist, text: string): Change => ({ op: "write", checklist: c.id, item: "i1", text });

  test("an item rewritten as Pesos — about 50 000 CLP reads back unchanged", () => {
    const c = one();
    const written = ok(apply(c, write(c, "Pesos — about 50 000 CLP")));
    assert.equal(ok(checklistFromText(checklistToText(written))).items[0]!.text, "Pesos — about 50 000 CLP");
  });

  test("text of exactly 500 characters is accepted", () => {
    const c = one();
    ok(apply(c, write(c, "é".repeat(500))));
  });

  test("text of 501 characters, holding a line break, or of spaces alone is refused, and the item is unchanged", () => {
    const c = one();
    for (const text of ["a".repeat(501), "Copies\nof documents", "Copies of documents", "   "]) {
      const refused = refusal(apply(c, write(c, text)));
      assert.equal(refused.code, "bad-text", JSON.stringify(text));
      assert.ok(refused.message.length > 0);
    }
    assert.equal(c.items[0]!.text, "First");
  });

  test("an item added to a checklist of 200 is refused, with the reason", () => {
    let c = one();
    for (let n = 2; n <= 200; n++) c = ok(apply(c, { op: "add", checklist: c.id, item: `x${n}`, text: `Item ${n}`, after: c.items.at(-1)!.id }));
    assert.equal(c.items.length, 200);
    const refused = refusal(apply(c, { op: "add", checklist: c.id, item: "x201", text: "One too many" }));
    assert.equal(refused.code, "too-many-items");
    assert.match(refused.message, /200/);
  });
});

describe("PLN:CHECKLISTS-F3 — an item of a trip's checklist is ticked and unticked, and an item of a template never is", () => {
  const tick = (ticked: boolean): Change => ({ op: "tick", checklist: "trip-before", item: "i1", ticked });

  test("ticking Passport valid for six months gives one of three ticked", () => {
    assert.deepEqual(progress(applyAll(onTrip(), tick(true))), { ticked: 1, of: 3 });
  });

  test("ticking it again keeps it ticked, with one ticked", () => {
    const c = applyAll(onTrip(), tick(true), tick(true));
    assert.equal(c.items[0]!.ticked, true);
    assert.deepEqual(progress(c), { ticked: 1, of: 3 });
  });

  test("unticking it leaves none ticked", () => {
    const c = applyAll(onTrip(), tick(true), tick(false));
    assert.equal("ticked" in c.items[0]!, false);
    assert.deepEqual(progress(c), { ticked: 0, of: 3 });
  });

  test("ticking an item of the template Before leaving is refused, with the reason", () => {
    const refused = refusal(apply(beforeLeaving(), { op: "tick", checklist: "before", item: "i1", ticked: true }));
    assert.equal(refused.code, "template-tick");
    assert.match(refused.message, /never ticked/);
  });
});

describe("PLN:CHECKLISTS-F4 — a copy starts a checklist on a trip from a template, or a template from a checklist, with no item ticked", () => {
  const copy = () => ok(copyChecklist(beforeLeaving(), "copy", [], TRIP));

  test("a copy to a trip holds the title and three items, in order, none ticked, for the same traveller", () => {
    const c = copy();
    assert.equal(c.title, "Before leaving");
    assert.equal(c.trip, TRIP);
    assert.equal(c.owner, OWNER);
    assert.deepEqual(texts(c), texts(beforeLeaving()));
    assert.deepEqual(progress(c), { ticked: 0, of: 3 });
  });

  test("ticking and adding to the copy leaves the template unchanged", () => {
    const template = beforeLeaving();
    const c = ok(copyChecklist(template, "copy", [], TRIP));
    applyAll(c, { op: "tick", checklist: "copy", item: "i1", ticked: true }, { op: "add", checklist: "copy", item: "pesos", text: "Order pesos" });
    assert.equal(checklistToText(template), checklistToText(beforeLeaving()));
  });

  test("removing an item from the template leaves the copy unchanged", () => {
    const template = beforeLeaving();
    const c = ok(copyChecklist(template, "copy", [], TRIP));
    const before = checklistToText(c);
    applyAll(template, { op: "remove", checklist: "before", item: "i3" });
    assert.equal(checklistToText(c), before);
  });

  test("the copy copied as a template holds its four items, none ticked, and belongs to no trip", () => {
    const c = applyAll(copy(), { op: "tick", checklist: "copy", item: "i1", ticked: true }, { op: "add", checklist: "copy", item: "pesos", text: "Order pesos", after: "i3" });
    const t = ok(copyChecklist(c, "again", []));
    assert.equal(t.items.length, 4);
    assert.deepEqual(progress(t), { ticked: 0, of: 4 });
    assert.equal("trip" in t, false);
    assert.equal(t.owner, OWNER);
  });
});

describe("PLN:CHECKLISTS-F5 — each checklist is written in a stored form of its own, and read back unchanged", () => {
  test("a template, and a checklist on a trip with one item ticked, each read back equal", () => {
    for (const c of [beforeLeaving(), applyAll(onTrip(), { op: "tick", checklist: "trip-before", item: "i2", ticked: true })]) {
      assert.deepEqual(ok(checklistFromText(checklistToText(c))), c);
    }
  });

  test("a stored form that is not a checklist's is refused, with the reason", () => {
    for (const text of ["not json", '{"format":1,"id":"a"}', "[]"]) {
      const refused = refusal(checklistFromText(text));
      assert.equal(refused.code, "malformed", text);
      assert.ok(refused.message.length > 0);
    }
  });
});

describe("PLN:CHECKLISTS-F6 — a change gives the same checklist wherever it is applied, and a refused change leaves it as it was", () => {
  const ten: Change[] = [
    { op: "add", checklist: "trip-before", item: "a", text: "Order pesos" },
    { op: "tick", checklist: "trip-before", item: "i1", ticked: true },
    { op: "move", checklist: "trip-before", item: "a", after: "i3" },
    { op: "write", checklist: "trip-before", item: "i2", text: "Copies of passport" },
    { op: "rename", checklist: "trip-before", title: "Before Chile" },
    { op: "add", checklist: "trip-before", item: "b", text: "Charge the camera", after: "i1" },
    { op: "tick", checklist: "trip-before", item: "b", ticked: true },
    { op: "remove", checklist: "trip-before", item: "i3" },
    { op: "place", checklist: "trip-before", order: "k" },
    { op: "tick", checklist: "trip-before", item: "i1", ticked: false },
  ];

  test("the same ten changes, in the same order, give equal checklists, sent as text or not", () => {
    const first = applyAll(onTrip(), ...ten);
    const second = applyAll(onTrip(), ...ten.map((c) => ok(changeFromText(changeToText(c)))));
    assert.deepEqual(second, first);
    assert.equal(checklistToText(second), checklistToText(first));
  });

  test("a tick then an untick leaves the second standing", () => {
    const c = applyAll(onTrip(), { op: "tick", checklist: "trip-before", item: "i2", ticked: true }, { op: "tick", checklist: "trip-before", item: "i2", ticked: false });
    assert.equal(c.items[1]!.ticked, undefined);
  });

  test("removing an item the checklist does not hold is refused, with the reason, and the checklist is unchanged", () => {
    const c = onTrip();
    const before = checklistToText(c);
    const refused = refusal(apply(c, { op: "remove", checklist: "trip-before", item: "nowhere" }));
    assert.equal(refused.code, "unknown-item");
    assert.match(refused.message, /nowhere/);
    assert.equal(checklistToText(c), before);
  });
});

describe("PLN:CHECKLISTS-F7 — a traveller's checklists keep the order a caller gives them, and a new one goes last", () => {
  const library = () => {
    const before = ok(newChecklist("before", OWNER, "Before leaving", []));
    const packing = ok(newChecklist("packing", OWNER, "Packing", [before]));
    return [before, packing];
  };
  const titles = (list: readonly Checklist[]) => ordered(list).map((c) => c.title);

  test("Last day, made after Before leaving and Packing, is listed last", () => {
    const list = library();
    list.push(ok(newChecklist("last", OWNER, "Last day", list)));
    assert.deepEqual(titles(list), ["Before leaving", "Packing", "Last day"]);
  });

  test("Last day moved to the start is listed first, and no other template changes", () => {
    const list = library();
    list.push(ok(newChecklist("last", OWNER, "Last day", list)));
    const others = list.slice(0, 2).map(checklistToText);
    const moved = ok(apply(list[2]!, ok(placeAfter(list, "last"))));
    const after = [list[0]!, list[1]!, moved];
    assert.deepEqual(titles(after), ["Last day", "Before leaving", "Packing"]);
    assert.deepEqual(after.slice(0, 2).map(checklistToText), others);
  });

  test("Packing copied to a trip holding one checklist is listed second there, and the templates' order is unchanged", () => {
    const list = library();
    const onTheTrip = [ok(newChecklist("first", OWNER, "First", [], TRIP))];
    onTheTrip.push(ok(copyChecklist(list[1]!, "packing-copy", onTheTrip, TRIP)));
    assert.deepEqual(titles(onTheTrip), ["First", "Packing"]);
    assert.deepEqual(titles(list), ["Before leaving", "Packing"]);
  });

  test("a thousand checklists, each moved before the last made, change only the one moved, with every order in form", () => {
    const list: Checklist[] = [ok(newChecklist("c0", OWNER, "C0", []))];
    for (let n = 1; n < 1000; n++) {
      const made = ok(newChecklist(`c${n}`, OWNER, `C${n}`, list));
      list.push(made);
      const unchanged = list.slice(0, -1);
      const moved = ok(apply(made, ok(placeAfter(list, made.id))));
      list[list.length - 1] = moved;
      assert.ok(list.slice(0, -1).every((c, i) => c === unchanged[i]));
      assert.match(moved.order, ORDER);
    }
    assert.equal(ordered(list)[0]!.id, "c999");
    assert.equal(ordered(list).at(-1)!.id, "c0");
  });
});
