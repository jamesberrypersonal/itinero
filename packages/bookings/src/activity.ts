// The activity booking (spec/bookings/activity.md): its sort, title, place, start and end, its
// check (§4.1), and its times and label (§4.2).

import { toText, type TripTime } from "@itinero/trip-time";
import { MAX_MINUTES, certainlyBefore, checkText, checkTime, longest, optionalCheckText } from "./check.ts";
import { optionalText, present, text } from "./form.ts";
import { checkOwn, type KindOps } from "./kind.ts";
import { fail, type Common, type Result } from "./types.ts";

export type Sort = "tour" | "ticket" | "table" | "other";

export type ActivityBooking = Common & { kind: "activity"; sort: Sort; title: string; where?: string; starts: TripTime; ends?: TripTime };

const SORTS: readonly Sort[] = ["tour", "ticket", "table", "other"];
const MAX_TITLE = 200;
const MAX_WHERE = 500;

function check(booking: ActivityBooking): ActivityBooking {
  if (!SORTS.includes(booking.sort)) fail("unknown-sort", `The sort ${JSON.stringify(booking.sort)} is not one an activity is, which are ${SORTS.join(", ")}.`);
  const title = checkText(booking.title, "activity's title", MAX_TITLE);
  const where = optionalCheckText(booking.where, "activity's place", MAX_WHERE);
  const starts = checkTime(booking.starts);
  const ends = booking.ends === undefined ? undefined : checkTime(booking.ends);
  if (ends) {
    if (certainlyBefore(starts, ends)) fail("end-order", "The activity ends before it starts.");
    if (longest(starts, ends) > MAX_MINUTES) fail("too-long", "The activity lasts more than 366 days.");
  }
  return Object.freeze(present({ ...booking, title, starts }, { where, ends }));
}

export function activityTimes(booking: ActivityBooking): { starts: TripTime; ends?: TripTime } {
  return Object.freeze(present({ starts: booking.starts } as { starts: TripTime; ends?: TripTime }, { ends: booking.ends }));
}

export function activityLabel(booking: ActivityBooking): string {
  return booking.title;
}

export const activityOps: KindOps<ActivityBooking> = {
  required: ["sort", "title", "starts"],
  optional: ["where", "ends"],
  read: (r, time) =>
    present(
      { sort: text(r.sort, "activity's sort") as Sort, title: text(r.title, "activity's title"), starts: time(r.starts, "activity's start") },
      { where: optionalText(r, "where", "activity's place"), ends: r.ends === undefined ? undefined : time(r.ends, "activity's end") },
    ),
  check,
  times: activityTimes,
  label: activityLabel,
  toJson: (booking) =>
    present(
      { sort: booking.sort, title: booking.title, starts: toText(booking.starts) },
      { where: booking.where, ends: booking.ends === undefined ? undefined : toText(booking.ends) },
    ),
};

export function checkActivity(booking: ActivityBooking): Result<ActivityBooking> {
  return checkOwn(booking, "activity", activityOps);
}
