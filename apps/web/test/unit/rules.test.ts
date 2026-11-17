// Choosing the newer rules file (docs/spec/web/shell.md §4.4, §4.5), for WEB:SHELL-F4.

import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseRules, isNewer, releaseOf } from "../../src/shell/rules.ts";

test("a later release is newer, as IANA releases sort as text", () => {
  assert.equal(isNewer("2026f", "2026a"), true);
  assert.equal(isNewer("2027a", "2026z"), true);
  assert.equal(isNewer("2026a", "2026f"), false);
  assert.equal(isNewer("2026f", "2026f"), false);
});

test("any release is newer than none", () => {
  assert.equal(isNewer("2026a", undefined), true);
  assert.equal(isNewer("2026a", ""), true);
});

test("start loads the version's own rules unless the newest fetched are newer", () => {
  assert.equal(chooseRules("2026f", undefined), "built");
  assert.equal(chooseRules("2026f", "2026a"), "built");
  assert.equal(chooseRules("2026f", "2026f"), "built");
  assert.equal(chooseRules("2026f", "2026g"), "fetched");
  assert.equal(chooseRules("2026f", "2027a"), "fetched");
});

test("a rules file's release is read from its version", () => {
  assert.equal(releaseOf('{"aliases":{},"version":"2026f","zones":{}}'), "2026f");
  assert.equal(releaseOf('{"zones":{}}'), undefined);
  assert.equal(releaseOf('{"version":7}'), undefined);
  assert.equal(releaseOf("not json"), undefined);
  assert.equal(releaseOf("null"), undefined);
});
