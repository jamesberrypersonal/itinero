// Publishes newer time-zone rules without a new version of the web app (docs/spec/web/shell.md
// §4.6). It writes dist/time-zone-rules.json alone, from the newest rules file of
// @itinero/trip-time, beside the version already built. A deploy then serves it.
//
//     npm run build-rules

import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { newestRules } from "../plugins/rules-file.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(appRoot, process.env["ITINERO_OUT_DIR"] ?? "dist");
const tripTimeEntry = fileURLToPath(import.meta.resolve("@itinero/trip-time"));
const rules = newestRules(join(dirname(tripTimeEntry), "..", "rules"));

if (!existsSync(join(dist, "version.json"))) {
  console.error(`build-rules: no version is built in ${dist}. Run npm run build first.`);
  process.exit(1);
}
writeFileSync(join(dist, "time-zone-rules.json"), rules.contents);
console.log(`build-rules: wrote the rules of ${rules.release} to ${join(dist, "time-zone-rules.json")}`);
