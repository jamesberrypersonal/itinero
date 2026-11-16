// Prints, as JSON, what the bookings list gives for a set of bookings. independence.test.ts runs it
// under two device time zones, and each kind adds its bookings to the set.

import { apply, bookingToText, connections, extent, label, journeyDuration, legDurations, nights, notOver, onDate, order, type Booking, type FlightBooking, type JourneyBooking, type StayBooking } from "../../src/index.ts";
import { MADRID, MENDOZA, PUNTA_ARENAS, SANTIAGO, airport, approx, busToNatales, date, december, exact, flight, journey, la800, ladyFlorence, leg, loadNewestRules, ok, window } from "../helpers.ts";

loadNewestRules();
const held = (booking: Booking) => ok(apply(undefined, { op: "add", booking }))!;

const flights = [
  la800(),
  flight("ib", [leg("IB 6830", airport("SCL"), exact(SANTIAGO, december(1), "23:40"), airport("MAD"), exact(MADRID, december(2), "16:35"))]),
].map(held) as FlightBooking[];
const stays = [
  ladyFlorence(),
  ladyFlorence("late", { checkIn: window(PUNTA_ARENAS, december(1), "22:00", "01:00", december(2)), checkOut: approx(PUNTA_ARENAS, december(3), "11:00") }),
].map(held) as StayBooking[];
const journeys = [
  busToNatales(),
  journey("ferry", "ferry", "Puerto Montt", "Puerto Natales", date(SANTIAGO, december(2))),
  journey("car", "car", "Santiago", "Mendoza", window(SANTIAGO, december(2), "09:00", "10:00"), { arrives: exact(MENDOZA, december(9), "18:00") }),
].map(held) as JourneyBooking[];
const bookings: Booking[] = [...flights, ...stays, ...journeys];

console.log(
  JSON.stringify({
    order: order(bookings).map((b) => b.id),
    extents: bookings.map(extent),
    labels: bookings.map(label),
    onDate: [1, 2, 3, 6, 9, 12].map((d) => onDate(bookings, december(d)).map((b) => b.id)),
    notOver: notOver(bookings, exact(SANTIAGO, december(2), "12:00")).map((b) => b.id),
    durations: flights.map((f) => [legDurations(f), connections(f)]),
    nights: stays.map(nights),
    journeys: journeys.map(journeyDuration),
    texts: bookings.map(bookingToText),
  }),
);
