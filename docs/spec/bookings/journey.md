# The journey booking

**Assumes** [journey.md](../../requirements/bookings/journey.md) — what a journey booking promises, and the four ways a journey goes.

## 1. Purpose

The journey booking is the kind of booking that holds a booked train, bus, ferry or hired car, from
one place to another. It gives `bookings/list`, the component that holds a trip's bookings, a
journey's check, its times and its label, and gives the web app how long a journey takes.

## 2. Scope

The journey booking covers how a journey goes, its two places, its times, who runs it, its service
and its seat, and the checks, times and label of a journey.

Two things act on it:

- **`bookings/list`** calls its check, its times and its label for every booking of kind `journey`
  (`spec/bookings/list.md` §4).
- **The web app**, the system travellers use on a computer or a phone, builds journeys, and shows
  how long each takes.

Deliberately absent:

- what every booking has, such as its travellers and its details, which `bookings/list` holds and
  checks
- the stops a journey makes on the way
- finding a place's time zone

The journey booking is part of the package `@itinero/bookings`, which `spec/bookings/list.md`
describes. A journey is entered by hand, and importing one is not planned (ADR-0016, a trip's
bookings are entered by hand, as one of four kinds, and kept with the trip online).

## 3. Interface

### 3.1 User interface

None. The web app shows what its functions return.

### 3.2 Application interface

None. A journey reaches the copy of a trip held online inside a change of `bookings/list`.

### 3.3 Programming interface

`@itinero/bookings` exports the types and functions below. `Common` and `Result` are those of
`spec/bookings/list.md` §3.3.

```ts
import type { TripTime, Duration } from "@itinero/trip-time";

type Way = "train" | "bus" | "ferry" | "car";       // "car": a hired car

type JourneyBooking = Common & { kind: "journey"; by: Way;
                                 from: string; to: string;    // such as "Punta Arenas"
                                 leaves: TripTime;            // of any kind, in the zone of `from`
                                 arrives?: TripTime;          // of any kind, in the zone of `to`
                                 operator?: string;           // such as "Bus-Sur"
                                 service?: string;            // such as "TGV 6611"
                                 seat?: string };             // such as "coach 12, seat 45"

function checkJourney(booking: JourneyBooking): Result<JourneyBooking>;
function journeyTimes(booking: JourneyBooking): { starts: TripTime; ends?: TripTime };
function journeyLabel(booking: JourneyBooking): string;
function journeyDuration(booking: JourneyBooking): Duration | undefined;
```

| Refusal code | When |
|---|---|
| `unknown-way` | A `by` that is not `train`, `bus`, `ferry` or `car` |
| `bad-text` | A `from` or a `to` that is empty once trimmed or longer than 200 characters, an `operator` the same, or a `service` or a `seat` that is empty once trimmed or longer than 64 |
| `travel-order` | A journey that certainly arrives before it leaves |
| `too-long` | A journey whose longest duration is more than 366 days |

`checkJourney` also returns any refusal trip-time's `create` gives for a time, with its code
unchanged.

### 3.4 Systems this drives

None. The journey booking calls only `@itinero/trip-time`.

## 4. Behaviour

### 4.1 checkJourney

*Plumbing:* `checkJourney(booking)` checks a journey's own fields, after `bookings/list` has checked
the fields every booking has (`BKG:JOURNEY-F1`, `BKG:JOURNEY-F2`, `BKG:JOURNEY-F3`). It makes its
checks in this order, and returns the first refusal found:

1. `by` is one of the four ways, or `unknown-way`
2. `from` and `to`, and `operator`, `service` and `seat` where present, with `bad-text`
3. `leaves`, and `arrives` where present, each pass trip-time's `create`, whatever their kind
4. where `arrives` is present, trip-time's `span(leaves, arrives)` does not refuse with
   `span-order`, or `travel-order`
5. where `arrives` is present, the `longest` of the span's `duration` is at most 527,040 minutes,
   which is 366 days, or `too-long`

`from` and `leaves` are in one place, and `to` and `arrives` in another, so the two times may be in
different zones. A hired car's `from` is where it is collected, and its `to` where it is returned,
which may be the same place.

### 4.2 journeyTimes, journeyLabel and journeyDuration

*Porcelain:* `journeyTimes(booking)` gives `starts`, the `leaves`, and `ends`, the `arrives`, which
is absent where the journey has none.

`journeyLabel(booking)` gives the way, then `from` and `to`: `Train from Lyon to Paris`,
`Bus from Punta Arenas to Puerto Natales`, `Ferry from Puerto Montt to Puerto Natales`, or
`Hired car from Santiago to Mendoza`.

`journeyDuration(booking)` gives trip-time's `duration` of the span from `leaves` to `arrives`, or
`undefined` where the journey has no `arrives` (`BKG:JOURNEY-F2`). Where either time covers more
than a moment, such as a window or a whole date, its `shortest` and `longest` differ, and the web
app writes it with trip-time's `formatDuration`, such as `3–4 h`. An approximate time counts as its
stated time, as trip-time counts it, so it gives no range.

## 5. Resources

A journey is held in the text form of `spec/bookings/list.md` §5.1, with these fields beside those
every booking has:

```json
{
  "arrives": "2026-12-09T16:00[America/Punta_Arenas]",
  "by": "bus",
  "from": "Punta Arenas",
  "kind": "journey",
  "leaves": "2026-12-09T13:00[America/Punta_Arenas]",
  "operator": "Bus-Sur",
  "to": "Puerto Natales"
}
```

| Resource | Path | Owned by |
|---|---|---|
| The journey booking | `packages/bookings/src/journey.ts` | Whoever keeps the bookings system's roadmap |

## 6. Quality attributes

- **Measured in the time that really passes** (`BKG:JOURNEY-F2`). Every order and duration is
  trip-time's, which compares moments, so a journey across time zones or a clock change is measured
  correctly.
- **Offline and the same on every device** (`BKG:LIST-NFR1`). The journey booking holds no network
  code and never reads the device's time zone. The tests of `spec/bookings/list.md` §4.6 cover it.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [BKG:JOURNEY-F1](../../requirements/bookings/journey.md#^bkg-journey-f1) | `JourneyBooking` and `Way`, in §3.3, and the checks of §4.1. |
| [BKG:JOURNEY-F2](../../requirements/bookings/journey.md#^bkg-journey-f2) | The `travel-order` and `too-long` refusals of §4.1, and `journeyDuration`, in §4.2. |
| [BKG:JOURNEY-F3](../../requirements/bookings/journey.md#^bkg-journey-f3) | `operator`, `service` and `seat`, in §3.3, checked in §4.1. |
| [BKG-F2](../../requirements/bookings/bookings.md#^bkg-f2) | A journey's times at each end in its own local time, its refusal, and how long it takes (§4.1, §4.2). A flight's and a stay's are `bookings/flight` and `bookings/stay`. |

## 8. Open

None.
