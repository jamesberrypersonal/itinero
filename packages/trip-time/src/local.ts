// From a local time to a moment (spec §4.2).

import { SECONDS_PER_DAY } from "./calendar.ts";
import { offsetAt, transitionsBetween, type ZoneRules } from "./rules.ts";

export type Resolution =
  | { kind: "one"; moment: number }
  | { kind: "repeat"; first: number; second: number; secondOffset: number }
  | { kind: "gap"; moment: number; start: number; gapStart: number; gapEnd: number };
// For a gap, `moment` is the local count less the offset before the gap, `start` is the moment the
// clocks went forward, and `gapStart` and `gapEnd` are the local counts the gap runs between.

/** Resolves a local count `local`, the seconds since 1970-01-01 00:00 on the zone's own clocks. */
export function resolve(zone: ZoneRules, local: number): Resolution {
  const from = local - SECONDS_PER_DAY;
  const to = local + SECONDS_PER_DAY;
  const transitions = transitionsBetween(zone, from, to);
  const offsets = new Set<number>([offsetAt(zone, from), ...transitions.map((t) => t.offset)]);

  const candidates = new Map<number, number>();
  for (const offset of offsets) {
    const moment = local - offset;
    if (offsetAt(zone, moment) === offset) candidates.set(moment, offset);
  }
  const found = [...candidates.entries()].sort((a, b) => a[0] - b[0]);
  const first = found[0];
  const last = found[found.length - 1];
  if (first && last && found.length > 1) {
    return { kind: "repeat", first: first[0], second: last[0], secondOffset: last[1] };
  }
  if (first) return { kind: "one", moment: first[0] };

  for (const t of transitions) {
    const before = offsetAt(zone, t.moment - 1);
    const after = offsetAt(zone, t.moment);
    if (after > before && local >= t.moment + before && local < t.moment + after) {
      return { kind: "gap", moment: local - before, start: t.moment, gapStart: t.moment + before, gapEnd: t.moment + after };
    }
  }
  // Unreachable with a consistent rules file. Fall back on the offset at the local count itself.
  return { kind: "one", moment: local - offsetAt(zone, local) };
}

/** The moment of a clock time: the gap rule for a skipped time, and the mark for a repeated one. */
export function momentOf(zone: ZoneRules, local: number, second: boolean): number {
  const found = resolve(zone, local);
  switch (found.kind) {
    case "one":
    case "gap":
      return found.moment;
    case "repeat":
      return second ? found.second : found.first;
  }
}

/** The moment a period starts at a local count: the first moment after a gap, and the earlier of a repeat (§4.5). */
export function boundaryOf(zone: ZoneRules, local: number): number {
  const found = resolve(zone, local);
  switch (found.kind) {
    case "one":
      return found.moment;
    case "gap":
      return found.start;
    case "repeat":
      return found.first;
  }
}
