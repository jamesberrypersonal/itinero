// The traveller's clock and date order (docs/spec/web/screens.md §4.8). Until they choose, both
// follow the device's language, as the browser's Intl.DateTimeFormat gives it. The choice is kept in
// localStorage, which signing out leaves, since it holds nothing of any trip.

import type { TextStyle } from "@itinero/trip-time";

const KEY = "itinero-style";

/** The style the device's own language gives: its clock, and whether it writes the day first. */
export function deviceStyle(locale?: string): TextStyle {
  const clock = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
  const parts = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric" }).formatToParts(new Date(Date.UTC(2026, 0, 15)));
  const day = parts.findIndex((part) => part.type === "day");
  const month = parts.findIndex((part) => part.type === "month");
  return { clock: clock === "h11" || clock === "h12" ? "12h" : "24h", dateOrder: day < month ? "day-first" : "month-first" };
}

function readKept(): TextStyle | undefined {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<TextStyle> | null;
    if (kept && (kept.clock === "12h" || kept.clock === "24h") && (kept.dateOrder === "day-first" || kept.dateOrder === "month-first")) {
      return { clock: kept.clock, dateOrder: kept.dateOrder };
    }
  } catch {
    // Storage refused, or not a style: the device's own.
  }
  return undefined;
}

let current: TextStyle | undefined;
const listeners = new Set<(style: TextStyle) => void>();

/** The style every time is written in. */
export function style(): TextStyle {
  current ??= readKept() ?? deviceStyle();
  return current;
}

/** Keeps the traveller's choice on the device, and redraws every time. */
export function chooseStyle(next: TextStyle): void {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept for this window only.
  }
  for (const listener of listeners) listener(next);
}

export function onStyle(listener: (style: TextStyle) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
