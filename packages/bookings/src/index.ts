// @itinero/bookings: a trip's bookings, what every booking has, and each kind of booking.
// docs/spec/bookings/list.md specifies it, with a specification for each kind beside it, and their
// section numbers are cited throughout.

export type {
  Airport,
  FlightBooking,
  Leg,
  Seat,
} from "./flight.ts";

export type { StayBooking } from "./stay.ts";

export type {
  Booking,
  Change,
  Common,
  Details,
  Duration,
  Extent,
  Id,
  LocalDate,
  PageId,
  Refusal,
  Result,
  Touches,
  TravellerId,
  TripTime,
} from "./types.ts";

export { check, touches, apply, extent, label, order, onDate, notOver } from "./list.ts";
export { checkFlight, flightTimes, flightLabel, legDurations, connections } from "./flight.ts";
export { checkStay, stayTimes, stayLabel, nights } from "./stay.ts";
export { bookingToText, bookingFromText, changeToText, changeFromText } from "./text.ts";
