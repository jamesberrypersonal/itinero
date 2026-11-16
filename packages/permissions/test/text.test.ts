// Round-trip and order tests (spec §4.7, §4.8, §5.1).

import assert from "node:assert/strict";
import { test } from "node:test";
import { grantChangeFromText, grantChangeToText, grantsFromText, grantsToText, type GrantChange } from "../src/index.ts";
import { ANA, chile, grantsWith, ok, SAM, samViews } from "./helpers.ts";

const pages = chile();

test("grants holding every kind of exception read back equal to themselves", () => {
  const grants = grantsWith(
    samViews(pages),
    pages,
    { op: "add", traveller: ANA, trip: "edit", calendar: "view" },
    { op: "page", traveller: SAM, page: "santiago", level: "edit" },
    { op: "page", traveller: SAM, page: "eating", level: "none" },
    { op: "page", traveller: ANA, page: "chile", level: "view" },
  );
  assert.deepEqual(ok(grantsFromText(grantsToText(grants))), grants);
  assert.equal(grantsToText(ok(grantsFromText(grantsToText(grants)))), grantsToText(grants));
});

test("the text form is as §5.1 gives it: keys sorted, travellers and exceptions in order of identifier", () => {
  const grants = grantsWith(samViews(pages), pages, { op: "page", traveller: SAM, page: "santiago", level: "edit" }, { op: "page", traveller: SAM, page: "eating", level: "view" });
  assert.equal(
    grantsToText(grants),
    '{"format":1,"grants":[' +
      '{"calendar":"edit","pages":[],"traveller":"u-admin","trip":"edit"},' +
      '{"calendar":"none","pages":[{"level":"view","page":"eating"},{"level":"edit","page":"santiago"}],"traveller":"u-sam","trip":"view"}],' +
      '"revision":5,"trip":"trip-1"}',
  );
});

test("text whose travellers or exceptions are out of order reads back as the same grants", () => {
  const text = '{"format":1,"grants":[{"calendar":"none","pages":[{"level":"view","page":"b"},{"level":"none","page":"a"}],"traveller":"u-z","trip":"view"},{"calendar":"view","pages":[],"traveller":"u-a","trip":"edit"}],"revision":3,"trip":"t"}';
  const grants = ok(grantsFromText(text));
  assert.deepEqual(grants.grants.map((g) => g.traveller), ["u-a", "u-z"]);
  assert.deepEqual(grants.grants[1]!.pages.map((e) => e.page), ["a", "b"]);
});

test("every kind of grant change reads back equal to itself", () => {
  const changes: GrantChange[] = [
    { op: "add", traveller: SAM, trip: "view", calendar: "none" },
    { op: "remove", traveller: SAM },
    { op: "trip", traveller: SAM, level: "edit" },
    { op: "calendar", traveller: SAM, level: "view" },
    { op: "page", traveller: SAM, page: "chile", level: "none" },
    { op: "unpage", traveller: SAM, page: "chile" },
  ];
  for (const change of changes) assert.deepEqual(ok(grantChangeFromText(grantChangeToText(change))), change);
  assert.equal(grantChangeToText({ op: "page", traveller: SAM, page: "chile", level: "none" }), '{"level":"none","op":"page","page":"chile","traveller":"u-sam"}');
});
