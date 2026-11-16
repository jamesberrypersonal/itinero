// Prints, as JSON, what the bookings list gives for a set of bookings. independence.test.ts runs it
// under two device time zones, and each kind adds its bookings to the set.

import { apply, bookingToText, connections, extent, label, legDurations, notOver, onDate, order, type Booking, type FlightBooking } from "../../src/index.ts";
import { MADRID, SANTIAGO, airport, december, exact, flight, la800, leg, loadNewestRules, ok } from "../helpers.ts";

loadNewestRules();
const held = (booking: Booking) => ok(apply(undefined, { op: "add", booking }))!;

const flights = [
  la800(),
  flight("ib", [leg("IB 6830", airport("SCL"), exact(SANTIAGO, december(1), "23:40"), airport("MAD"), exact(MADRID, december(2), "16:35"))]),
].map(held) as FlightBooking[];
const bookings: Booking[] = [...flights];

console.log(
  JSON.stringify({
    order: order(bookings).map((b) => b.id),
    extents: bookings.map(extent),
    labels: bookings.map(label),
    onDate: [1, 2, 6].map((d) => onDate(bookings, december(d)).map((b) => b.id)),
    notOver: notOver(bookings, exact(SANTIAGO, december(2), "12:00")).map((b) => b.id),
    durations: flights.map((f) => [legDurations(f), connections(f)]),
    texts: bookings.map(bookingToText),
  }),
);
