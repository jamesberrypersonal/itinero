// extent (spec §4.5), layout (§4.6) and travelDuration (§4.4).

import { compare, duration, span, type Duration } from "@itinero/trip-time";
import { isDay, localDates } from "./build.ts";
import { checkDate } from "./check.ts";
import { dateOfDays } from "./dates.ts";
import { attempt, fail, type DayLayout, type FirmItem, type LocalDate, type Result, type Stretch, type Trip } from "./types.ts";

const MAX_RANGE_DAYS = 366;

/** The first and the last date a firm item covers: from its leaving date to the last date its time or its arrival reaches. */
export function firmCover(item: FirmItem): { first: LocalDate; last: LocalDate } {
  const leaves = localDates(item.when);
  const arrive = item.travel?.arrive;
  const last = arrive && localDates(arrive).last > leaves.last ? localDates(arrive).last : leaves.last;
  return { first: leaves.first, last };
}

export function extent(trip: Trip): { first: LocalDate; last: LocalDate } | undefined {
  const covers = [...trip.stretches.map((s) => ({ first: s.first, last: s.last })), ...trip.firm.map(firmCover)];
  if (covers.length === 0) return undefined;
  let { first, last } = covers[0]!;
  for (const c of covers) {
    if (c.first < first) first = c.first;
    if (c.last > last) last = c.last;
  }
  return Object.freeze({ first, last });
}

export function layout(trip: Trip, first: LocalDate, last: LocalDate): Result<DayLayout[]> {
  return attempt(() => {
    const from = checkDate(first, "range's first date");
    const to = checkDate(last, "range's last date");
    if (to < from) fail("range-order", `The range's last date, ${last}, is before its first, ${first}.`);
    if (to - from + 1 > MAX_RANGE_DAYS) {
      fail("range-length", `The range covers ${to - from + 1} days, and a range covers at most ${MAX_RANGE_DAYS}.`);
    }

    const stretches = trip.stretches
      .map((stretch, index) => ({ stretch, index }))
      .sort((a, b) => cmp(a.stretch.first, b.stretch.first) || cmp(a.stretch.last, b.stretch.last) || a.index - b.index)
      .map((entry) => entry.stretch);
    const days = trip.firm.filter((item) => isDay(item.when));
    const timed = trip.firm
      .map((item, index) => ({ item, index }))
      .filter((entry) => !isDay(entry.item.when))
      .sort((a, b) => compare(a.item.when as never, b.item.when as never) || a.index - b.index)
      .map((entry) => entry.item);
    const covers = new Map(trip.firm.map((item) => [item, firmCover(item)]));
    const on = (item: FirmItem, date: string) => {
      const c = covers.get(item)!;
      return c.first <= date && date <= c.last;
    };

    const result: DayLayout[] = [];
    for (let d = from; d <= to; d++) {
      const date = dateOfDays(d);
      const here: Stretch[] = stretches.filter((s) => s.first <= date && date <= s.last);
      const countries = [...new Set(here.map((s) => s.place.country))];
      const firm = [...days.filter((item) => on(item, date)), ...timed.filter((item) => on(item, date))];
      result.push(Object.freeze({ date, countries, stretches: here, firm }));
    }
    return result;
  });
}

export function travelDuration(item: FirmItem): Duration | undefined {
  const arrive = item.travel?.arrive;
  if (!arrive || isDay(arrive) || isDay(item.when)) return undefined;
  const made = span(item.when, arrive);
  return made.ok ? duration(made.value) : undefined;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
