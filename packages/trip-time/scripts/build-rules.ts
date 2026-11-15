// Makes the rules file from one release of the IANA time zone database (spec §4.11).
//
//     npm run build-rules -- <release>
//
// The release, such as 2026f, is unpacked first into tzdb/<release>/ in this package: both its
// data, tzdata<release>.tar.gz, and its code, tzcode<release>.tar.gz, from
// https://data.iana.org/time-zones/releases/. The folder is ignored by git.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePosix, posixOffsetAt } from "../src/posix.ts";
import { readSources, readTzif, resolveAliases, writeRulesFile, zoneEntry, type ZoneEntry } from "./tzif.ts";

/** The source files of the release's default build, less `factory`, whose zone is no place. */
const SOURCES = [
  "africa",
  "antarctica",
  "asia",
  "australasia",
  "europe",
  "northamerica",
  "southamerica",
  "etcetera",
  "backward",
];

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message: string): never {
  console.error(`build-rules: ${message}`);
  process.exit(1);
}

const release = process.argv[2];
if (!release || !/^\d{4}[a-z]$/.test(release)) fail("give the release to build, such as: npm run build-rules -- 2026f");

const source = join(packageRoot, "tzdb", release);
const versionFile = join(source, "version");
if (!existsSync(versionFile)) fail(`unpack tzdata${release}.tar.gz and tzcode${release}.tar.gz into ${source} first`);
const version = readFileSync(versionFile, "utf8").trim();
if (version !== release) fail(`${source} holds release ${version}, not ${release}`);

// 1. Compile the release's source files with the release's own zic.
execFileSync("make", ["-C", source, "zic"], { stdio: ["ignore", "ignore", "inherit"] });
const out = mkdtempSync(join(tmpdir(), "trip-time-zic-"));
try {
  execFileSync(join(source, "zic"), ["-b", "slim", "-d", out, ...SOURCES], { cwd: source, stdio: "inherit" });

  // 2. Read each zone's offset changes from 1970 on, its offset at 1970, and its TZ string.
  const { zones: names, links } = readSources(SOURCES.map((file) => readFileSync(join(source, file), "utf8")));
  const offsetFromRule = (rule: string, moment: number) => {
    const parsed = parsePosix(rule);
    if (!parsed) throw new Error(`a TZ string trip-time cannot read: ${rule}`);
    return posixOffsetAt(parsed, moment);
  };
  const zones = new Map<string, ZoneEntry>();
  for (const name of names) {
    zones.set(name, zoneEntry(readTzif(readFileSync(join(out, name))), offsetFromRule));
  }

  // 3. Map each alias, a link, to its canonical zone.
  const aliases = resolveAliases(names, links);

  // 4. Write the rules file, with its keys in sorted order.
  const target = join(packageRoot, "rules", `${release}.json`);
  writeFileSync(target, writeRulesFile(release, zones, aliases));
  console.log(`build-rules: wrote rules/${release}.json, with ${zones.size} zones and ${aliases.size} aliases`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
