// POSIX TZ strings, the one-line rule a zone follows after its last listed change (spec §3.4, §4.2).
// The form is the one the tzfile manual page gives, with its extensions: transition times may be
// negative or beyond 24 hours, and quoted names such as <+03> are allowed.

import { SECONDS_PER_DAY, civilFromDays, daysFromCivil, daysInMonth, isLeapYear, weekday } from "./calendar.ts";

type DateRule =
  | { type: "julian"; day: number }       // Jn: 1 to 365, never counting 29 February
  | { type: "zero-based"; day: number }   // n: 0 to 365, counting 29 February
  | { type: "month"; month: number; week: number; weekday: number };  // Mm.w.d

export type PosixRule = {
  std: number;   // the standard offset from UTC, in seconds
  dst?: {
    offset: number;
    start: DateRule;
    startTime: number;   // seconds after local midnight, in standard time
    end: DateRule;
    endTime: number;     // seconds after local midnight, in daylight time
  };
};

export type Transition = { moment: number; offset: number };

/** Reads a POSIX TZ string, or returns undefined when it is not in the form the tzfile page gives. */
export function parsePosix(text: string): PosixRule | undefined {
  const reader = new Reader(text);
  if (!reader.name()) return undefined;
  const stdWest = reader.duration(24);
  if (stdWest === undefined) return undefined;
  const std = 0 - stdWest;  // never -0
  if (reader.done()) return { std };
  if (!reader.name()) return undefined;
  let offset = std + 3600;
  if (!reader.peek(",")) {
    const dstWest = reader.duration(24);
    if (dstWest === undefined) return undefined;
    offset = 0 - dstWest;
  }
  // zic always writes the rule. POSIX leaves a missing one to the implementation, so refuse it.
  if (!reader.take(",")) return undefined;
  const start = reader.dateRule();
  const startTime = reader.take("/") ? reader.duration(167) : 7200;
  if (start === undefined || startTime === undefined || !reader.take(",")) return undefined;
  const end = reader.dateRule();
  const endTime = reader.take("/") ? reader.duration(167) : 7200;
  if (end === undefined || endTime === undefined || !reader.done()) return undefined;
  return { std, dst: { offset, start, startTime, end, endTime } };
}

/** The offset a rule gives at a moment. */
export function posixOffsetAt(rule: PosixRule, moment: number): number {
  if (!rule.dst) return rule.std;
  const year = civilFromDays(Math.floor(moment / SECONDS_PER_DAY)).year;
  let offset: number | undefined;
  for (const t of transitionsOfYears(rule, year - 1, year + 1)) {
    if (t.moment > moment) break;
    offset = t.offset;
  }
  return offset ?? lastOffsetOfYear(rule, year - 2);
}

/** The changes a rule makes after moment `from` and at or before moment `to`, in order. */
export function posixTransitions(rule: PosixRule, from: number, to: number): Transition[] {
  if (!rule.dst) return [];
  const first = civilFromDays(Math.floor(from / SECONDS_PER_DAY)).year - 1;
  const last = civilFromDays(Math.floor(to / SECONDS_PER_DAY)).year + 1;
  return transitionsOfYears(rule, first, last).filter((t) => t.moment > from && t.moment <= to);
}

function transitionsOfYears(rule: PosixRule, first: number, last: number): Transition[] {
  const dst = rule.dst;
  if (!dst) return [];
  const list: Transition[] = [];
  for (let year = first; year <= last; year++) {
    list.push({ moment: dayOf(dst.start, year) * SECONDS_PER_DAY + dst.startTime - rule.std, offset: dst.offset });
    list.push({ moment: dayOf(dst.end, year) * SECONDS_PER_DAY + dst.endTime - dst.offset, offset: rule.std });
  }
  // A stable sort keeps a year's start after the previous year's end when the two coincide, as
  // in a zone on daylight time all year, such as EST5EDT,0/0,J365/25.
  return list.sort((a, b) => a.moment - b.moment);
}

function lastOffsetOfYear(rule: PosixRule, year: number): number {
  const list = transitionsOfYears(rule, year, year);
  return list[list.length - 1]?.offset ?? rule.std;
}

/** The day, counted from 1970-01-01, that a date rule names in a year. */
function dayOf(rule: DateRule, year: number): number {
  const jan1 = daysFromCivil(year, 1, 1);
  switch (rule.type) {
    case "julian":
      return jan1 + rule.day - 1 + (isLeapYear(year) && rule.day >= 60 ? 1 : 0);
    case "zero-based":
      return jan1 + rule.day;
    case "month": {
      const first = daysFromCivil(year, rule.month, 1);
      let day = 1 + ((rule.weekday - weekday(first) + 7) % 7) + (rule.week - 1) * 7;
      const length = daysInMonth(year, rule.month);
      while (day > length) day -= 7;
      return first + day - 1;
    }
  }
}

class Reader {
  private at = 0;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  done(): boolean {
    return this.at === this.text.length;
  }

  peek(char: string): boolean {
    return this.text[this.at] === char;
  }

  take(char: string): boolean {
    if (!this.peek(char)) return false;
    this.at++;
    return true;
  }

  private match(pattern: RegExp): RegExpExecArray | undefined {
    pattern.lastIndex = this.at;
    const found = pattern.exec(this.text);
    if (!found) return undefined;
    this.at += found[0].length;
    return found;
  }

  name(): boolean {
    return this.match(/<[A-Za-z0-9+-]{3,}>|[A-Za-z]{3,}/y) !== undefined;
  }

  /** A signed [+-]hh[:mm[:ss]], in seconds, with hours up to `maxHours`. */
  duration(maxHours: number): number | undefined {
    const found = this.match(/([+-])?(\d{1,3})(?::(\d{2}))?(?::(\d{2}))?/y);
    if (!found) return undefined;
    const hours = Number(found[2]);
    const minutes = Number(found[3] ?? 0);
    const seconds = Number(found[4] ?? 0);
    if (hours > maxHours || minutes > 59 || seconds > 59) return undefined;
    return (found[1] === "-" ? -1 : 1) * (hours * 3600 + minutes * 60 + seconds);
  }

  dateRule(): DateRule | undefined {
    const month = this.match(/M(\d{1,2})\.(\d)\.(\d)/y);
    if (month) {
      const [m, w, d] = [Number(month[1]), Number(month[2]), Number(month[3])];
      if (m < 1 || m > 12 || w < 1 || w > 5 || d > 6) return undefined;
      return { type: "month", month: m, week: w, weekday: d };
    }
    const julian = this.match(/J(\d{1,3})/y);
    if (julian) {
      const day = Number(julian[1]);
      return day >= 1 && day <= 365 ? { type: "julian", day } : undefined;
    }
    const zeroBased = this.match(/(\d{1,3})/y);
    if (zeroBased) {
      const day = Number(zeroBased[1]);
      return day <= 365 ? { type: "zero-based", day } : undefined;
    }
    return undefined;
  }
}
