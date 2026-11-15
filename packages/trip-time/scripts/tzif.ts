// Reads a TZif file, the binary form zic writes for each zone, as the tzfile manual page and
// RFC 8536 describe it, into the entry the rules file holds for the zone (spec §4.11, §5.1).

export type ZoneEntry = { changes: [number, number][]; initial: number; rule: string };

type Tzif = { times: number[]; types: number[]; offsets: number[]; footer: string };

export function readTzif(bytes: Uint8Array): Tzif {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== "TZif") throw new Error("not a TZif file");
  const version = bytes[4]!;
  if (version < 0x32) throw new Error("a version 1 TZif file has no 64-bit data or TZ string");

  const counts = (at: number) => {
    const n = (i: number) => view.getUint32(at + 20 + i * 4);
    return { isut: n(0), isstd: n(1), leap: n(2), time: n(3), type: n(4), char: n(5) };
  };
  const v1 = counts(0);
  const v1Size = v1.time * 5 + v1.type * 6 + v1.char + v1.leap * 8 + v1.isstd + v1.isut;
  const header = 44 + v1Size;
  if (String.fromCharCode(...bytes.subarray(header, header + 4)) !== "TZif") throw new Error("no second header");
  const c = counts(header);
  if (c.leap !== 0) throw new Error("a TZif file with leap seconds; build without -L");

  let at = header + 44;
  const times: number[] = [];
  for (let i = 0; i < c.time; i++, at += 8) times.push(Number(view.getBigInt64(at)));
  const types: number[] = [];
  for (let i = 0; i < c.time; i++, at += 1) types.push(bytes[at]!);
  const offsets: number[] = [];
  for (let i = 0; i < c.type; i++, at += 6) offsets.push(view.getInt32(at));
  at += c.char + c.isstd + c.isut;

  if (bytes[at] !== 0x0a) throw new Error("no footer");
  const end = bytes.indexOf(0x0a, at + 1);
  if (end < 0) throw new Error("an unterminated footer");
  const footer = new TextDecoder().decode(bytes.subarray(at + 1, end));
  if (footer === "") throw new Error("no TZ string in the footer");
  return { times, types, offsets, footer };
}

/**
 * The zone's entry: the offset in force at 1970-01-01 00:00 UTC, each change of offset after it,
 * and the TZ string. Before the first transition, local time type 0 applies (RFC 8536 §3.2).
 * After the last, the TZ string does, so the last transition is kept even when it changes nothing.
 */
export function zoneEntry(tzif: Tzif, offsetFromRule: (rule: string, moment: number) => number): ZoneEntry {
  const { times, types, offsets, footer } = tzif;
  const offsetOf = (i: number) => offsets[types[i]!]!;
  const last = times.length - 1;

  let initial: number;
  const atOrBefore = times.findLastIndex((t) => t <= 0);
  if (times.length === 0 || atOrBefore === last) initial = offsetFromRule(footer, 0);
  else if (atOrBefore < 0) initial = offsets[0]!;
  else initial = offsetOf(atOrBefore);

  const changes: [number, number][] = [];
  let current = initial;
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!;
    if (t <= 0) continue;
    const offset = offsetOf(i);
    if (offset !== current || i === last) changes.push([t, offset]);
    current = offset;
  }
  return { changes, initial, rule: footer };
}

/** The canonical zones and the links of IANA source files: `Zone NAME ...` and `Link TARGET NAME`. */
export function readSources(texts: string[]): { zones: Set<string>; links: Map<string, string> } {
  const zones = new Set<string>();
  const links = new Map<string, string>();
  for (const text of texts) {
    for (const raw of text.split("\n")) {
      const line = raw.replace(/#.*/, "");
      const zone = /^Zone\s+(\S+)/.exec(line);
      if (zone) zones.add(zone[1]!);
      const link = /^Link\s+(\S+)\s+(\S+)/.exec(line);
      if (link) links.set(link[2]!, link[1]!);
    }
  }
  return { zones, links };
}

/** Each link, mapped to the canonical zone it ends at, following links to links. */
export function resolveAliases(zones: Set<string>, links: Map<string, string>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const alias of links.keys()) {
    let target = links.get(alias)!;
    const seen = new Set([alias]);
    while (!zones.has(target) && links.has(target) && !seen.has(target)) {
      seen.add(target);
      target = links.get(target)!;
    }
    if (!zones.has(target)) throw new Error(`the link ${alias} reaches no zone`);
    if (!zones.has(alias)) aliases.set(alias, target);
  }
  return aliases;
}

/** The rules file as text: keys in sorted order, and one line per zone and per alias, so a release always gives the same bytes. */
export function writeRulesFile(version: string, zones: Map<string, ZoneEntry>, aliases: Map<string, string>): string {
  const sorted = <T>(map: Map<string, T>) => [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const aliasLines = sorted(aliases).map(([alias, zone]) => `    ${JSON.stringify(alias)}: ${JSON.stringify(zone)}`);
  const zoneLines = sorted(zones).map(([name, entry]) => {
    const body = `{"changes":${JSON.stringify(entry.changes)},"initial":${entry.initial},"rule":${JSON.stringify(entry.rule)}}`;
    return `    ${JSON.stringify(name)}: ${body}`;
  });
  return [
    "{",
    '  "aliases": {',
    aliasLines.join(",\n"),
    "  },",
    '  "format": 1,',
    `  "version": ${JSON.stringify(version)},`,
    '  "zones": {',
    zoneLines.join(",\n"),
    "  }",
    "}",
    "",
  ].join("\n");
}
