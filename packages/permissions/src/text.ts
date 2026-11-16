// The text form of a trip's grants and of a grant change (spec §4.7, §5.1): JSON with its keys in
// sorted order, travellers in the order of their identifiers, and exceptions in that of their pages.
// Reading checks the form only, and does not apply the checks of §4.1 again.

import { readChange, readGrants } from "./form.ts";
import { attempt, fail, type GrantChange, type Grants, type Result } from "./types.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k]!)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readJson(source: string, what: string): unknown {
  if (typeof source !== "string") fail("malformed", `The ${what} is not text.`);
  try {
    return JSON.parse(source);
  } catch {
    fail("malformed", `The ${what} is not JSON.`);
  }
}

export function grantsToText(grants: Grants): string {
  return canonical(JSON.parse(JSON.stringify(readGrants(grants))) as Json);
}

export function grantsFromText(text: string): Result<Grants> {
  return attempt(() => readGrants(readJson(text, "grants")));
}

export function grantChangeToText(change: GrantChange): string {
  return canonical(JSON.parse(JSON.stringify(change)) as Json);
}

export function grantChangeFromText(text: string): Result<GrantChange> {
  return attempt(() => readChange(readJson(text, "change")));
}
