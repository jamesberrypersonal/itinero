// Dates written in the traveller's style (docs/spec/web/screens.md §4.8), where a date has no zone of
// its own, such as a trip's first and last. Every time with a zone is written with trip-time's
// `format`. Kept apart from the browser's APIs, so that Node's test runner tests it.

import type { Dates } from "@itinero/itinerary";
import type { TextStyle } from "@itinero/trip-time";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

/** A date, such as `9 Dec` or `Dec 9`, with its year where asked, and its weekday where asked. */
export function dateWords(date: string, style: TextStyle, options: { year?: boolean; weekday?: boolean } = {}): string {
  const { y, m, d } = parts(date);
  const month = MONTHS[m - 1]!;
  const day = style.dateOrder === "day-first" ? `${d} ${month}` : `${month} ${d}`;
  const weekday = options.weekday ? `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ` : "";
  if (!options.year) return `${weekday}${day}`;
  return style.dateOrder === "day-first" ? `${weekday}${day} ${y}` : `${weekday}${day}, ${y}`;
}

/** A trip's dates, such as `1 – 20 Dec 2026` or `Dec 1 – 20, 2026`. */
export function datesWords(dates: Dates, style: TextStyle): string {
  if (!dates.first) return "";
  const a = parts(dates.first);
  const b = parts(dates.last);
  if (dates.first === dates.last) return dateWords(dates.first, style, { year: true });
  if (a.y === b.y && a.m === b.m) {
    const month = MONTHS[a.m - 1]!;
    return style.dateOrder === "day-first" ? `${a.d} – ${b.d} ${month} ${a.y}` : `${month} ${a.d} – ${b.d}, ${a.y}`;
  }
  if (a.y === b.y) return `${dateWords(dates.first, style)} – ${dateWords(dates.last, style, { year: true })}`;
  return `${dateWords(dates.first, style, { year: true })} – ${dateWords(dates.last, style, { year: true })}`;
}

/** A moment on the device's own clock, such as when a trip was last brought up to date. */
export function momentWords(time: number, style: TextStyle, now: number): string {
  const at = new Date(time);
  const hours = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, "0");
  const clock = style.clock === "24h" ? `${String(hours).padStart(2, "0")}:${minutes}` : `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
  const today = new Date(now);
  const sameDay = at.getFullYear() === today.getFullYear() && at.getMonth() === today.getMonth() && at.getDate() === today.getDate();
  if (sameDay) return `today at ${clock}`;
  const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  return `${dateWords(date, style)} at ${clock}`;
}
