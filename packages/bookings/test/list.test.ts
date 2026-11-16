// The checks of the bookings list that need no kind of booking: the form of a change and of the
// text form, the rows of the table of touches and apply (spec/bookings/list.md §3.3, §4.2), and
// order, onDate and notOver of no bookings. The checks needing a booking of some kind are in each
// kind's own test file, and in kinds.test.ts.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { apply, bookingFromText, changeFromText, changeToText, check, notOver, onDate, order, touches, type Booking, type Change } from "../src/index.ts";
import { SANTIAGO, exact, loadNewestRules, ok, refusal } from "./helpers.ts";

before(() => {
  loadNewestRules();
});

/** A booking as a caller holds it. touches and the checks before a booking's own never look at its kind's fields. */
const held = (id: string, revision: number, travellers: string[], kind = "flight"): Booking =>
  Object.freeze({ id, revision, travellers: Object.freeze(travellers), details: Object.freeze({}), kind });

describe("malformed", () => {
  test("a booking or a change not in the form of §3.3", () => {
    for (const booking of [null, 3, [], {}, { kind: 3 }]) {
      assert.equal(refusal(check(booking as never)).code, "malformed", JSON.stringify(booking));
    }
    for (const change of [null, {}, { op: "fly" }, { op: "remove" }, { op: "remove", id: "a" }, { op: "remove", id: "a", base: "1" },
      { op: "remove", id: 1, base: 1 }, { op: "remove", id: "a", base: 1, extra: true }, { op: "add" }, { op: "change", booking: 3, base: 1 },
      { op: "toString", id: "a", base: 1 }]) {
      assert.equal(refusal(apply(held("a", 1, ["t1"]), change as never)).code, "malformed", JSON.stringify(change));
    }
  });

  test("text that is not the form of §5.1", () => {
    for (const source of ["not json", "[]", "{}", '{"op":"fly"}', '{"op":"remove","id":"a"}', '{"op":"remove","id":"a","base":1.5}']) {
      assert.equal(refusal(changeFromText(source)).code, "malformed", source);
    }
    for (const source of ["not json", "3", '{"kind":"flight","id":"a"}', '{"format":1,"kind":"plane","id":"a"}']) {
      assert.equal(refusal(bookingFromText(source)).code, "malformed", source);
    }
    assert.equal(refusal(bookingFromText(3 as never)).code, "malformed");
  });
});

describe("refusals of check and apply needing no kind", () => {
  test("unknown-kind", () => {
    const plane = { id: "a", revision: 0, travellers: ["t1"], details: {}, kind: "plane" } as Booking;
    const refused = refusal(check(plane));
    assert.equal(refused.code, "unknown-kind");
    assert.match(refused.message, /"plane"/);
    assert.equal(refusal(apply(undefined, { op: "add", booking: plane })).code, "unknown-kind");
  });

  test("duplicate-id: an add for a booking already held", () => {
    const refused = refusal(apply(held("a", 1, ["t1"]), { op: "add", booking: held("a", 0, ["t1"]) }));
    assert.equal(refused.code, "duplicate-id");
  });

  test("unknown-id: a change or a removal of a booking not held, or not the one held", () => {
    assert.equal(refusal(apply(undefined, { op: "remove", id: "a", base: 1 })).code, "unknown-id");
    assert.equal(refusal(apply(held("b", 1, ["t1"]), { op: "remove", id: "a", base: 1 })).code, "unknown-id");
    assert.equal(refusal(apply(undefined, { op: "change", booking: held("a", 1, ["t1"]), base: 1 })).code, "unknown-id");
    assert.equal(refusal(apply(held("b", 1, ["t1"]), { op: "change", booking: held("a", 1, ["t1"]), base: 1 })).code, "unknown-id");
  });

  test("kind-change: a change giving the booking another kind, checked before its base", () => {
    const refused = refusal(apply(held("a", 3, ["t1"], "flight"), { op: "change", booking: held("a", 3, ["t1"], "stay"), base: 1 }));
    assert.equal(refused.code, "kind-change");
    assert.match(refused.message, /keeps its kind/);
  });

  test("unknown-format", () => {
    assert.equal(refusal(bookingFromText('{"format":2,"kind":"flight"}')).code, "unknown-format");
    assert.equal(refusal(changeFromText('{"op":"add","booking":{"format":2}}')).code, "unknown-format");
  });
});

describe("the table of §4.2", () => {
  const flight = held("a", 3, ["t2", "t1"]);

  test("touches, for each change", () => {
    assert.deepEqual(touches(undefined, { op: "add", booking: flight }), { id: "a", before: [], after: ["t1", "t2"] });
    assert.deepEqual(touches(flight, { op: "change", booking: held("a", 3, ["t1"]), base: 3 }), { id: "a", before: ["t1", "t2"], after: ["t1"] });
    assert.deepEqual(touches(undefined, { op: "change", booking: flight, base: 3 }), { id: "a", before: [], after: ["t1", "t2"] });
    assert.deepEqual(touches(flight, { op: "remove", id: "a", base: 3 }), { id: "a", before: ["t1", "t2"], after: [] });
    assert.deepEqual(touches(undefined, { op: "remove", id: "a", base: 3 }), { id: "a", before: [], after: [] });
  });

  test("touches makes no check, and changes nothing", () => {
    const change: Change = { op: "add", booking: held("a", 0, ["t1", "t1"], "plane") };
    const given = touches(undefined, change);
    assert.deepEqual(given.after, ["t1", "t1"]);
    assert.ok(Object.isFrozen(given) && Object.isFrozen(given.after));
    assert.deepEqual(change.booking.travellers, ["t1", "t1"]);
  });

  test("remove, from the booking's revision, gives nothing", () => {
    const removed = apply(flight, { op: "remove", id: "a", base: 3 });
    assert.deepEqual(removed, { ok: true, value: undefined });
    assert.ok(Object.isFrozen(removed));
  });
});

describe("the text form of a change", () => {
  test("a removal reads back unchanged, and gives the same text each time", () => {
    const change: Change = { op: "remove", id: "5d1a", base: 2 };
    assert.equal(changeToText(change), '{"base":2,"id":"5d1a","op":"remove"}');
    assert.equal(changeToText(change), changeToText({ base: 2, id: "5d1a", op: "remove" } as Change));
    assert.deepEqual(ok(changeFromText(changeToText(change))), change);
  });
});

describe("order, onDate and notOver of no bookings", () => {
  test("each gives no bookings, frozen", () => {
    for (const given of [order([]), onDate([], "2026-12-01"), notOver([], exact(SANTIAGO, "2026-12-01", "10:00"))]) {
      assert.deepEqual(given, []);
      assert.ok(Object.isFrozen(given));
    }
  });
});
