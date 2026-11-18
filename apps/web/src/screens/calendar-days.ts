// The calendar's days (docs/spec/web/screens.md §4.4): each day's countries and stretches, and its
// firm items and bookings in one order. Kept apart from the browser's APIs, so that Node's test
// runner tests it.

import { extent as bookingExtent, type Booking } from "@itinero/bookings";
import { extent as tripExtent, layout, type Dates, type DayLayout, type FirmItem, type Stretch, type Trip } from "@itinero/itinerary";
import { compare, type TripTime } from "@itinero/trip-time";

/** A thing standing apart from the stretches on a day: a firm item or a booking. */
export type Fixed = { kind: "firm"; item: FirmItem } | { kind: "booking"; booking: Booking };

export type CalendarDay = { date: string; countries: readonly string[]; stretches: readonly Stretch[]; fixed: readonly Fixed[] };

/** The days the calendar lists: the trip's dates, or across the itinerary's extent where the trip has none. */
export function calendarRange(trip: Trip, dates: Dates | undefined): Dates | undefined {
  if (dates && dates.first && dates.last) return dates;
  return tripExtent(trip);
}

/**
 * A day's firm items and bookings, in one order. The firm items whose `when` is a day come first, as
 * `layout` gives them. Every other firm item and every booking follow, ordered together by
 * trip-time's order on the firm item's `when` and the booking's `starts`, the earlier first where
 * two are equal.
 */
export function dayFixed(day: DayLayout, bookings: readonly Booking[]): Fixed[] {
  const allDay = day.firm.filter((item) => item.when.kind === "day").map((item): Fixed => ({ kind: "firm", item }));
  const timed: { fixed: Fixed; at: TripTime; index: number }[] = [];
  for (const item of day.firm) {
    if (item.when.kind !== "day") timed.push({ fixed: { kind: "firm", item }, at: item.when, index: timed.length });
  }
  for (const booking of bookings) {
    const { first, last, starts } = bookingExtent(booking);
    if (first <= day.date && day.date <= last) timed.push({ fixed: { kind: "booking", booking }, at: starts, index: timed.length });
  }
  timed.sort((a, b) => compare(a.at, b.at) || a.index - b.index);
  return [...allDay, ...timed.map((entry) => entry.fixed)];
}

/** Every day of the calendar, or none where the trip has no dates and nothing on it. */
export function calendarDays(trip: Trip, dates: Dates | undefined, bookings: readonly Booking[]): CalendarDay[] {
  const range = calendarRange(trip, dates);
  if (!range) return [];
  const laid = layout(trip, range.first, range.last);
  if (!laid.ok) return [];
  return laid.value.map((day) => ({ date: day.date, countries: day.countries, stretches: day.stretches, fixed: dayFixed(day, bookings) }));
}
