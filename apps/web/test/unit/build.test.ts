// The build (docs/spec/web/shell.md §4.6): the version's files, its name, the service worker, and
// the two copies of the time-zone rules, for WEB:SHELL-F2 and WEB:SHELL-F4.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { newestRules } from "../../plugins/rules-file.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scratch = mkdtempSync(join(tmpdir(), "itinero-web-build-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function build(name: string, env: Record<string, string> = {}): string {
  const outDir = join(scratch, name);
  execFileSync("npx", ["vite", "build", "--logLevel", "error"], {
    cwd: appRoot,
    env: { ...process.env, ITINERO_OUT_DIR: outDir, ...env },
    stdio: "pipe",
  });
  return outDir;
}

type Listing = { version: string; files: string[] };
const listing = (dir: string): Listing => JSON.parse(readFileSync(join(dir, "version.json"), "utf8")) as Listing;

const tripTimeRules = newestRules(join(appRoot, "..", "..", "packages", "trip-time", "rules"));
const first = build("first");

test("version.json names the version, and lists every file it needs, index.html as /", () => {
  const { version, files } = listing(first);
  assert.match(version, /^[0-9a-f]{12}$/);
  assert.equal(files[0], "/");
  for (const file of files.slice(1)) assert.ok(existsSync(join(first, file)), `${file} is listed but not built`);
  for (const outside of ["/sw.js", "/version.json", "/time-zone-rules.json", "/index.html"]) {
    assert.ok(!files.includes(outside), `${outside} is not one of the version's files`);
  }
  assert.ok(files.includes("/manifest.webmanifest"));
});

test("every script, style and rules file of a version is named by a hash of its contents", () => {
  const assets = listing(first).files.filter((file) => file.startsWith("/assets/"));
  assert.ok(assets.length >= 3);
  for (const file of assets) assert.match(file, /-[A-Za-z0-9_-]{8,}\.(js|css|json)$/);
});

test("index.html and sw.js carry the version", () => {
  const { version } = listing(first);
  assert.ok(readFileSync(join(first, "index.html"), "utf8").includes(`<meta name="itinero-version" content="${version}" />`));
  const worker = readFileSync(join(first, "sw.js"), "utf8");
  assert.ok(worker.includes(`const VERSION = "${version}";`));
  assert.ok(!/^\s*export\b/m.test(worker), "sw.js is a classic script");
  assert.ok(!worker.includes(": Promise<"), "sw.js holds no types");
});

test("the version carries the newest rules of trip-time, and /time-zone-rules.json is the same file apart", () => {
  const own = listing(first).files.find((file) => /^\/assets\/time-zone-rules-[0-9a-f]{12}\.json$/.test(file));
  assert.ok(own, "the version lists its own rules file");
  assert.equal(readFileSync(join(first, own), "utf8"), tripTimeRules.contents);
  assert.equal(readFileSync(join(first, "time-zone-rules.json"), "utf8"), tripTimeRules.contents);
});

test("the same sources build the same version, and a change builds another", () => {
  assert.equal(listing(build("again")).version, listing(first).version);
  assert.notEqual(listing(build("changed", { ITINERO_BUILD_MARK: "changed" })).version, listing(first).version);
});

test("npm run build-rules writes /time-zone-rules.json alone, and changes no version", () => {
  const dir = build("rules");
  const before = readFileSync(join(dir, "version.json"), "utf8");
  writeFileSync(join(dir, "time-zone-rules.json"), "{}");
  const indexTime = statSync(join(dir, "index.html")).mtimeMs;
  execFileSync("npm", ["run", "build-rules", "--silent"], { cwd: appRoot, env: { ...process.env, ITINERO_OUT_DIR: dir }, stdio: "pipe" });
  assert.equal(readFileSync(join(dir, "time-zone-rules.json"), "utf8"), tripTimeRules.contents);
  assert.equal(readFileSync(join(dir, "version.json"), "utf8"), before);
  assert.equal(statSync(join(dir, "index.html")).mtimeMs, indexTime);
});
