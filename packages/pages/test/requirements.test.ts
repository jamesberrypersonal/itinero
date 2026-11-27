// Every check in the verification of each requirement the pages component claims (spec §4.9, §7).
// The search of PLN:PAGES-NFR1 under two languages and time zones is in independence.test.ts.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  apply,
  beneath,
  countryPage,
  forPhone,
  graveyard,
  linkTarget,
  newPages,
  page,
  pageFromText,
  pageLink,
  pageToText,
  search,
  startingText,
  state,
  type Change,
} from "../src/index.ts";
import { applyAll, chile, empty, ok, refusal, shape } from "./helpers.ts";

describe("PLN:PAGES-F1 — the pages of a trip form a tree, which a caller rearranges freely", () => {
  test("Santiago moved to the top keeps Eating in Santiago under it", () => {
    const p = applyAll(chile(), { op: "move", id: "santiago", to: {} });
    assert.deepEqual(shape(p), ["Santiago", ["Eating in Santiago"], "Chile"]);
  });

  test("Chile moved under Eating in Santiago is refused, with the reason", () => {
    const refused = refusal(apply(chile(), { op: "move", id: "chile", to: { parent: "eating" } }));
    assert.equal(refused.code, "cycle");
    assert.match(refused.message, /under itself, or under a page beneath it/);
  });

  test("W trek added under Chile, then Santiago moved under Chile before it, reads Santiago, W trek", () => {
    const p = applyAll(
      chile(),
      { op: "add", id: "w-trek", title: "W trek", at: { parent: "chile", after: "santiago" } },
      { op: "move", id: "santiago", to: { parent: "chile" } },
    );
    assert.deepEqual(shape(p), ["Chile", ["Santiago", ["Eating in Santiago"], "W trek"]]);
    const q = applyAll(
      chile(),
      { op: "add", id: "w-trek", title: "W trek", at: { parent: "chile" } },
      { op: "move", id: "santiago", to: { parent: "chile" } },
    );
    assert.deepEqual(shape(q), ["Chile", ["Santiago", ["Eating in Santiago"], "W trek"]]);
  });

  test("Santiago renamed Santiago de Chile leaves the tree otherwise unchanged", () => {
    const p = applyAll(chile(), { op: "rename", id: "santiago", title: "Santiago de Chile" });
    assert.deepEqual(shape(p), ["Chile", ["Santiago de Chile", ["Eating in Santiago"]]]);
  });
});

describe("PLN:PAGES-F2 — a page's text is kept exactly as written, up to a limit on its length", () => {
  const one = () => applyAll(empty(), { op: "add", id: "p", title: "Notes", at: {} });

  test("text with a heading, a checklist, a table, a link and Chilean Spanish reads back unchanged", () => {
    const text = "# Santiago\n\n- [ ] Book the bus\n- [x] Get pesos\n\n| Day | Plan |\n|---|---|\n| 1 | Cerro San Cristóbal |\n\n[Metro](https://www.metro.cl)\n\n¿Cachai? Al tiro, po.  \n";
    const p = applyAll(one(), { op: "write", id: "p", text, base: 1 });
    assert.equal(page(p, "p")!.text, text);
  });

  test("text of exactly 100,000 characters is accepted", () => {
    ok(apply(one(), { op: "write", id: "p", text: "é".repeat(100_000), base: 1 }));
  });

  test("text of 100,001 characters, and a title of 201, are refused with the reason, and the page is unchanged", () => {
    const p = one();
    const before = pageToText(page(p, "p")!);
    const long = refusal(apply(p, { op: "write", id: "p", text: "a".repeat(100_001), base: 1 }));
    assert.equal(long.code, "text-length");
    assert.match(long.message, /100,000/);
    const title = refusal(apply(p, { op: "rename", id: "p", title: "t".repeat(201) }));
    assert.equal(title.code, "bad-title");
    assert.match(title.message, /200/);
    assert.equal(pageToText(page(p, "p")!), before);
  });
});

describe("PLN:PAGES-F3 — deleting a page moves it, with the pages beneath it, to the graveyard", () => {
  test("Santiago has one page beneath it", () => assert.equal(beneath(chile(), "santiago"), 1));

  test("deleting Santiago takes it and Eating in Santiago from the tree to the graveyard", () => {
    const p = applyAll(chile(), { op: "bury", id: "santiago" });
    assert.deepEqual(shape(p), ["Chile"]);
    assert.equal(state(p, "santiago"), "graveyard");
    assert.equal(state(p, "eating"), "graveyard");
  });

  test("renaming Eating in Santiago, and adding a page under it, are each refused, with the reason", () => {
    const p = applyAll(chile(), { op: "bury", id: "santiago" });
    const rename = refusal(apply(p, { op: "rename", id: "eating", title: "Food" }));
    assert.equal(rename.code, "in-graveyard");
    assert.match(rename.message, /graveyard/);
    const add = refusal(apply(p, { op: "add", id: "x", title: "X", at: { parent: "eating" } }));
    assert.equal(add.code, "not-in-tree");
    assert.match(add.message, /not in the tree/);
  });
});

describe("PLN:PAGES-F4 — the graveyard is listed with each page's title, and a restored page returns to its old parent", () => {
  const deleted = () => applyAll(chile("Try the empanadas"), { op: "add", id: "w-trek", title: "W trek", at: { parent: "chile", after: "santiago" } }, { op: "bury", id: "santiago" });

  test("the graveyard lists Santiago, with one page that went with it", () => {
    assert.deepEqual(graveyard(deleted()).map((b) => [b.page.title, b.went]), [["Santiago", 1]]);
  });

  test("Eating in Santiago reads as it was written", () => {
    const eating = page(deleted(), "eating")!;
    assert.equal(eating.title, "Eating in Santiago");
    assert.equal(eating.text, "Try the empanadas");
  });

  test("Santiago restored returns under Chile, in its old place, with Eating in Santiago beneath it", () => {
    const p = applyAll(deleted(), { op: "restore", id: "santiago" });
    assert.deepEqual(shape(p), ["Chile", ["Santiago", ["Eating in Santiago"], "W trek"]]);
    assert.deepEqual(graveyard(p), []);
  });

  test("Santiago deleted, then Chile: the graveyard lists Chile, and not Santiago", () => {
    const p = applyAll(chile(), { op: "bury", id: "santiago" }, { op: "bury", id: "chile" });
    assert.deepEqual(graveyard(p).map((b) => b.page.title), ["Chile"]);
  });

  test("Santiago restored then is refused, naming Chile", () => {
    const p = applyAll(chile(), { op: "bury", id: "santiago" }, { op: "bury", id: "chile" });
    const refused = refusal(apply(p, { op: "restore", id: "santiago" }));
    assert.equal(refused.code, "parent-in-graveyard");
    assert.equal(refused.details?.page, "chile");
    assert.match(refused.message, /Chile/);
  });

  test("Chile restored lists Santiago, and Santiago restored returns under Chile", () => {
    let p = applyAll(chile(), { op: "bury", id: "santiago" }, { op: "bury", id: "chile" }, { op: "restore", id: "chile" });
    assert.deepEqual(graveyard(p).map((b) => b.page.title), ["Santiago"]);
    p = applyAll(p, { op: "restore", id: "santiago" });
    assert.deepEqual(shape(p), ["Chile", ["Santiago", ["Eating in Santiago"]]]);
  });
});

describe("PLN:PAGES-F5 — a link names its page, and says whether the page is in the tree or the graveyard", () => {
  const link = pageLink("santiago", "the city");
  const target = () => linkTarget(/\]\(([^)]*)\)$/.exec(link)![1]!);

  test("a link to Santiago with the words \"the city\" reads back as naming Santiago", () => {
    assert.equal(link, "[the city](#page:santiago)");
    assert.equal(target(), "santiago");
  });

  test("the link is a standard Markdown inline link, which a Markdown reader such as GitHub's shows", () => {
    // CommonMark's inline link: [text](destination), with a destination holding no space or parenthesis.
    assert.match(link, /^\[[^\]]*\]\([^\s()]+\)$/);
  });

  test("Santiago renamed and moved to the top: the link still names it, in the tree", () => {
    const p = applyAll(chile(), { op: "rename", id: "santiago", title: "Stgo" }, { op: "move", id: "santiago", to: {} });
    assert.equal(state(p, target()!), "tree");
  });

  test("Santiago deleted: the link names a page in the graveyard", () => {
    assert.equal(state(applyAll(chile(), { op: "bury", id: "santiago" }), target()!), "graveyard");
  });

  test("a link naming a page the trip never held: the trip does not hold it", () => {
    assert.equal(state(chile(), linkTarget("#page:valparaiso")!), "absent");
  });
});

describe("PLN:PAGES-F6 — a new trip's pages can start with a page for each of its countries", () => {
  const start = () =>
    ok(
      newPages("trip-1", [
        { id: "cl", title: "Chile", country: "CL" },
        { id: "ar", title: "Argentina", country: "AR" },
      ]),
    );

  test("pages started with Chile, then Argentina, hold those two at the top, in that order", () => {
    assert.deepEqual(shape(start()), ["Chile", "Argentina"]);
  });

  test("the page Argentina is renamed, moved and deleted, each accepted", () => {
    applyAll(start(), { op: "rename", id: "ar", title: "Argentine" }, { op: "move", id: "ar", to: { parent: "cl" } }, { op: "bury", id: "ar" });
  });

  test("Chile renamed Chile and Patagonia, and moved under another page, is still the page made for Chile", () => {
    const p = applyAll(start(), { op: "rename", id: "cl", title: "Chile and Patagonia" }, { op: "move", id: "cl", to: { parent: "ar" } });
    assert.equal(countryPage(p, "CL")!.id, "cl");
    assert.equal(countryPage(p, "PE"), undefined);
  });

  test("pages started with no countries hold no page", () => assert.deepEqual(shape(empty()), []));
});

describe("PLN:PAGES-F7 — a search lists every page in the tree whose title or text holds the words", () => {
  const p = () => chile("Try the empanadas in Valparaíso");

  test("\"empanadas in\" lists Eating in Santiago, with the words around the match", () => {
    const hits = ok(search(p(), "empanadas in"));
    assert.deepEqual(hits.map((h) => h.page.id), ["eating"]);
    const a = hits[0]!.around[0]!;
    assert.equal(a.before + a.match + a.after, "Try the empanadas in Valparaíso");
    assert.equal(a.match, "empanadas in");
  });

  test("\"VALPARAISO\" lists the same page", () => {
    assert.deepEqual(ok(search(p(), "VALPARAISO")).map((h) => h.page.id), ["eating"]);
  });

  test("\"santiago\" lists Santiago, then Eating in Santiago", () => {
    assert.deepEqual(ok(search(p(), "santiago")).map((h) => h.page.id), ["santiago", "eating"]);
  });

  test("with Santiago deleted, \"empanadas\" lists no page", () => {
    assert.deepEqual(ok(search(applyAll(p(), { op: "bury", id: "santiago" }), "empanadas")), []);
  });

  test("a search for nothing but spaces is refused, with the reason", () => {
    const refused = refusal(search(p(), "   "));
    assert.equal(refused.code, "no-words");
    assert.match(refused.message, /no words/);
  });
});

describe("PLN:PAGES-F8 — each page is written in a stored form of its own, and read back unchanged", () => {
  test("every page of the trip, in its stored form, reads back equal", () => {
    for (const written of chile("Text").pages) assert.deepEqual(ok(pageFromText(pageToText(written))), written);
  });

  test("with Santiago deleted, the pages for a phone hold Chile only", () => {
    assert.deepEqual(forPhone(applyAll(chile(), { op: "bury", id: "santiago" })).pages.map((x) => x.id), ["chile"]);
  });

  test("a stored form that is not a page's is refused, with the reason", () => {
    for (const text of ["", "{}", "[1]", '{"op":"bury","id":"x"}', "page"]) {
      const refused = refusal(pageFromText(text));
      assert.equal(refused.code, "malformed", text);
      assert.ok(refused.message.length > 0);
    }
  });
});

describe("PLN:PAGES-F9 — a change gives the same pages wherever it is applied, and a refused change leaves them as they were", () => {
  const changes: Change[] = [
    { op: "add", id: "peru", title: "Peru", at: {} },
    { op: "add", id: "lima", title: "Lima", at: { parent: "peru" } },
    { op: "add", id: "cusco", title: "Cusco", at: { parent: "peru", after: "lima" } },
    { op: "write", id: "cusco", text: "Altitude!", base: 1 },
    { op: "move", id: "cusco", to: { parent: "peru" } },
    { op: "rename", id: "lima", title: "Lima, Peru" },
    { op: "move", id: "peru", to: { after: "chile" } },
    { op: "bury", id: "lima" },
    { op: "restore", id: "lima" },
    { op: "bury", id: "eating" },
  ];

  test("two copies that apply the same ten changes in the same order are equal", () => {
    const a = applyAll(chile(), ...changes);
    const b = applyAll(chile(), ...changes);
    assert.deepEqual(a, b);
    assert.deepEqual(a.pages.map(pageToText), b.pages.map(pageToText));
  });

  test("a page renamed twice keeps the second name", () => {
    const p = applyAll(chile(), { op: "rename", id: "chile", title: "Chili" }, { op: "rename", id: "chile", title: "Chile!" });
    assert.equal(page(p, "chile")!.title, "Chile!");
  });

  test("moving a page the trip does not hold is refused, with the reason, and every page is unchanged", () => {
    const p = chile();
    const before = p.pages.map(pageToText);
    const refused = refusal(apply(p, { op: "move", id: "bolivia", to: {} }));
    assert.equal(refused.code, "unknown-id");
    assert.match(refused.message, /bolivia/);
    assert.deepEqual(p.pages.map(pageToText), before);
  });
});

describe("PLN:PAGES-F10 — a rewrite made from an older version is refused, with the text as it stands", () => {
  const one = () => applyAll(empty(), { op: "add", id: "p", title: "Notes", at: {} });

  test("a rewrite from the first version is accepted, at the second", () => {
    assert.equal(page(applyAll(one(), { op: "write", id: "p", text: "A", base: 1 }), "p")!.revision, 2);
  });

  test("a rewrite again from the first version is refused, with the text the second holds", () => {
    const p = applyAll(one(), { op: "write", id: "p", text: "A", base: 1 });
    const refused = refusal(apply(p, { op: "write", id: "p", text: "B", base: 1 }));
    assert.equal(refused.code, "stale");
    assert.equal(refused.details?.text, "A");
    assert.equal(refused.details?.revision, "2");
  });

  test("a rewrite from the second version is accepted", () => {
    const p = applyAll(one(), { op: "write", id: "p", text: "A", base: 1 }, { op: "write", id: "p", text: "B", base: 2 });
    assert.equal(page(p, "p")!.text, "B");
  });
});

describe("PLN:PAGES-F11 — a new page starts with the headings a traveller researches under", () => {
  /** The headings of a page's Markdown, as a reader of Markdown such as GitHub's shows them: each with its level. */
  const headings = (markdown: string) =>
    markdown
      .split("\n")
      .filter((line) => line.startsWith("#"))
      .map((line) => {
        const heading = /^(#{1,6}) (\S.*)$/.exec(line);
        assert.ok(heading, `${JSON.stringify(line)} is not a heading`);
        return `${heading[1]!.length} ${heading[2]}`;
      });
  const forAPage = ["2 General Info", "2 Getting Around", "2 Things to Do", "2 Places to See", "2 Food to Eat", "3 Dishes to Try", "3 Where to Eat", "2 Nightlife"];
  const start = () => ok(newPages("trip-1", [{ id: "cl", title: "Chile", country: "CL" }]));

  test("a trip's pages started with Chile: Chile holds every heading, Dishes to Try and Where to Eat beneath Food to Eat, then Emergency Info", () => {
    assert.deepEqual(headings(page(start(), "cl")!.text), [...forAPage, "2 Emergency Info"]);
  });

  test("the text for a new page holds the same headings, without Emergency Info", () => {
    assert.deepEqual(headings(startingText("page")), forAPage);
    assert.deepEqual(headings(startingText("country")), [...forAPage, "2 Emergency Info"]);
  });

  test("each heading stands apart from the next, so every reader of Markdown shows it as a heading", () => {
    for (const text of [startingText("page"), startingText("country")]) {
      assert.match(text, /^## General Info\n\n## Getting Around\n\n/);
      assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"));
      assert.equal(text.split("\n\n").length, headings(text).length);
    }
  });

  test("Chile's text rewritten with Nightlife deleted is accepted, and reads back unchanged", () => {
    const text = page(start(), "cl")!.text.replace("## Nightlife\n\n", "");
    const p = applyAll(start(), { op: "write", id: "cl", text, base: 1 });
    assert.equal(page(p, "cl")!.text, text);
    assert.equal(ok(pageFromText(pageToText(page(p, "cl")!))).text, text);
    assert.ok(!headings(text).includes("2 Nightlife"));
  });
});
