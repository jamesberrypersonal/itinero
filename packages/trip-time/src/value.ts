// create (spec §4.3), and parse and toText, the text form (§4.1, §4.4).

import { SECONDS_PER_DAY, clockText, dateText, daysFromCivil, daysInMonth, pad2, splitDays } from "./calendar.ts";
import { resolve } from "./local.ts";
import { findZone, rulesLoaded, type ZoneRules } from "./rules.ts";
import { accept, refuse, type ClockTime, type PartOfDay, type Result, type TripTime } from "./types.ts";

const PARTS: readonly PartOfDay[] = ["morning", "afternoon", "evening", "night"];

/** The last date a value may hold, 9999-12-31, and the first, 1970-01-01, as days from 1970-01-01. */
const LAST_DAY = daysFromCivil(9999, 12, 31);

const KEYS: Record<TripTime["kind"], readonly string[]> = {
  exact: ["kind", "zone", "date", "at"],
  date: ["kind", "zone", "date"],
  tbd: ["kind", "zone", "date"],
  part: ["kind", "zone", "date", "part"],
  approx: ["kind", "zone", "date", "at"],
  window: ["kind", "zone", "date", "from", "endDate", "to"],
};

type Checked = { code: "ok"; days: number } | { code: "malformed" | "out-of-range" | "invalid-date"; message: string };

/** Reads a "YYYY-MM-DD" date into days from 1970-01-01. */
export function readDate(text: string): Checked {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!found) return { code: "malformed", message: `The date ${text} is not written as YYYY-MM-DD.` };
  const [year, month, day] = [Number(found[1]), Number(found[2]), Number(found[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return { code: "invalid-date", message: `The date ${text} does not exist.` };
  }
  const days = daysFromCivil(year, month, day);
  if (days < 0 || days > LAST_DAY) {
    return { code: "out-of-range", message: `The date ${text} is outside 1970-01-01 to 9999-12-31.` };
  }
  return { code: "ok", days };
}

type CheckedTime = { code: "ok"; seconds: number } | { code: "malformed" | "invalid-time"; message: string };

/** Reads an "HH:MM" clock time into seconds after midnight. */
export function readTime(text: string): CheckedTime {
  if (/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)) {
    return { code: "invalid-time", message: `The time ${text} holds seconds, and a time is held to the minute.` };
  }
  const found = /^(\d{2}):(\d{2})$/.exec(text);
  if (!found) return { code: "malformed", message: `The time ${text} is not written as HH:MM.` };
  const [hours, minutes] = [Number(found[1]), Number(found[2])];
  if (hours > 23 || minutes > 59) return { code: "invalid-time", message: `The time ${text} is outside 00:00 to 23:59.` };
  return { code: "ok", seconds: hours * 3600 + minutes * 60 };
}

/** The local count of a date and a clock time: seconds since 1970-01-01 00:00 on the zone's own clocks. */
export function localCount(date: string, time: string): number {
  const d = readDate(date);
  const t = readTime(time);
  return (d.code === "ok" ? d.days : 0) * SECONDS_PER_DAY + (t.code === "ok" ? t.seconds : 0);
}

export function create(fields: TripTime): Result<TripTime> {
  return build(fields, "create");
}

export function parse(text: string): Result<TripTime> {
  const fields = readText(text);
  if (typeof fields === "string") return refuse("malformed", fields);
  return build(fields, "parse");
}

export function toText(value: TripTime): string {
  const zone = findZone(value.zone);
  const clock = (date: string, at: ClockTime) => at.time + markText(zone, date, at);
  const tail = `[${value.zone}]`;
  switch (value.kind) {
    case "exact":
      return `${value.date}T${clock(value.date, value.at)}${tail}`;
    case "date":
      return `${value.date}${tail}`;
    case "tbd":
      return `${value.date}/tbd${tail}`;
    case "part":
      return `${value.date}/${value.part}${tail}`;
    case "approx":
      return `${value.date}~${clock(value.date, value.at)}${tail}`;
    case "window": {
      const end = value.endDate === value.date ? "" : `${value.endDate}T`;
      return `${value.date}T${clock(value.date, value.from)}/${end}${clock(value.endDate, value.to)}${tail}`;
    }
  }
}

/** The offset written after a time marked as the second occurrence, while it still repeats (§4.1). */
function markText(zone: ZoneRules | undefined, date: string, at: ClockTime): string {
  if (!at.second || !zone) return "";
  const found = resolve(zone, localCount(date, at.time));
  return found.kind === "repeat" ? offsetText(found.secondOffset) : "";
}

function offsetText(offset: number): string {
  const size = Math.abs(offset);
  const seconds = size % 60;
  const text = `${offset < 0 ? "-" : "+"}${pad2(Math.floor(size / 3600))}:${pad2(Math.floor(size / 60) % 60)}`;
  return seconds === 0 ? text : `${text}:${pad2(seconds)}`;
}

/** A clock time read from text, with the offset it carried, if any. */
type TextClock = { time: string; offset?: number };
type WithTextClocks<T> = T extends { at: ClockTime }
  ? Omit<T, "at"> & { at: TextClock }
  : T extends { from: ClockTime }
    ? Omit<T, "from" | "to"> & { from: TextClock; to: TextClock }
    : T;
type TextFields = WithTextClocks<TripTime>;

const DATE = String.raw`(\d{4}-\d{2}-\d{2})`;
const TIME = String.raw`(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)`;
const OFFSET = String.raw`([+-]\d{2}:\d{2}(?::\d{2})?)?`;
const FORMS: readonly [TripTime["kind"], RegExp][] = [
  ["exact", new RegExp(`^${DATE}T${TIME}${OFFSET}$`)],
  ["date", new RegExp(`^${DATE}$`)],
  ["tbd", new RegExp(`^${DATE}/tbd$`)],
  ["part", new RegExp(`^${DATE}/(morning|afternoon|evening|night)$`)],
  ["approx", new RegExp(`^${DATE}~${TIME}${OFFSET}$`)],
  ["window", new RegExp(`^${DATE}T${TIME}${OFFSET}/(?:${DATE}T)?${TIME}${OFFSET}$`)],
];

function readText(text: string): TextFields | string {
  const notForm = `The text ${JSON.stringify(text)} is not a date or time in trip-time's text form.`;
  if (typeof text !== "string") return notForm;
  const zoneMatch = /^(.*)\[([A-Za-z0-9_+\-/]+)\]$/.exec(text);
  if (!zoneMatch) return notForm;
  const body = zoneMatch[1]!;
  const zone = zoneMatch[2]!;
  for (const [kind, pattern] of FORMS) {
    const m = pattern.exec(body);
    if (!m) continue;
    const date = m[1]!;
    const clock = (time: string | undefined, offset: string | undefined): TextClock => {
      const read: TextClock = { time: time! };
      if (offset !== undefined) read.offset = readOffset(offset);
      return read;
    };
    switch (kind) {
      case "exact":
      case "approx":
        return { kind, zone, date, at: clock(m[2], m[3]) };
      case "date":
      case "tbd":
        return { kind, zone, date };
      case "part":
        return { kind, zone, date, part: m[2] as PartOfDay };
      case "window":
        return { kind, zone, date, from: clock(m[2], m[3]), endDate: m[4] ?? date, to: clock(m[5], m[6]) };
    }
  }
  return notForm;
}

function readOffset(text: string): number {
  const [hours, minutes, seconds] = text.slice(1).split(":").map(Number);
  return (text[0] === "-" ? -1 : 1) * (hours! * 3600 + minutes! * 60 + (seconds ?? 0));
}

/**
 * Checks fields and builds the frozen value. `create` refuses a skipped time, a mark on a time that
 * does not repeat, and a window out of order. `parse` resolves the first two instead (§4.1), using
 * the offset each clock time carried, and reads a window in any order.
 */
function build(input: unknown, mode: "create" | "parse"): Result<TripTime> {
  const shape = checkShape(input, mode);
  if (typeof shape === "string") return refuse("malformed", shape);
  const fields = shape;

  const date = readDate(fields.date);
  if (date.code !== "ok") return refuse(date.code, date.message);
  let endDays = date.days;
  if (fields.kind === "window") {
    const end = readDate(fields.endDate);
    if (end.code !== "ok") return refuse(end.code, end.message);
    endDays = end.days;
  }
  for (const clock of clocksOf(fields)) {
    const time = readTime(clock.time);
    if (time.code !== "ok") return refuse(time.code, time.message);
  }

  if (!rulesLoaded()) return refuse("no-rules", "No time-zone rules have been loaded, so no date or time can be checked.");
  const zone = findZone(fields.zone);
  if (!zone) return refuse("unknown-zone", `The time zone ${fields.zone} is not one the time-zone rules name.`);

  const marks: boolean[] = [];
  const moments: number[] = [];
  const clockDates = fields.kind === "window" ? [date.days, endDays] : [date.days];
  const clocks = clocksOf(fields);
  for (let i = 0; i < clocks.length; i++) {
    const clock = clocks[i]!;
    const local = clockDates[i]! * SECONDS_PER_DAY + (readTime(clock.time) as { seconds: number }).seconds;
    const where = `${dateText(clockDates[i]!)} ${clock.time}`;
    const found = resolve(zone, local);
    let second = false;
    if (mode === "create") {
      if (found.kind === "gap") {
        const before = splitDays(Math.floor((found.gapStart - 1) / 60) * 60);
        const after = splitDays(Math.ceil(found.gapEnd / 60) * 60);
        const [beforeTime, afterTime] = [clockText(before.secondsOfDay), clockText(after.secondsOfDay)];
        return refuse(
          "skipped-time",
          `The time ${where} never happens in ${fields.zone}, because the clocks go forward over it: ` +
            `the last valid time before it is ${beforeTime}, and the first after it is ${afterTime}.`,
          { before: beforeTime, after: afterTime, beforeDate: dateText(before.days), afterDate: dateText(after.days) },
        );
      }
      second = (clock as ClockTime).second === true;
      if (second && found.kind !== "repeat") {
        return refuse(
          "not-repeated",
          `The time ${where} happens only once in ${fields.zone}, so it cannot be marked as its second occurrence.`,
        );
      }
    } else {
      const offset = (clock as TextClock).offset;
      second = offset !== undefined && found.kind === "repeat" && found.secondOffset === offset;
    }
    marks.push(second);
    moments.push(found.kind === "repeat" ? (second ? found.second : found.first) : found.moment);
  }

  // parse reads back a window that later rules put out of order, so only create checks the order (§4.4).
  if (mode === "create" && fields.kind === "window" && !(moments[1]! > moments[0]!)) {
    const start = `${fields.date} ${fields.from.time}`;
    const end = `${fields.endDate} ${fields.to.time}`;
    return refuse("window-order", `The window's end, ${end}, is not after its start, ${start}.`);
  }

  return accept(freezeValue(fields, marks));
}

type Fields = TripTime | TextFields;

function clocksOf(fields: Fields): (ClockTime | TextClock)[] {
  switch (fields.kind) {
    case "exact":
    case "approx":
      return [fields.at];
    case "window":
      return [fields.from, fields.to];
    default:
      return [];
  }
}

function freezeValue(fields: Fields, marks: boolean[]): TripTime {
  const clock = (c: ClockTime | TextClock, second: boolean | undefined): ClockTime =>
    Object.freeze(second ? { time: c.time, second: true as const } : { time: c.time });
  const { kind, zone, date } = fields;
  switch (fields.kind) {
    case "exact":
    case "approx":
      return Object.freeze({ kind: fields.kind, zone, date, at: clock(fields.at, marks[0]) });
    case "date":
    case "tbd":
      return Object.freeze({ kind: fields.kind, zone, date });
    case "part":
      return Object.freeze({ kind: "part" as const, zone, date, part: fields.part });
    case "window":
      return Object.freeze({
        kind: "window" as const,
        zone,
        date,
        from: clock(fields.from, marks[0]),
        endDate: fields.endDate,
        to: clock(fields.to, marks[1]),
      });
  }
  throw new Error(`unreachable kind ${String(kind)}`);
}

/** Checks the fields have the shape of §3.3, and nothing more, or says what is wrong with them. */
function checkShape(input: unknown, mode: "create" | "parse"): Fields | string {
  if (!isRecord(input)) return "The value is not an object.";
  const kind = input.kind;
  if (typeof kind !== "string" || !(kind in KEYS)) return `The kind ${JSON.stringify(kind)} is not one of trip-time's six kinds.`;
  const keys = KEYS[kind as TripTime["kind"]];
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) return `A value of kind ${kind} has no field ${key}.`;
  }
  for (const key of keys) {
    if (!(key in input)) return `A value of kind ${kind} needs the field ${key}.`;
  }
  if (typeof input.zone !== "string" || input.zone === "") return "The time zone is not a name.";
  if (typeof input.date !== "string") return "The date is not text.";
  if (kind === "window" && typeof input.endDate !== "string") return "The window's end date is not text.";
  if (kind === "part" && !PARTS.includes(input.part as PartOfDay)) {
    return `The part of a day ${JSON.stringify(input.part)} is not morning, afternoon, evening or night.`;
  }
  for (const key of ["at", "from", "to"]) {
    if (!keys.includes(key)) continue;
    const clock = input[key];
    if (!isRecord(clock) || typeof clock.time !== "string") return `The clock time ${key} is not an object holding a time.`;
    const allowed = mode === "create" ? ["time", "second"] : ["time", "offset"];
    for (const field of Object.keys(clock)) {
      if (!allowed.includes(field)) return `The clock time ${key} has no field ${field}.`;
    }
    if (mode === "create" && "second" in clock && clock.second !== true) {
      return `The clock time ${key} marks its second occurrence with something other than true.`;
    }
  }
  return input as Fields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
