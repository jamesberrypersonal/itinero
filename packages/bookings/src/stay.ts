// The stay booking (spec/bookings/stay.md): its name, address, check-in and check-out, its check
// (§4.1), and its times, label and nights (§4.2).

import { toText, type TripTime } from "@itinero/trip-time";
import { checkText, checkTime, lastDate, optionalCheckText } from "./check.ts";
import { daysOf } from "./dates.ts";
import { optionalText, present, text } from "./form.ts";
import { checkOwn, type KindOps } from "./kind.ts";
import { fail, type Common, type Result } from "./types.ts";

export type StayBooking = Common & { kind: "stay"; name: string; address?: string; checkIn: TripTime; checkOut: TripTime };

const MAX_NAME = 200;
const MAX_ADDRESS = 500;
const MAX_NIGHTS = 366;

export function nights(booking: StayBooking): number {
  return daysOf(booking.checkOut.date)! - daysOf(booking.checkIn.date)!;
}

function check(booking: StayBooking): StayBooking {
  const name = checkText(booking.name, "stay's name", MAX_NAME);
  const address = optionalCheckText(booking.address, "stay's address", MAX_ADDRESS);
  const checkIn = checkTime(booking.checkIn);
  const checkOut = checkTime(booking.checkOut);
  if (checkOut.zone !== checkIn.zone) {
    fail("zone-mismatch", `The stay checks in in the time zone ${checkIn.zone}, and checks out in another, ${checkOut.zone}.`);
  }
  if (checkOut.date <= lastDate(checkIn)) {
    fail("stay-order", `The stay checks out on ${checkOut.date}, and a stay checks out on a later date than it checks in, ${lastDate(checkIn)}.`);
  }
  const stay = present({ ...booking, name, checkIn, checkOut }, { address });
  const n = nights(stay);
  if (n > MAX_NIGHTS) fail("stay-length", `The stay is ${n} nights, and a stay is at most ${MAX_NIGHTS}.`);
  return Object.freeze(stay);
}

export function stayTimes(booking: StayBooking): { starts: TripTime; ends: TripTime } {
  return Object.freeze({ starts: booking.checkIn, ends: booking.checkOut });
}

export function stayLabel(booking: StayBooking): string {
  return booking.name;
}

export const stayOps: KindOps<StayBooking> = {
  required: ["name", "checkIn", "checkOut"],
  optional: ["address"],
  read: (r, time) =>
    present(
      { name: text(r.name, "stay's name"), checkIn: time(r.checkIn, "stay's check-in"), checkOut: time(r.checkOut, "stay's check-out") },
      { address: optionalText(r, "address", "stay's address") },
    ),
  check,
  times: stayTimes,
  label: stayLabel,
  toJson: (booking) =>
    present(
      { name: booking.name, checkIn: toText(booking.checkIn), checkOut: toText(booking.checkOut) },
      { address: booking.address },
    ),
};

export function checkStay(booking: StayBooking): Result<StayBooking> {
  return checkOwn(booking, "stay", stayOps);
}
