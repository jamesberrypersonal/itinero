// The types of the programming interface (spec §3.3). Refusal and Result are trip-time's, and are
// imported as types only, so the package has no runtime dependency.

import type { Refusal, Result } from "@itinero/trip-time";

export type { Refusal, Result } from "@itinero/trip-time";

/** 1 to 64 of A–Z, a–z, 0–9, "-" and "_", unique within a trip. */
export type Id = string;

export type Page = {
  format: 1;
  id: Id;
  trip: Id;
  revision: number;
  parent?: Id;
  order: string;
  title: string;
  text: string;
  buried?: number;
  country?: string;
};

export type Pages = { trip: Id; pages: readonly Page[] };

export type Where = { parent?: Id; after?: Id };

export type Change =
  | { op: "add"; id: Id; title: string; text?: string; at: Where }
  | { op: "rename"; id: Id; title: string }
  | { op: "write"; id: Id; text: string; base: number }
  | { op: "move"; id: Id; to: Where }
  | { op: "bury"; id: Id }
  | { op: "restore"; id: Id };

export type Applied = { pages: Pages; written: readonly Page[] };

export type Branch = { page: Page; under: readonly Branch[] };
export type State = "tree" | "graveyard" | "absent";
export type Buried = { page: Page; went: number };
export type Around = { before: string; match: string; after: string };
export type Hit = { page: Page; around: readonly Around[] };

export type RefusalCode =
  | "malformed"
  | "bad-id"
  | "bad-title"
  | "text-length"
  | "duplicate-id"
  | "unknown-id"
  | "not-in-tree"
  | "not-a-sibling"
  | "cycle"
  | "in-graveyard"
  | "not-in-graveyard"
  | "parent-in-graveyard"
  | "stale"
  | "no-words"
  | "unknown-format";

class Refused extends Error {
  readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

export function fail(code: RefusalCode, message: string, details?: Record<string, string>): never {
  const c = code as Refusal["code"];
  throw new Refused(Object.freeze(details ? { code: c, message, details: Object.freeze({ ...details }) } : { code: c, message }));
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
