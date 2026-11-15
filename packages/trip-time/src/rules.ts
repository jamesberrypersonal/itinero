// The rules file (spec §5.1), loadRules (§4.10), and the offset of a zone at a moment (§4.2).

import { parsePosix, posixOffsetAt, posixTransitions, type PosixRule, type Transition } from "./posix.ts";
import { accept, refuse, type Result } from "./types.ts";

export type ZoneRules = {
  initial: number;
  moments: readonly number[];
  offsets: readonly number[];
  rule: PosixRule;
};

type Rules = {
  version: string;
  zones: ReadonlyMap<string, ZoneRules>;
  aliases: ReadonlyMap<string, string>;
};

let loaded: Rules | undefined;

/** The largest offset any zone could have, with room to spare: 26 hours. */
const MAX_OFFSET = 26 * 3600;

/** A zone the loaded rules no longer name is counted as UTC, so every function stays total. */
const UTC: ZoneRules = Object.freeze({ initial: 0, moments: [], offsets: [], rule: { std: 0 } });

export function loadRules(file: string): Result<{ version: string }> {
  const rules = readRules(file);
  if (typeof rules === "string") {
    return refuse("bad-rules", `The rules file was refused, because ${rules}.`);
  }
  loaded = rules;
  return accept(Object.freeze({ version: rules.version }));
}

export function rulesVersion(): string | undefined {
  return loaded?.version;
}

export function rulesLoaded(): boolean {
  return loaded !== undefined;
}

/** The rules of a zone, or of the zone an alias names, or undefined when the loaded rules name neither. */
export function findZone(name: string): ZoneRules | undefined {
  if (!loaded) return undefined;
  return loaded.zones.get(loaded.aliases.get(name) ?? name);
}

/** The rules of a zone, counting a zone the loaded rules do not name as UTC. */
export function zoneOrUtc(name: string): ZoneRules {
  return findZone(name) ?? UTC;
}

/** The zone's offset from UTC at a moment, both in seconds (§4.2). */
export function offsetAt(zone: ZoneRules, moment: number): number {
  const { moments, offsets } = zone;
  const count = moments.length;
  if (count === 0) return moment < 0 ? zone.initial : posixOffsetAt(zone.rule, moment);
  if (moment < moments[0]!) return zone.initial;
  if (moment >= moments[count - 1]!) return posixOffsetAt(zone.rule, moment);
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (moments[mid]! <= moment) low = mid;
    else high = mid - 1;
  }
  return offsets[low]!;
}

/** Every change of offset after moment `from` and at or before moment `to`, in order. */
export function transitionsBetween(zone: ZoneRules, from: number, to: number): Transition[] {
  const list: Transition[] = [];
  const { moments, offsets } = zone;
  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i]!;
    if (moment > from && moment <= to) list.push({ moment, offset: offsets[i]! });
  }
  const ruleStart = moments.length > 0 ? moments[moments.length - 1]! : 0;
  if (to > ruleStart) list.push(...posixTransitions(zone.rule, Math.max(from, ruleStart), to));
  return list;
}

function readRules(file: string): Rules | string {
  let json: unknown;
  try {
    json = JSON.parse(file);
  } catch {
    return "it is not JSON";
  }
  if (!isObject(json)) return "it is not a JSON object";
  if (json.format !== 1) return "its format is not 1";
  if (typeof json.version !== "string" || json.version === "") return "it names no version";
  if (!isObject(json.zones)) return "it has no zones";
  if (!isObject(json.aliases)) return "it has no aliases";

  const zones = new Map<string, ZoneRules>();
  for (const [name, entry] of Object.entries(json.zones)) {
    const zone = readZone(entry);
    if (typeof zone === "string") return `its zone ${name} ${zone}`;
    zones.set(name, zone);
  }
  const aliases = new Map<string, string>();
  for (const [alias, target] of Object.entries(json.aliases)) {
    if (typeof target !== "string" || !zones.has(target)) return `its alias ${alias} names no zone in the file`;
    if (zones.has(alias)) return `its alias ${alias} is also a zone`;
    aliases.set(alias, target);
  }
  return { version: json.version, zones, aliases };
}

function readZone(entry: unknown): ZoneRules | string {
  if (!isObject(entry)) return "is not an object";
  if (!isOffset(entry.initial)) return "has no valid initial offset";
  if (typeof entry.rule !== "string") return "has no rule";
  const rule = parsePosix(entry.rule);
  if (!rule) return `has a rule that is not a POSIX TZ string: ${entry.rule}`;
  if (!Array.isArray(entry.changes)) return "has no list of changes";
  const moments: number[] = [];
  const offsets: number[] = [];
  for (const change of entry.changes as unknown[]) {
    if (!Array.isArray(change) || change.length !== 2) return "has a change that is not a pair";
    const [moment, offset] = change as unknown[];
    if (!Number.isSafeInteger(moment) || !isOffset(offset)) return "has a change that is not two whole numbers of seconds";
    if (moments.length > 0 && (moment as number) <= moments[moments.length - 1]!) return "has changes out of order";
    moments.push(moment as number);
    offsets.push(offset as number);
  }
  return Object.freeze({ initial: entry.initial as number, moments, offsets, rule });
}

function isOffset(value: unknown): boolean {
  return Number.isSafeInteger(value) && Math.abs(value as number) <= MAX_OFFSET;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
