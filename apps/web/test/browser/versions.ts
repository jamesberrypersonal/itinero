// Builds the versions the browser tests publish, once before they run (docs/spec/web/shell.md §4.5):
//
// - `one` and `two`, two versions that differ only by a mark in index.html
// - `three`, whose `API` is 2, deployed with an online side that answers nothing older
//
// Each is built with the test hook, through which the tests play web/trip-store's part.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const versionsDir = join(appRoot, "test-results", "versions");

export const VERSIONS = {
  one: { mark: "one" },
  two: { mark: "two" },
  three: { mark: "three", api: "3" },
} as const;

export type VersionName = keyof typeof VERSIONS;

export function versionDir(name: VersionName): string {
  return join(versionsDir, name);
}

export default function buildVersions(): void {
  for (const [name, { mark, ...rest }] of Object.entries(VERSIONS)) {
    const api = "api" in rest ? rest.api : undefined;
    execFileSync("npx", ["vite", "build", "--logLevel", "error"], {
      cwd: appRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        ITINERO_TEST: "1",
        ITINERO_BUILD_MARK: mark,
        ITINERO_OUT_DIR: versionDir(name as VersionName),
        ...(api ? { ITINERO_API: api } : {}),
      },
    });
  }
}
