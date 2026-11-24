// planner/library: each traveller's library of checklist templates, outside any trip, in two tables
// of the online side's D1 database. docs/spec/planner/library.md specifies it, and its sections are
// cited.

import { env } from "cloudflare:workers";
import { apply, changeFromText, checklistFromText, checklistToText, copyChecklist, newChecklist, ordered, type Checklist } from "@itinero/checklists";
import type { AccountId } from "./accounts.ts";
import { defaultTemplates } from "./defaults.ts";
import { accept, type Refusal, type Result } from "./result.ts";

/** A library holds at most this many templates (PLN:LIBRARY-F5). */
export const MAX_TEMPLATES = 100;
/** A request whose write loses a race this many times running is refused with `busy` (§4). */
const TRIES = 3;

export type Synced = { sequence: number; templates: { id: string; changed: number; template?: string }[] };

const refuse = <T>(code: string, message: string): Result<T> => ({ ok: false, refusal: { code, message } });
const unknown = <T>() => refuse<T>("unknown-template", "Your library holds no such template.");
const passOn = <T>(refusal: Refusal): Result<T> => ({ ok: false, refusal: { code: refusal.code, message: refusal.message } });

/** What D1 reports for each statement, for the cost tests of §4.7. Unset outside them. */
let meter: ((meta: D1Meta) => void) | undefined;
export function setMeter(next: ((meta: D1Meta) => void) | undefined): void {
  meter = next;
}
function metered<T>(results: D1Result<T>[]): D1Result<T>[] {
  for (const r of results) meter?.(r.meta);
  return results;
}

const sequenceOf = (account: AccountId) => env.DB.prepare("SELECT sequence FROM libraries WHERE account = ?1").bind(account);
/** A condition that holds only where the library's sequence is still the one read, bound at ?n (§4). */
const still = (n: number) => `(SELECT sequence FROM libraries WHERE account = ?1) = ?${n}`;

/**
 * Makes the account's library, holding the default templates, with a sequence of 1 (§4.6). The
 * batch inserts the templates only while the library is still missing, then makes its row, so two
 * requests making it at once give it the defaults once.
 */
async function make(account: AccountId): Promise<void> {
  const missing = "NOT EXISTS (SELECT 1 FROM libraries WHERE account = ?1)";
  metered(
    await env.DB.batch([
      ...defaultTemplates(account).map((t) =>
        env.DB.prepare(`INSERT INTO templates (account, id, changed, ord, text) SELECT ?1, ?2, 1, ?3, ?4 WHERE ${missing}`)
          .bind(account, t.id, t.order, checklistToText(t)),
      ),
      env.DB.prepare("INSERT OR IGNORE INTO libraries (account, sequence) VALUES (?1, 1)").bind(account),
    ]),
  );
}

/**
 * Reads the library, plans a write guarded by the sequence read, and runs it in one batch that
 * raises the sequence last (§4). Where the sequence moved in between, it reads again.
 */
async function write(account: AccountId, plan: (sequence: number) => Promise<Result<D1PreparedStatement[]>>): Promise<Result<{ sequence: number }>> {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    let read = await sequenceOf(account).first<{ sequence: number }>();
    // A library is made by the first request that uses it (§4).
    if (read === null) {
      await make(account);
      read = await sequenceOf(account).first<{ sequence: number }>();
    }
    const sequence = read!.sequence;
    const planned = await plan(sequence);
    if (!planned.ok) return planned;
    const raise = env.DB.prepare("UPDATE libraries SET sequence = ?2 WHERE account = ?1 AND sequence = ?3").bind(account, sequence + 1, sequence);
    const results = metered(await env.DB.batch([...planned.value, raise]));
    if (results.at(-1)!.meta.changes === 1) return accept({ sequence: sequence + 1 });
  }
  return refuse("busy", "Your library changed while this was being saved, three times running. Try again.");
}

/** Every template's identifier and order, for placing a new one (§4.2). */
async function placed(account: AccountId): Promise<{ id: string; order: string }[]> {
  const rows = await env.DB.prepare('SELECT id, ord AS "order" FROM templates WHERE account = ?1').bind(account).all<{ id: string; order: string }>();
  meter?.(rows.meta);
  return rows.results;
}

async function held(account: AccountId, id: string): Promise<string | undefined> {
  const row = await env.DB.prepare("SELECT text FROM templates WHERE account = ?1 AND id = ?2").bind(account, id).first<{ text: string }>();
  return row?.text;
}

function insert(account: AccountId, template: Checklist, sequence: number): D1PreparedStatement {
  return env.DB.prepare(`INSERT INTO templates (account, id, changed, ord, text) SELECT ?1, ?2, ?3, ?4, ?5 WHERE ${still(6)}`)
    .bind(account, template.id, sequence + 1, template.order, checklistToText(template), sequence);
}

// §4.2 Adding a template.

export async function addTemplate(account: AccountId, body: Record<string, unknown>): Promise<Result<{ sequence: number }>> {
  const { id, title, from } = body;
  const keys = Object.keys(body);
  if (typeof id !== "string" || (title === undefined) === (from === undefined) || keys.some((k) => !["id", "title", "from"].includes(k))) {
    return refuse("malformed", "A new template needs its identifier, and either a title or a checklist to copy.");
  }
  if (title !== undefined && typeof title !== "string") return refuse("malformed", "A new template's title is text.");
  if (from !== undefined && typeof from !== "string") return refuse("malformed", "The checklist copied is in the checklists' text form.");
  let source: Checklist | undefined;
  if (from !== undefined) {
    const read = checklistFromText(from as string);
    if (!read.ok) return passOn(read.refusal);
    if (read.value.owner !== account) return refuse("not-yours", "The checklist copied belongs to another traveller.");
    source = read.value;
  }
  return write(account, async (sequence) => {
    const list = await placed(account);
    if (list.length >= MAX_TEMPLATES) return refuse("library-full", `Your library already holds ${MAX_TEMPLATES} templates. Delete one first.`);
    if (list.some((t) => t.id === id)) return refuse("duplicate-template", "Your library already holds a template of that identifier.");
    const made = source ? copyChecklist(source, id, list) : newChecklist(id, account, title as string, list);
    if (!made.ok) return passOn(made.refusal);
    return accept([insert(account, made.value, sequence)]);
  });
}

// §4.3 Changing a template.

export async function changeTemplate(account: AccountId, body: Record<string, unknown>): Promise<Result<{ sequence: number }>> {
  if (typeof body.change !== "string" || Object.keys(body).length !== 1) return refuse("malformed", "A change to a template is sent as its text, alone.");
  const change = changeFromText(body.change);
  if (!change.ok) return passOn(change.refusal);
  return write(account, async (sequence) => {
    const text = await held(account, change.value.checklist);
    if (text === undefined) return unknown();
    const template = checklistFromText(text);
    if (!template.ok) return passOn(template.refusal);
    const changed = apply(template.value, change.value);
    if (!changed.ok) return passOn(changed.refusal);
    const next = changed.value;
    return accept([
      env.DB.prepare(`UPDATE templates SET text = ?3, ord = ?4, changed = ?5 WHERE account = ?1 AND id = ?2 AND ${still(6)}`)
        .bind(account, next.id, checklistToText(next), next.order, sequence + 1, sequence),
    ]);
  });
}

// §4.5 Deleting a template.

export async function deleteTemplate(account: AccountId, id: string): Promise<Result<{ sequence: number }>> {
  return write(account, async (sequence) => {
    if ((await held(account, id)) === undefined) return unknown();
    return accept([env.DB.prepare(`DELETE FROM templates WHERE account = ?1 AND id = ?2 AND ${still(3)}`).bind(account, id, sequence)]);
  });
}

// §4.4 Catching a device up.

export async function sync(account: AccountId, since: number | undefined): Promise<Synced> {
  const after = since ?? 0;
  const read = async () =>
    metered(
      await env.DB.batch<Record<string, unknown>>([
        sequenceOf(account),
        env.DB.prepare('SELECT id, changed, ord AS "order", CASE WHEN changed > ?2 THEN text END AS text FROM templates WHERE account = ?1').bind(account, after),
      ]),
    );
  let [sequence, rows] = await read();
  // A library is made by the first request that uses it, a catch-up included (§4).
  if (sequence!.results.length === 0) {
    await make(account);
    [sequence, rows] = await read();
  }
  const listed = ordered((rows!.results as { id: string; changed: number; order: string; text: string | null }[]).map((r) => ({ ...r })));
  return {
    sequence: (sequence!.results[0] as { sequence: number } | undefined)?.sequence ?? 0,
    templates: listed.map((r) => (r.text === null ? { id: r.id, changed: r.changed } : { id: r.id, changed: r.changed, template: r.text })),
  };
}
