// Each refusal of spec §3.3, each row of the table of §4.2, and the order of §4.3.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { apply, changeFromText, changeToText, newPages, page, pageFromText, pageToText, search, type Change, type Pages } from "../src/index.ts";
import { between, ORDER } from "../src/order.ts";
import { applyAll, chile, empty, ok, refusal, shape } from "./helpers.ts";

const code = (p: Pages, change: unknown) => refusal(apply(p, change as Change)).code;

describe("refusals", () => {
  test("malformed", () => {
    for (const change of [null, {}, { op: "fly", id: "x" }, { op: "rename", id: "chile" }, { op: "add", id: "x", title: "X" },
      { op: "add", id: "x", title: "X", at: { parent: 1 } }, { op: "write", id: "chile", text: "t", base: "1" }, { op: "bury", id: "chile", extra: true }]) {
      assert.equal(code(chile(), change), "malformed", JSON.stringify(change));
    }
    assert.equal(refusal(search(chile(), 3 as never)).code, "malformed");
    assert.equal(refusal(changeFromText("{}")).code, "malformed");
    assert.equal(refusal(pageFromText('{"format":1,"id":"a","trip":"t","revision":1,"order":"10","title":"A","text":""}')).code, "malformed");
  });
  test("bad-id", () => {
    assert.equal(refusal(newPages("trip 1", [])).code, "bad-id");
    assert.equal(refusal(newPages("t", [{ id: "", title: "Chile", country: "CL" }])).code, "bad-id");
    assert.equal(code(chile(), { op: "add", id: "a/b", title: "X", at: {} }), "bad-id");
  });
  test("bad-title, trimmed first", () => {
    assert.equal(refusal(newPages("t", [{ id: "cl", title: " ", country: "CL" }])).code, "bad-title");
    assert.equal(code(chile(), { op: "rename", id: "chile", title: "\t" }), "bad-title");
    const p = applyAll(chile(), { op: "rename", id: "chile", title: "  Chile  " });
    assert.equal(page(p, "chile")!.title, "Chile");
    ok(apply(chile(), { op: "rename", id: "chile", title: ` ${"é".repeat(200)} ` }));
  });
  test("text-length, counted in code points", () => {
    assert.equal(code(chile(), { op: "add", id: "x", title: "X", text: "a".repeat(100_001), at: {} }), "text-length");
    ok(apply(chile(), { op: "add", id: "x", title: "X", text: "😀".repeat(100_000), at: {} }));
  });
  test("duplicate-id, in the tree or the graveyard", () => {
    assert.equal(refusal(newPages("t", [{ id: "a", title: "A", country: "CL" }, { id: "a", title: "B", country: "AR" }])).code, "duplicate-id");
    assert.equal(code(chile(), { op: "add", id: "chile", title: "X", at: {} }), "duplicate-id");
    assert.equal(code(applyAll(chile(), { op: "bury", id: "eating" }), { op: "add", id: "eating", title: "X", at: {} }), "duplicate-id");
  });
  test("unknown-id", () => {
    for (const op of ["rename", "write", "move", "bury", "restore"]) {
      const change = { op, id: "nowhere", title: "X", text: "", base: 1, to: {} } as Record<string, unknown>;
      const keep: Record<string, string[]> = { rename: ["title"], write: ["text", "base"], move: ["to"], bury: [], restore: [] };
      const trimmed = Object.fromEntries(Object.entries(change).filter(([k]) => ["op", "id", ...keep[op]!].includes(k)));
      assert.equal(code(chile(), trimmed), "unknown-id", op);
    }
  });
  test("not-in-tree", () => {
    assert.equal(code(chile(), { op: "add", id: "x", title: "X", at: { parent: "nowhere" } }), "not-in-tree");
    assert.equal(code(chile(), { op: "add", id: "x", title: "X", at: { after: "nowhere" } }), "not-in-tree");
    assert.equal(code(applyAll(chile(), { op: "bury", id: "santiago" }), { op: "move", id: "chile", to: { after: "santiago" } }), "not-in-tree");
  });
  test("not-a-sibling", () => {
    assert.equal(code(chile(), { op: "add", id: "x", title: "X", at: { after: "santiago" } }), "not-a-sibling");
    assert.equal(code(chile(), { op: "add", id: "x", title: "X", at: { parent: "santiago", after: "chile" } }), "not-a-sibling");
  });
  test("cycle", () => {
    assert.equal(code(chile(), { op: "move", id: "chile", to: { parent: "chile" } }), "cycle");
    assert.equal(code(chile(), { op: "move", id: "chile", to: { parent: "santiago" } }), "cycle");
  });
  test("in-graveyard, for rename, write, move and bury", () => {
    const p = applyAll(chile(), { op: "bury", id: "santiago" });
    for (const change of [{ op: "rename", id: "santiago", title: "S" }, { op: "write", id: "eating", text: "", base: 1 }, { op: "move", id: "eating", to: {} }, { op: "bury", id: "eating" }, { op: "bury", id: "santiago" }]) {
      assert.equal(code(p, change), "in-graveyard", JSON.stringify(change));
    }
  });
  test("not-in-graveyard", () => assert.equal(code(chile(), { op: "restore", id: "santiago" }), "not-in-graveyard"));
  test("parent-in-graveyard, for a page in the graveyard only because a page above it was deleted", () => {
    const refused = refusal(apply(applyAll(chile(), { op: "bury", id: "chile" }), { op: "restore", id: "eating" }));
    assert.equal(refused.code, "parent-in-graveyard");
    assert.equal(refused.details?.page, "chile");
  });
  test("stale", () => assert.equal(code(chile(), { op: "write", id: "chile", text: "", base: 0 }), "stale"));
  test("no-words", () => assert.equal(refusal(search(chile(), " \n\t ")).code, "no-words"));
  test("unknown-format", () => assert.equal(refusal(pageFromText('{"format":2}')).code, "unknown-format"));
});

describe("§4.2 the table of changes", () => {
  test("every change writes exactly one record, with its revision one higher", () => {
    let p = chile();
    for (const change of [
      { op: "add", id: "x", title: "X", at: {} },
      { op: "rename", id: "santiago", title: "Stgo" },
      { op: "write", id: "santiago", text: "Hi", base: 2 },
      { op: "move", id: "santiago", to: {} },
      { op: "bury", id: "santiago" },
      { op: "restore", id: "santiago" },
    ] as Change[]) {
      const before = p.pages.find((q) => q.id === change.id);
      const applied = ok(apply(p, change));
      assert.equal(applied.written.length, 1);
      assert.equal(applied.written[0]!.revision, before ? before.revision + 1 : 1);
      const changed = applied.pages.pages.filter((q) => pageToText(q) !== pageToText(p.pages.find((r) => r.id === q.id) ?? q) || !p.pages.some((r) => r.id === q.id));
      assert.deepEqual(changed, applied.written);
      p = applied.pages;
    }
  });
  test("an added page with no text has empty text, and text is kept with nothing trimmed", () => {
    assert.equal(page(applyAll(empty(), { op: "add", id: "a", title: "A", at: {} }), "a")!.text, "");
    assert.equal(page(applyAll(empty(), { op: "add", id: "a", title: "A", text: "  x \n", at: {} }), "a")!.text, "  x \n");
  });
  test("a branch of any size is deleted by writing one record", () => {
    const applied = ok(apply(chile(), { op: "bury", id: "chile" }));
    assert.deepEqual(applied.written.map((w) => w.id), ["chile"]);
    assert.equal(applied.written[0]!.buried, 1);
  });
  test("bury sets buried one higher than any page holds", () => {
    const p = applyAll(chile(), { op: "bury", id: "eating" }, { op: "bury", id: "santiago" });
    assert.deepEqual([page(p, "eating")!.buried, page(p, "santiago")!.buried], [1, 2]);
  });
  test("a page moved after itself keeps its place, and its record is still written", () => {
    const p = applyAll(chile(), { op: "add", id: "w", title: "W", at: { parent: "chile", after: "santiago" } });
    const applied = ok(apply(p, { op: "move", id: "santiago", to: { parent: "chile", after: "santiago" } }));
    assert.equal(applied.written[0]!.order, page(p, "santiago")!.order);
    assert.deepEqual(shape(applied.pages), shape(p));
  });
  test("pages are ordered by id, and frozen; apply leaves its argument as it was", () => {
    const p = chile();
    const after = applyAll(p, { op: "rename", id: "chile", title: "Chili" });
    assert.deepEqual(after.pages.map((x) => x.id), ["chile", "eating", "santiago"]);
    assert.equal(page(p, "chile")!.title, "Chile");
    for (const v of [after, after.pages, after.pages[0]]) assert.ok(Object.isFrozen(v));
  });
});

describe("§4.3 the order of pages under a parent", () => {
  test("the shortest order between two neighbours, the lower of equally short ones", () => {
    assert.equal(between(undefined, undefined), "1");
    assert.equal(between("1", undefined), "2");
    assert.equal(between(undefined, "1"), "01");
    assert.equal(between("1", "2"), "11");
    assert.equal(between("1", "3"), "2");
    assert.equal(between("z", undefined), "z1");
    assert.equal(between("a", "a1"), "a01");
    assert.equal(between("0z", "1"), "0z1");
  });
  test("a thousand pages, each placed before the last, keep every order in the form of §4.3", () => {
    let p = applyAll(empty(), { op: "add", id: "p0", title: "P0", at: {} });
    for (let i = 1; i <= 1000; i++) p = applyAll(p, { op: "add", id: `p${i}`, title: `P${i}`, at: {} });
    for (const q of p.pages) assert.match(q.order, ORDER);
    assert.deepEqual(shape(p), Array.from({ length: 1001 }, (_, i) => `P${1000 - i}`));
  });
  test("a thousand pages, each placed after the first, stay in order", () => {
    let p = applyAll(empty(), { op: "add", id: "first", title: "First", at: {} }, { op: "add", id: "last", title: "Last", at: { after: "first" } });
    for (let i = 0; i < 1000; i++) p = applyAll(p, { op: "add", id: `p${i}`, title: `P${i}`, at: { after: "first" } });
    for (const q of p.pages) assert.match(q.order, ORDER);
    const titles = shape(p);
    assert.equal(titles[0], "First");
    assert.equal(titles[1], "P999");
    assert.equal(titles[titles.length - 1], "Last");
  });
});

describe("§4.8 round trips", () => {
  test("a page with every field, and text holding every kind of character, reads back equal", () => {
    const text = 'A "quote", a \\ backslash, a\ttab, a\nline, \u0000 a nul, é and é, 漢字, 😀,  , </script>';
    const p = applyAll(
      ok(newPages("trip-1", [{ id: "cl", title: "Chile", country: "CL" }])),
      { op: "add", id: "x", title: "Every field", text, at: { parent: "cl" } },
      { op: "bury", id: "x" },
    );
    for (const written of p.pages) {
      const read = ok(pageFromText(pageToText(written)));
      assert.deepEqual(read, written);
      assert.equal(pageToText(read), pageToText(written));
    }
    assert.match(pageToText(page(p, "x")!), /^\{"buried":1,"format":1,"id":"x","order":"1","parent":"cl","revision":2,/);
  });
  test("every kind of change reads back from its text", () => {
    for (const change of [
      { op: "add", id: "a", title: "A", at: {} },
      { op: "add", id: "a", title: "A", text: "t", at: { parent: "p", after: "b" } },
      { op: "rename", id: "a", title: "B" },
      { op: "write", id: "a", text: "x", base: 3 },
      { op: "move", id: "a", to: { after: "b" } },
      { op: "bury", id: "a" },
      { op: "restore", id: "a" },
    ] as Change[]) {
      assert.deepEqual(ok(changeFromText(changeToText(change))), change);
    }
  });
});
