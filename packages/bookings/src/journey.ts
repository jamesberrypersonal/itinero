// The journey booking (spec/bookings/journey.md): how it goes, its two places, its times, who runs
// it, its service and its seat, its check (§4.1), and its times, label and duration (§4.2).

import { duration, toText, type Duration, type TripTime } from "@itinero/trip-time";
import { MAX_MINUTES, certainlyBefore, checkText, checkTime, longest, optionalCheckText } from "./check.ts";
import { optionalText, present, text } from "./form.ts";
import { checkOwn, type KindOps } from "./kind.ts";
import { fail, type Common, type Result } from "./types.ts";

export type Way = "train" | "bus" | "ferry" | "car";

export type JourneyBooking = Common & {
  kind: "journey";
  by: Way;
  from: string;
  to: string;
  leaves: TripTime;
  arrives?: TripTime;
  operator?: string;
  service?: string;
  seat?: string;
};

const WAYS: readonly Way[] = ["train", "bus", "ferry", "car"];
const NAMES: Record<Way, string> = { train: "Train", bus: "Bus", ferry: "Ferry", car: "Hired car" };
const MAX_PLACE = 200;
const MAX_OPERATOR = 200;
const MAX_SHORT = 64;

function check(booking: JourneyBooking): JourneyBooking {
  if (!WAYS.includes(booking.by)) {
    fail("unknown-way", `The way ${JSON.stringify(booking.by)} is not one a journey goes, which are ${WAYS.join(", ")}. A flight is a booking of its own kind.`);
  }
  const from = checkText(booking.from, "place the journey leaves from", MAX_PLACE);
  const to = checkText(booking.to, "place the journey arrives at", MAX_PLACE);
  const operator = optionalCheckText(booking.operator, "journey's operator", MAX_OPERATOR);
  const service = optionalCheckText(booking.service, "journey's service", MAX_SHORT);
  const seat = optionalCheckText(booking.seat, "journey's seat", MAX_SHORT);
  const leaves = checkTime(booking.leaves);
  const arrives = booking.arrives === undefined ? undefined : checkTime(booking.arrives);
  if (arrives) {
    if (certainlyBefore(leaves, arrives)) fail("travel-order", "The journey arrives before it leaves.");
    if (longest(leaves, arrives) > MAX_MINUTES) fail("too-long", "The journey takes more than 366 days.");
  }
  return Object.freeze(present({ ...booking, from, to, leaves }, { arrives, operator, service, seat }));
}

export function journeyTimes(booking: JourneyBooking): { starts: TripTime; ends?: TripTime } {
  return Object.freeze(present({ starts: booking.leaves } as { starts: TripTime; ends?: TripTime }, { ends: booking.arrives }));
}

export function journeyLabel(booking: JourneyBooking): string {
  return `${NAMES[booking.by] ?? booking.by} from ${booking.from} to ${booking.to}`;
}

export function journeyDuration(booking: JourneyBooking): Duration | undefined {
  return booking.arrives === undefined ? undefined : duration({ start: booking.leaves, end: booking.arrives });
}

export const journeyOps: KindOps<JourneyBooking> = {
  required: ["by", "from", "to", "leaves"],
  optional: ["arrives", "operator", "service", "seat"],
  read: (r, time) =>
    present(
      {
        by: text(r.by, "journey's way") as Way,
        from: text(r.from, "place the journey leaves from"),
        to: text(r.to, "place the journey arrives at"),
        leaves: time(r.leaves, "journey's departure"),
      },
      {
        arrives: r.arrives === undefined ? undefined : time(r.arrives, "journey's arrival"),
        operator: optionalText(r, "operator", "journey's operator"),
        service: optionalText(r, "service", "journey's service"),
        seat: optionalText(r, "seat", "journey's seat"),
      },
    ),
  check,
  times: journeyTimes,
  label: journeyLabel,
  toJson: (booking) =>
    present(
      { by: booking.by, from: booking.from, to: booking.to, leaves: toText(booking.leaves) },
      {
        arrives: booking.arrives === undefined ? undefined : toText(booking.arrives),
        operator: booking.operator,
        service: booking.service,
        seat: booking.seat,
      },
    ),
};

export function checkJourney(booking: JourneyBooking): Result<JourneyBooking> {
  return checkOwn(booking, "journey", journeyOps);
}
