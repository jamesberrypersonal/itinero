// The moments a value covers (spec §4.5), compare and sort (§4.6), and span and duration (§4.7).

import { SECONDS_PER_DAY } from "./calendar.ts";
import { boundaryOf, momentOf } from "./local.ts";
import { rulesLoaded, zoneOrUtc, type ZoneRules } from "./rules.ts";
import { accept, refuse, type ClockTime, type Duration, type PartOfDay, type Result, type Span, type TripTime } from "./types.ts";
import { localCount, readDate } from "./value.ts";

/** The hours of each part of a day, as the local hour it starts and the hour it ends, perhaps the next date's. */
const PART_HOURS: Record<PartOfDay, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 18],
  evening: [18, 22],
  night: [22, 30],
};

function dayStart(date: string): number {
  const read = readDate(date);
  return (read.code === "ok" ? read.days : 0) * SECONDS_PER_DAY;
}

function clockMoment(zone: ZoneRules, date: string, at: ClockTime): number {
  return momentOf(zone, localCount(date, at.time), at.second === true);
}

/** The earliest and the latest moment a value covers. */
export function coverOf(value: TripTime): { earliest: number; latest: number } {
  const zone = zoneOrUtc(value.zone);
  switch (value.kind) {
    case "exact":
    case "approx": {
      const moment = clockMoment(zone, value.date, value.at);
      return { earliest: moment, latest: moment };
    }
    case "window":
      return { earliest: clockMoment(zone, value.date, value.from), latest: clockMoment(zone, value.endDate, value.to) };
    case "part": {
      const [from, to] = PART_HOURS[value.part];
      const start = dayStart(value.date);
      return { earliest: boundaryOf(zone, start + from * 3600), latest: boundaryOf(zone, start + to * 3600) };
    }
    case "date":
    case "tbd": {
      const start = dayStart(value.date);
      return { earliest: boundaryOf(zone, start), latest: boundaryOf(zone, start + SECONDS_PER_DAY) };
    }
  }
}

/** The sort key of §4.6: a moment, then a rank. */
function sortKey(value: TripTime): [number, number] {
  const { earliest, latest } = coverOf(value);
  switch (value.kind) {
    case "date":
      return [earliest, 0];
    case "exact":
      return [earliest, 1];
    case "tbd":
      return [latest, -1];
    default:
      return [earliest, 2];
  }
}

function compareKeys(a: [number, number], b: [number, number]): -1 | 0 | 1 {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return 0;
}

export function compare(a: TripTime, b: TripTime): -1 | 0 | 1 {
  return compareKeys(sortKey(a), sortKey(b));
}

export function sort(values: readonly TripTime[]): TripTime[] {
  return values
    .map((value, index) => ({ value, index, key: sortKey(value) }))
    .sort((a, b) => compareKeys(a.key, b.key) || a.index - b.index)
    .map((entry) => entry.value);
}

export function span(start: TripTime, end: TripTime): Result<Span> {
  if (!rulesLoaded()) return refuse("no-rules", "No time-zone rules have been loaded, so no span can be checked.");
  if (coverOf(end).latest < coverOf(start).earliest) {
    return refuse("span-order", "The span ends before it starts, whatever times its ends turn out to be.");
  }
  return accept(Object.freeze({ start, end }));
}

export function duration(of: Span): Duration {
  const start = coverOf(of.start);
  const end = coverOf(of.end);
  const minutes = (seconds: number) => Math.round(seconds / 60);
  return Object.freeze({
    shortest: Math.max(0, minutes(end.earliest - start.latest)),
    longest: Math.max(0, minutes(end.latest - start.earliest)),
  });
}
