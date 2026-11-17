// Finding the newest rules file of @itinero/trip-time, for the build and for `npm run build-rules`
// (docs/spec/web/shell.md §4.6).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type RulesFile = { release: string; path: string; contents: string };

/** The newest rules file in trip-time's `rules/` folder. Files are named by release, which sorts as text. */
export function newestRules(rulesDir: string): RulesFile {
  const names = readdirSync(rulesDir)
    .filter((name) => /^\d{4}[a-z]+\.json$/.test(name))
    .sort();
  const newest = names.at(-1);
  if (newest === undefined) throw new Error(`No rules file in ${rulesDir}`);
  const path = join(rulesDir, newest);
  return { release: newest.replace(/\.json$/, ""), path, contents: readFileSync(path, "utf8") };
}
