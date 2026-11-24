// Every check in the verification of each requirement planner/library claims, each refusal of
// docs/spec/planner/library.md §3.2, and its isolation, race and cost tests (§4.6).

import { afterEach, describe, expect, test } from "vitest";
import { apply, changeToText, checklistFromText, checklistToText, copyChecklist, newChecklist, placeAfter, type Change, type Checklist } from "@itinero/checklists";
import { MAX_TEMPLATES, setMeter } from "../src/library.ts";
import { api, expectRefused, json, rows, signIn, type SignedIn } from "./helpers.ts";

type Synced = { sequence: number; templates: { id: string; changed: number; template?: string }[] };

let count = 0;
async function traveller(name: string): Promise<SignedIn> {
  count++;
  return signIn({ sub: `library-${count}`, email: `${name.toLowerCase()}${count}@example.com`, name, emailVerified: true });
}

const add = (who: SignedIn, body: unknown) => api("/api/library/templates", { method: "POST", session: who.session, body });
const change = (who: SignedIn, c: Change | string) =>
  api("/api/library/changes", { method: "POST", session: who.session, body: { change: typeof c === "string" ? c : changeToText(c) } });
const remove = (who: SignedIn, id: string) => api(`/api/library/templates/${id}`, { method: "DELETE", session: who.session });
const syncOf = async (who: SignedIn, since?: number) =>
  json<Synced>(await api("/api/library/sync", { method: "POST", session: who.session, body: since === undefined ? {} : { since } }));

/** The library as a device holds it after catching up from the start: each template, in order. */
async function library(who: SignedIn): Promise<Checklist[]> {
  return (await syncOf(who)).templates.map((t) => {
    const read = checklistFromText(t.template!);
    if (!read.ok) throw new Error(read.refusal.message);
    return read.value;
  });
}
const titles = async (who: SignedIn) => (await library(who)).map((t) => t.title);
const template = async (who: SignedIn, id: string) => (await library(who)).find((t) => t.id === id)!;

async function made(response: Response): Promise<number> {
  expect(response.status).toBe(201);
  return (await json<{ sequence: number }>(response)).sequence;
}

/** A checklist of the traveller's own on a trip, Packing, with two of its three items ticked. */
function packing(owner: string): Checklist {
  let c = newChecklist("packing-trip", owner, "Packing", [], "trip-chile");
  if (!c.ok) throw new Error(c.refusal.message);
  let checklist = c.value;
  const changes: Change[] = [
    { op: "add", checklist: "packing-trip", item: "a", text: "Charger" },
    { op: "add", checklist: "packing-trip", item: "b", text: "Adaptor", after: "a" },
    { op: "add", checklist: "packing-trip", item: "c", text: "Boots", after: "b" },
    { op: "tick", checklist: "packing-trip", item: "a", ticked: true },
    { op: "tick", checklist: "packing-trip", item: "b", ticked: true },
  ];
  for (const ch of changes) {
    const next = apply(checklist, ch);
    if (!next.ok) throw new Error(next.refusal.message);
    checklist = next.value;
  }
  return checklist;
}

afterEach(() => setMeter(undefined));

describe("PLN:LIBRARY-F1 — a traveller adds a template to their library, empty or copied from a checklist of their own", () => {
  test("an empty template, then a copy of Packing with no item ticked, after it", async () => {
    const t = await traveller("Ana");
    await made(await add(t, { id: "before", title: "Before leaving" }));
    expect(await titles(t)).toEqual(["Before leaving"]);
    await made(await add(t, { id: "packing", from: checklistToText(packing(t.account)) }));
    expect(await titles(t)).toEqual(["Before leaving", "Packing"]);
    const copy = await template(t, "packing");
    expect(copy.items.map((i) => i.text)).toEqual(["Charger", "Adaptor", "Boots"]);
    expect(copy.items.every((i) => i.ticked === undefined)).toBe(true);
    expect(copy.trip).toBeUndefined();
    expect(copy.owner).toBe(t.account);
  });

  test("a copy of another traveller's checklist is refused, with the reason", async () => {
    const t = await traveller("Ana");
    const other = await traveller("Ben");
    await expectRefused(await add(t, { id: "packing", from: checklistToText(packing(other.account)) }), 403, "not-yours");
    expect(await titles(t)).toEqual([]);
  });
});

describe("PLN:LIBRARY-F2 — a change is applied only to a template of the traveller's own", () => {
  async function two(): Promise<SignedIn> {
    const t = await traveller("Ana");
    await made(await add(t, { id: "before", title: "Before leaving" }));
    await made(await add(t, { id: "packing", from: checklistToText(packing(t.account)) }));
    return t;
  }

  test("Travel insurance added to Before leaving is held", async () => {
    const t = await two();
    expect((await change(t, { op: "add", checklist: "before", item: "ins", text: "Travel insurance" })).status).toBe(200);
    expect((await template(t, "before")).items.map((i) => i.text)).toEqual(["Travel insurance"]);
  });

  test("Packing moved before Before leaving is listed first", async () => {
    const t = await two();
    const placed = placeAfter(await library(t), "packing");
    expect(placed.ok).toBe(true);
    expect((await change(t, (placed as { value: Change }).value)).status).toBe(200);
    expect(await titles(t)).toEqual(["Packing", "Before leaving"]);
  });

  test("another traveller's rename is refused as for a template nobody holds, and changes nothing", async () => {
    const t = await two();
    const other = await traveller("Ben");
    const before = await template(t, "before");
    const theirs = await expectRefused(await change(other, { op: "rename", checklist: "before", title: "Mine now" }), 404, "unknown-template");
    const nobody = await expectRefused(await change(other, { op: "rename", checklist: "nowhere", title: "Mine now" }), 404, "unknown-template");
    expect(theirs).toBe(nobody);
    expect(await template(t, "before")).toEqual(before);
  });

  test("ticking an item of Before leaving is refused, with the reason, and changes nothing", async () => {
    const t = await two();
    await change(t, { op: "add", checklist: "before", item: "ins", text: "Travel insurance" });
    const before = await syncOf(t);
    await expectRefused(await change(t, { op: "tick", checklist: "before", item: "ins", ticked: true }), 409, "template-tick");
    expect(await syncOf(t)).toEqual(before);
  });
});

describe("PLN:LIBRARY-F3 — a traveller deletes a template for good", () => {
  test("a deleted template is gone, a checklist copied from it is unchanged, and a second delete is refused", async () => {
    const t = await traveller("Ana");
    await made(await add(t, { id: "before", title: "Before leaving" }));
    await change(t, { op: "add", checklist: "before", item: "pass", text: "Passport valid for six months" });
    const copied = copyChecklist(await template(t, "before"), "on-trip", [], "trip-chile");
    expect(copied.ok).toBe(true);
    const onTrip = checklistToText((copied as { value: Checklist }).value);
    expect((await remove(t, "before")).status).toBe(200);
    expect(await titles(t)).toEqual([]);
    expect(await rows(`templates WHERE account = '${t.account}'`)).toBe(0);
    expect(checklistToText((copied as { value: Checklist }).value)).toBe(onTrip);
    await expectRefused(await remove(t, "before"), 404, "unknown-template");
  });
});

describe("PLN:LIBRARY-F4 — each of a traveller's devices catches up on every template that changed while it was away", () => {
  test("a second device takes an add, a change and a delete, then nothing more, and a third takes the whole library", async () => {
    const t = await traveller("Ana");
    for (const [id, title] of [["a", "Before leaving"], ["b", "Packing"], ["c", "Last day"]]) await made(await add(t, { id, title }));
    const second = await syncOf(t);
    await made(await add(t, { id: "d", title: "Flying" }));
    await change(t, { op: "rename", checklist: "b", title: "Packing for Chile" });
    await remove(t, "c");

    const caught = await syncOf(t, second.sequence);
    expect(caught.templates.map((x) => [x.id, x.template !== undefined])).toEqual([["a", false], ["b", true], ["d", true]]);
    // The device keeps a, takes b and d, and drops c, which is no longer listed.
    const held = new Map(second.templates.map((x) => [x.id, x.template!]));
    for (const id of held.keys()) if (!caught.templates.some((x) => x.id === id)) held.delete(id);
    for (const x of caught.templates) if (x.template) held.set(x.id, x.template);
    const first = await syncOf(t);
    expect([...held.entries()].sort()).toEqual(first.templates.map((x) => [x.id, x.template!]).sort());

    const again = await syncOf(t, caught.sequence);
    expect(again.templates.every((x) => x.template === undefined)).toBe(true);
    expect(again.sequence).toBe(caught.sequence);

    const third = await syncOf(t);
    expect(third.templates.every((x) => x.template !== undefined)).toBe(true);
    expect(third.templates).toHaveLength(3);
  });

  test("a traveller with no library is given a sequence of 0 and no template, and nothing is written", async () => {
    const t = await traveller("Ana");
    expect(await syncOf(t)).toEqual({ sequence: 0, templates: [] });
    expect(await rows(`libraries WHERE account = '${t.account}'`)).toBe(0);
  });
});

describe("PLN:LIBRARY-F5 — a traveller's library holds at most 100 templates", () => {
  test("the 101st is refused, with the reason, and one more is accepted once one is deleted", async () => {
    const t = await traveller("Ana");
    for (let n = 0; n < MAX_TEMPLATES; n++) await made(await add(t, { id: `t${n}`, title: `Template ${n}` }));
    expect(await expectRefused(await add(t, { id: "one-more", title: "One more" }), 409, "library-full")).toMatch(/100/);
    await remove(t, "t0");
    await made(await add(t, { id: "one-more", title: "One more" }));
  });
});

describe("PLN:LIBRARY-NFR1 — nothing of a library leaves the library except to its traveller", () => {
  test("a traveller with an empty library is given nothing of another's, and every request about it is refused as for nobody's", async () => {
    const owner = await traveller("Ana");
    await made(await add(owner, { id: "before", title: "Before leaving" }));
    const other = await traveller("Ben");
    expect(await syncOf(other)).toEqual({ sequence: 0, templates: [] });
    const nobody = await expectRefused(await remove(other, "nowhere"), 404, "unknown-template");
    expect(await expectRefused(await change(other, { op: "rename", checklist: "before", title: "X" }), 404, "unknown-template")).toBe(nobody);
    expect(await expectRefused(await remove(other, "before"), 404, "unknown-template")).toBe(nobody);
    expect(await titles(owner)).toEqual(["Before leaving"]);
  });

  test("a request with no session is refused", async () => {
    for (const [path, method] of [["/api/library/sync", "POST"], ["/api/library/templates", "POST"], ["/api/library/changes", "POST"], ["/api/library/templates/x", "DELETE"]]) {
      await expectRefused(await api(path!, { method: method!, body: {} }), 401, "no-session");
    }
  });
});

describe("the refusals of §3.2", () => {
  test("malformed bodies", async () => {
    const t = await traveller("Ana");
    for (const body of [{}, { id: "a" }, { id: "a", title: "A", from: "{}" }, { id: 1, title: "A" }, { id: "a", title: "A", extra: 1 }]) {
      await expectRefused(await add(t, body), 400, "malformed");
    }
    await expectRefused(await api("/api/library/changes", { method: "POST", session: t.session, body: { change: 3 } }), 400, "malformed");
    await expectRefused(await change(t, "not a change"), 400, "malformed");
    await expectRefused(await api("/api/library/sync", { method: "POST", session: t.session, body: { since: -1 } }), 400, "malformed");
  });

  test("duplicate-template, and the checklists' own refusals, with status 409", async () => {
    const t = await traveller("Ana");
    await made(await add(t, { id: "before", title: "Before leaving" }));
    await expectRefused(await add(t, { id: "before", title: "Again" }), 409, "duplicate-template");
    await expectRefused(await add(t, { id: "blank", title: "   " }), 409, "bad-title");
    await expectRefused(await add(t, { id: "a b", title: "Spaces" }), 409, "bad-id");
    await expectRefused(await change(t, { op: "remove", checklist: "before", item: "nowhere" }), 409, "unknown-item");
  });

  test("two templates of the same identifier in two libraries stand apart", async () => {
    const a = await traveller("Ana");
    const b = await traveller("Ben");
    await made(await add(a, { id: "before", title: "Ana's" }));
    await made(await add(b, { id: "before", title: "Ben's" }));
    expect(await titles(a)).toEqual(["Ana's"]);
    expect(await titles(b)).toEqual(["Ben's"]);
  });
});

describe("races (§4.6)", () => {
  test("twenty changes sent at once to one library are each applied, with a sequence of its own", async () => {
    const t = await traveller("Ana");
    await made(await add(t, { id: "before", title: "Before leaving" }));
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, n) => change(t, { op: "add", checklist: "before", item: `i${n}`, text: `Item ${n}` })),
    );
    const sequences: number[] = [];
    for (const r of responses) {
      if (r.status === 200) sequences.push((await json<{ sequence: number }>(r)).sequence);
      else await expectRefused(r, 409, "busy");
    }
    expect(new Set(sequences).size).toBe(sequences.length);
    expect((await template(t, "before")).items).toHaveLength(sequences.length);
    expect((await syncOf(t)).sequence).toBe(1 + sequences.length);
  });
});

describe("cost (PLN:LIBRARY-NFR2)", () => {
  test("ten travellers' day, with 50 templates and three devices each, stays within the free plan", async () => {
    const t = await traveller("Ana");
    for (let n = 0; n < 50; n++) await made(await add(t, { id: `t${n}`, title: `Template ${n}` }));
    let read = 0;
    let written = 0;
    setMeter((meta) => {
      read += meta.rows_read;
      written += meta.rows_written;
    });
    const { sequence } = await syncOf(t);
    await syncOf(t, sequence);
    const perSync = read / 2;
    read = 0;
    await change(t, { op: "rename", checklist: "t1", title: "Renamed" });
    const perChange = { read, written };
    setMeter(undefined);
    // Each traveller: three devices catching up thirty times a day, and ten changes a day.
    const day = { read: 10 * (3 * 30 * perSync + 10 * perChange.read), written: 10 * 10 * perChange.written };
    expect(perSync).toBeLessThanOrEqual(60);
    expect(day.read).toBeLessThan(5_000_000);
    expect(day.written).toBeLessThan(100_000);
  });
});
