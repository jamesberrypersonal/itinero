// Each refusal of spec §3.3, and each row of the table of changes in §4.2.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { apply, changeFromText, changeToText, countries, layout, newTrip, tripFromText, type Change, type Trip } from "../src/index.ts";
import { PARIS, addFirm, applyAll, day, exact, item, loadNewestRules, ok, pencil, refusal, stretch, time, trip } from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const code = (t: Trip, change: unknown) => refusal(apply(t, change as Change)).code;
const base = () =>
  applyAll(
    trip(),
    { op: "trip-dates", dates: { first: "2026-06-01", last: "2026-06-30" } },
    pencil(stretch("france", "FR", "2026-06-01", "2026-06-05")),
    addFirm(item("museum", "Museum", day("2026-06-04"))),
  );

describe("refusals", () => {
  test("malformed", () => {
    for (const change of [null, {}, { op: "fly" }, { op: "rename" }, { op: "rename", name: 3 }, { op: "rename", name: "x", extra: 1 },
      { op: "pencil", stretch: { id: "a", place: "FR", first: "2026-06-01", last: "2026-06-02" } },
      { op: "add-firm", item: { id: "a", title: "A", when: { kind: "day", date: "2026-06-01" } } },
      { op: "add-firm", item: { id: "a", revision: 0, title: "A", when: { kind: "day", date: "2026-06-01" }, travel: { from: { country: "FR" }, to: { country: "FR" }, by: "rocket" } } },
      { op: "change-firm", item: item("museum", "M", day("2026-06-04")), base: "1" }]) {
      assert.equal(code(base(), change), "malformed", JSON.stringify(change));
    }
    assert.equal(refusal(layout(base(), "June", "2026-06-02")).code, "invalid-date");
    assert.equal(refusal(changeFromText("{}")).code, "malformed");
    assert.equal(refusal(changeFromText("not json")).code, "malformed");
  });

  test("bad-id", () => {
    assert.equal(refusal(newTrip("", "Trip")).code, "bad-id");
    assert.equal(refusal(newTrip("has space", "Trip")).code, "bad-id");
    assert.equal(refusal(newTrip("x".repeat(65), "Trip")).code, "bad-id");
    assert.ok(newTrip("x".repeat(64), "Trip").ok);
    assert.equal(code(base(), pencil(stretch("é", "FR", "2026-06-01", "2026-06-02"))), "bad-id");
    assert.equal(code(base(), pencil(stretch("s", "FR", "2026-06-01", "2026-06-02", undefined, "a/b"))), "bad-id");
    assert.equal(code(base(), addFirm(item("i", "T", day("2026-06-01"), { page: "" }))), "bad-id");
    assert.equal(code(base(), { op: "traveller-dates", traveller: "u 1" }), "bad-id");
  });

  test("bad-text", () => {
    assert.equal(refusal(newTrip("t", "   ")).code, "bad-text");
    assert.equal(code(base(), { op: "rename", name: "" }), "bad-text");
    assert.equal(code(base(), { op: "rename", name: "x".repeat(201) }), "bad-text");
    assert.ok(apply(base(), { op: "rename", name: "x".repeat(200) }).ok);
    assert.equal(code(base(), addFirm(item("i", " ", day("2026-06-01")))), "bad-text");
    assert.equal(code(base(), { op: "re-place", id: "france", place: { country: "FR", name: "" } }), "bad-text");
  });

  test("invalid-date", () => {
    assert.equal(code(base(), pencil(stretch("s", "FR", "1969-12-31", "1970-01-02"))), "invalid-date");
    assert.equal(code(base(), { op: "move", id: "france", first: "2026-06-31", last: "2026-07-01" }), "invalid-date");
    assert.equal(code(base(), addFirm(item("i", "T", day("2026-02-29")))), "invalid-date");
    assert.equal(code(base(), { op: "trip-dates", dates: { first: "2026-06-01", last: "10000-01-01" } }), "invalid-date");
    assert.equal(refusal(layout(base(), "2026-06-01", "2026-06-31")).code, "invalid-date");
  });

  test("stretch-order", () => {
    assert.equal(code(base(), { op: "move", id: "france", first: "2026-06-05", last: "2026-06-04" }), "stretch-order");
    assert.equal(code(base(), { op: "trip-dates", dates: { first: "2026-06-05", last: "2026-06-04" } }), "stretch-order");
    assert.equal(code(base(), { op: "traveller-dates", traveller: "u", dates: { first: "2026-06-05", last: "2026-06-04" } }), "stretch-order");
    assert.ok(apply(base(), { op: "move", id: "france", first: "2026-06-05", last: "2026-06-05" }).ok);
  });

  test("stretch-length", () => {
    assert.equal(code(base(), { op: "move", id: "france", first: "2026-01-01", last: "2027-01-02" }), "stretch-length");
    assert.ok(apply(base(), { op: "move", id: "france", first: "2028-01-01", last: "2028-12-31" }).ok);
  });

  test("unknown-country", () => {
    assert.equal(code(base(), { op: "re-place", id: "france", place: { country: "fr" } }), "unknown-country");
    const travel = { from: { country: "FR" }, to: { country: "ZZ" }, by: "train" as const };
    assert.equal(code(base(), addFirm(item("i", "T", day("2026-06-01"), { travel }))), "unknown-country");
  });

  test("date-only", () => {
    assert.equal(code(base(), addFirm(item("i", "T", { kind: "date", zone: PARIS, date: "2026-06-01" }))), "date-only");
    const travel = { from: { country: "FR" }, to: { country: "FR" }, by: "car" as const, arrive: { kind: "tbd" as const, zone: PARIS, date: "2026-06-02" } };
    assert.equal(code(base(), addFirm(item("i", "T", day("2026-06-01"), { travel }))), "date-only");
  });

  test("duplicate-id, across stretches and firm items together", () => {
    assert.equal(code(base(), pencil(stretch("museum", "FR", "2026-06-01", "2026-06-02"))), "duplicate-id");
    assert.equal(code(base(), addFirm(item("france", "T", day("2026-06-01")))), "duplicate-id");
  });

  test("a removed identifier may be used again", () => {
    const t = applyAll(base(), { op: "remove-stretch", id: "france" });
    assert.ok(apply(t, addFirm(item("france", "T", day("2026-06-01")))).ok);
  });

  test("unknown-id", () => {
    for (const change of [
      { op: "move", id: "spain", first: "2026-06-01", last: "2026-06-02" },
      { op: "re-place", id: "spain", place: { country: "ES" } },
      { op: "remove-stretch", id: "museum" },
      { op: "remove-firm", id: "france" },
      { op: "change-firm", item: item("louvre", "L", day("2026-06-04")), base: 1 },
    ]) {
      assert.equal(code(base(), change), "unknown-id", JSON.stringify(change));
    }
  });

  test("travel-order, with a Day at either end", () => {
    const travel = (arrive: unknown) => ({ from: { country: "FR" }, to: { country: "FR" }, by: "train" as const, arrive }) as never;
    assert.equal(code(base(), addFirm(item("i", "T", day("2026-06-05"), { travel: travel(day("2026-06-04")) }))), "travel-order");
    assert.equal(code(base(), addFirm(item("i", "T", exact(PARIS, "2026-06-05", "10:00"), { travel: travel(day("2026-06-04")) }))), "travel-order");
    assert.ok(apply(base(), addFirm(item("i", "T", exact(PARIS, "2026-06-05", "10:00"), { travel: travel(day("2026-06-05")) }))).ok);
  });

  test("range-order and range-length", () => {
    assert.equal(refusal(layout(base(), "2026-06-02", "2026-06-01")).code, "range-order");
    assert.equal(refusal(layout(base(), "2026-01-01", "2027-01-02")).code, "range-length");
    assert.equal(ok(layout(base(), "2028-01-01", "2028-12-31")).length, 366);
  });

  test("outside-trip, also on a trip with no dates", () => {
    assert.equal(code(trip(), { op: "traveller-dates", traveller: "u", dates: { first: "2026-06-01", last: "2026-06-02" } }), "outside-trip");
    assert.equal(code(base(), { op: "traveller-dates", traveller: "u", dates: { first: "2026-06-10", last: "2026-07-01" } }), "outside-trip");
  });

  test("travellers-outside names every traveller outside, comma separated", () => {
    const t = applyAll(
      base(),
      { op: "traveller-dates", traveller: "u-b", dates: { first: "2026-06-01", last: "2026-06-03" } },
      { op: "traveller-dates", traveller: "u-a", dates: { first: "2026-06-02", last: "2026-06-30" } },
    );
    const refused = refusal(apply(t, { op: "trip-dates", dates: { first: "2026-06-04", last: "2026-06-29" } }));
    assert.equal(refused.code, "travellers-outside");
    assert.equal(refused.details?.travellers, "u-a,u-b");
  });

  test("stale", () => {
    assert.equal(code(base(), { op: "change-firm", item: item("museum", "M", day("2026-06-04")), base: 2 }), "stale");
  });

  test("unknown-format", () => {
    assert.equal(refusal(tripFromText('{"format":2}')).code, "unknown-format");
  });

  test("a refusal of trip-time's create is returned with its code unchanged", () => {
    const unknown = item("i", "T", { kind: "exact", zone: "Mars/Base", date: "2026-06-01", at: { time: "10:00" } });
    assert.equal(code(base(), addFirm(unknown)), "unknown-zone");
  });
});

describe("§4.2 the table of changes", () => {
  test("rename sets the trip's name", () => assert.equal(applyAll(base(), { op: "rename", name: "July" }).name, "July"));

  test("traveller-dates with no dates removes the traveller's entry, and is never refused with outside-trip", () => {
    const t = applyAll(base(), { op: "traveller-dates", traveller: "u", dates: { first: "2026-06-02", last: "2026-06-03" } });
    assert.equal(t.travellers.length, 1);
    assert.equal(applyAll(t, { op: "traveller-dates", traveller: "u" }).travellers.length, 0);
    assert.ok(apply(trip(), { op: "traveller-dates", traveller: "u" }).ok);
  });

  test("travellers are ordered by traveller", () => {
    const t = applyAll(
      base(),
      { op: "traveller-dates", traveller: "u-b", dates: { first: "2026-06-02", last: "2026-06-03" } },
      { op: "traveller-dates", traveller: "u-a", dates: { first: "2026-06-02", last: "2026-06-03" } },
    );
    assert.deepEqual(t.travellers.map((x) => x.traveller), ["u-a", "u-b"]);
  });

  test("pencil and add-firm add after those the trip holds; add-firm sets revision 1", () => {
    const t = applyAll(base(), pencil(stretch("spain", "ES", "2026-05-01", "2026-05-02")), addFirm({ ...item("bus", "Bus", day("2026-06-02")), revision: 99 }));
    assert.deepEqual(t.stretches.map((s) => s.id), ["france", "spain"]);
    assert.deepEqual(t.firm.map((f) => [f.id, f.revision]), [["museum", 1], ["bus", 1]]);
  });

  test("re-place sets the stretch's place", () => {
    assert.deepEqual(applyAll(base(), { op: "re-place", id: "france", place: { country: "FR", name: "Nice" } }).stretches[0]!.place, { country: "FR", name: "Nice" });
  });

  test("change-firm keeps the item's place in the list, and raises its revision", () => {
    const t = applyAll(base(), addFirm(item("bus", "Bus", day("2026-06-02"))), { op: "change-firm", item: { ...item("museum", "Louvre", day("2026-06-04")), revision: 50 }, base: 1 });
    assert.deepEqual(t.firm.map((f) => [f.id, f.title, f.revision]), [["museum", "Louvre", 2], ["bus", "Bus", 1]]);
  });

  test("a trip and its values are frozen, and apply leaves its argument as it was", () => {
    const t = base();
    const after = applyAll(t, { op: "rename", name: "July" });
    assert.equal(t.name, "June 2026");
    for (const v of [after, after.stretches, after.firm, after.stretches[0], after.firm[0]]) assert.ok(Object.isFrozen(v));
  });
});

describe("§4.7 the text form of a change", () => {
  test("every kind of change reads back from its text unchanged", () => {
    const changes: Change[] = [
      { op: "rename", name: "July" },
      { op: "trip-dates", dates: { first: "2026-06-01", last: "2026-06-30" } },
      { op: "traveller-dates", traveller: "u", dates: { first: "2026-06-01", last: "2026-06-02" } },
      { op: "traveller-dates", traveller: "u" },
      pencil(stretch("s", "FR", "2026-06-01", "2026-06-02", "Paris", "p")),
      { op: "move", id: "s", first: "2026-06-03", last: "2026-06-04" },
      { op: "re-place", id: "s", place: { country: "ES" } },
      { op: "remove-stretch", id: "s" },
      addFirm({ ...item("i", "T", time({ kind: "approx", zone: PARIS, date: "2026-06-01", at: { time: "14:00" } })), revision: 1 }),
      { op: "change-firm", item: { ...item("i", "T", day("2026-06-01")), revision: 1 }, base: 1 },
      { op: "remove-firm", id: "i" },
    ];
    for (const change of changes) {
      assert.deepEqual(ok(changeFromText(changeToText(change))), change, changeToText(change));
    }
  });
});

describe("§5.2 the list of countries", () => {
  test("every code ISO 3166-1 assigns officially, in the order of their names", () => {
    const list = countries();
    assert.equal(list.length, 249);
    assert.equal(new Set(list.map((c) => c.code)).size, 249);
    for (const c of list) assert.match(c.code, /^[A-Z]{2}$/);
    assert.deepEqual(list.find((c) => c.code === "FR"), { code: "FR", name: "France" });
    assert.equal(list[0]!.name, "Afghanistan");
    assert.equal(list[list.length - 1]!.name, "Zimbabwe");
  });
});
