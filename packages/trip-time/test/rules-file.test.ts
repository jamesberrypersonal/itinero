// The committed rules file (spec §4.10, §5.1).

import assert from "node:assert/strict";
import { test } from "node:test";
import { loadRules, rulesVersion } from "../src/index.ts";
import { newestRulesFile } from "./helpers.ts";

test("the newest rules file loads, and its version is its name", () => {
  const { name, text } = newestRulesFile();
  const loaded = loadRules(text);
  assert.ok(loaded.ok);
  assert.equal(`${loaded.value.version}.json`, name);
  assert.equal(rulesVersion(), loaded.value.version);
});

test("its keys are in sorted order, and it names the zones the requirements use", () => {
  const json = JSON.parse(newestRulesFile().text);
  assert.deepEqual(Object.keys(json), ["aliases", "format", "version", "zones"]);
  for (const map of [json.zones, json.aliases]) {
    const keys = Object.keys(map);
    assert.deepEqual(keys, [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  }
  for (const zone of ["Europe/Paris", "America/New_York", "Asia/Tokyo", "Europe/London", "Etc/UTC"]) {
    assert.ok(zone in json.zones, zone);
  }
  assert.equal(json.aliases["Asia/Calcutta"], "Asia/Kolkata");
});
