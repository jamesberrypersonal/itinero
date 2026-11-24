// The types of the programming interface (spec §3.3). Refusal and Result are trip-time's, and are
// imported as types only, so the package has no runtime dependency.

import type { Refusal, Result } from "@itinero/trip-time";

export type { Refusal, Result } from "@itinero/trip-time";

/** 1 to 64 of A–Z, a–z, 0–9, "-" and "_". */
export type Id = string;

export type Item = { id: Id; text: string; ticked?: true };

export type Checklist = {
  format: 1;
  id: Id;
  owner: Id;
  trip?: Id;
  order: string;
  title: string;
  items: readonly Item[];
};

/** One checklist of a list, by its identifier and its order (§4.5). A Checklist is a Placed. */
export type Placed = { id: Id; order: string };
export type List = readonly Placed[];

export type Change =
  | { op: "rename"; checklist: Id; title: string }
  | { op: "add"; checklist: Id; item: Id; text: string; after?: Id }
  | { op: "write"; checklist: Id; item: Id; text: string }
  | { op: "move"; checklist: Id; item: Id; after?: Id }
  | { op: "remove"; checklist: Id; item: Id }
  | { op: "tick"; checklist: Id; item: Id; ticked: boolean }
  | { op: "place"; checklist: Id; order: string };

export type Progress = { ticked: number; of: number };

export type RefusalCode =
  | "malformed"
  | "bad-id"
  | "bad-title"
  | "bad-text"
  | "too-many-items"
  | "duplicate-id"
  | "unknown-item"
  | "wrong-checklist"
  | "template-tick"
  | "bad-order"
  | "unknown-checklist"
  | "unknown-format";

class Refused extends Error {
  readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

export function fail(code: RefusalCode, message: string): never {
  throw new Refused(Object.freeze({ code: code as Refusal["code"], message }));
}

/** Runs a check, turning a refusal it throws into a refused Result. */
export function attempt<T>(run: () => T): Result<T> {
  try {
    return Object.freeze({ ok: true as const, value: run() });
  } catch (error) {
    if (error instanceof Refused) return Object.freeze({ ok: false as const, refusal: error.refusal });
    throw error;
  }
}
