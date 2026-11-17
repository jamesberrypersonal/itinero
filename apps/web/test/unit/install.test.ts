// suggestInstall (docs/spec/web/shell.md §4.3, §4.5), for WEB:SHELL-F3.

import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestInstall } from "../../src/shell/install.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 26_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15";

test("an iPhone or an iPad in its browser is told how to add Itinero", () => {
  assert.equal(suggestInstall(IPHONE_SAFARI, false), true);
  assert.equal(suggestInstall(IPHONE_SAFARI, undefined), true);
  assert.equal(suggestInstall(IPAD_SAFARI, false), true);
  assert.equal(suggestInstall(IPHONE_CHROME, false), true);
});

test("an iPhone opened from the home screen is not", () => {
  assert.equal(suggestInstall(IPHONE_SAFARI, true), false);
  assert.equal(suggestInstall(IPAD_SAFARI, true), false);
});

test("an Android phone or a computer is not", () => {
  assert.equal(suggestInstall(ANDROID_CHROME, undefined), false);
  assert.equal(suggestInstall(MAC_SAFARI, undefined), false);
});
