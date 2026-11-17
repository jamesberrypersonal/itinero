// The home page's day (docs/spec/web/screens.md §4.3), and the moments the screens read from the
// device's clock. Kept apart from the browser's APIs, so that Node's test runner tests it.

import type { Dates } from "@itinero/itinerary";
import type { TripTime } from "@itinero/trip-time";

export type TravellerDay = { kind: "before"; days: number } | { kind: "during"; day: number; of: number } | { kind: "over" };

/** Days from 1970-01-01 to a local date, written YYYY-MM-DD. */
function daysOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Where today falls against the traveller's own dates: days to go, which day, or over. */
export function dayOf(today: string, mine: Dates): TravellerDay {
  const now = daysOf(today);
  const first = daysOf(mine.first);
  const last = daysOf(mine.last);
  if (now < first) return { kind: "before", days: first - now };
  if (now > last) return { kind: "over" };
  return { kind: "during", day: now - first + 1, of: last - first + 1 };
}

/** What the home page says of the day. */
export function dayWords(day: TravellerDay): string {
  switch (day.kind) {
    case "before":
      return day.days === 1 ? "1 day to go" : `${day.days} days to go`;
    case "during":
      return `Day ${day.day} of ${day.of}`;
    case "over":
      return "Your trip is over";
  }
}

const two = (n: number) => String(n).padStart(2, "0");

/** Today's date, as the device's own clock and time zone give it (§4.3). */
export function localToday(now: Date): string {
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/**
 * Now, as an exact time in the zone Etc/UTC, made with the methods of Date that read UTC and never
 * the device's time zone (spec/bookings/list.md §4.4).
 */
export function utcNow(now: Date): TripTime {
  return {
    kind: "exact",
    zone: "Etc/UTC",
    date: `${now.getUTCFullYear()}-${two(now.getUTCMonth() + 1)}-${two(now.getUTCDate())}`,
    at: { time: `${two(now.getUTCHours())}:${two(now.getUTCMinutes())}` },
  };
}
