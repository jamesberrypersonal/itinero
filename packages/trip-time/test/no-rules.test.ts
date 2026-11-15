// The no-rules refusal, before any rules file is loaded (spec §3.3). Node's test runner gives each
// test file a process of its own, so nothing has been loaded here.

import assert from "node:assert/strict";
import { test } from "node:test";
import { create, parse, rulesVersion, span, type TripTime } from "../src/index.ts";

test("before the first load, rulesVersion is undefined", () => {
  assert.equal(rulesVersion(), undefined);
});

test("create, parse and span refuse with no-rules", () => {
  const fields: TripTime = { kind: "date", zone: "Europe/Paris", date: "2026-06-03" };
  const created = create(fields);
  assert.ok(!created.ok && created.refusal.code === "no-rules");
  const parsed = parse("2026-06-03[Europe/Paris]");
  assert.ok(!parsed.ok && parsed.refusal.code === "no-rules");
  const spanned = span(fields, fields);
  assert.ok(!spanned.ok && spanned.refusal.code === "no-rules");
});

test("a malformed value is refused as malformed, not for the missing rules", () => {
  const parsed = parse("tomorrow");
  assert.ok(!parsed.ok && parsed.refusal.code === "malformed");
});
