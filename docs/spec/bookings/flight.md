# The flight booking

**Assumes** [flight.md](../../requirements/bookings/flight.md) — what a flight booking promises, and its legs.

## 1. Purpose

The flight booking is the kind of booking that holds one or more flights booked together. It gives
`bookings/list`, the component that holds a trip's bookings, a flight's check, its times and its
label, and gives the web app how long each leg and each connection takes.

## 2. Scope

The flight booking covers a flight's legs, its airports, its seats, and the checks, times and label
of a flight.

Two things act on it:

- **`bookings/list`** calls its check, its times and its label for every booking of kind `flight`
  (`spec/bookings/list.md` §4).
- **The web app**, the system travellers use on a computer or a phone, builds flights, and shows
  each leg's duration and each connection.

Deliberately absent:

- what every booking has, such as its travellers and its details, which `bookings/list` holds and
  checks
- finding an airport's time zone, or checking that a code names a real airport
- a flight's live status

The flight booking is part of the package `@itinero/bookings`, which `spec/bookings/list.md`
describes. A flight is entered by hand, and importing one from a confirmation email is planned
(ADR-0016, a trip's bookings are entered by hand, as one of four kinds, and kept with the trip
online).

## 3. Interface

### 3.1 User interface

None. The web app shows what its functions return.

### 3.2 Application interface

None. A flight reaches the copy of a trip held online inside a change of `bookings/list`.

### 3.3 Programming interface

`@itinero/bookings` exports the types and functions below. `Common`, `TravellerId` and `Result` are
those of `spec/bookings/list.md` §3.3.

```ts
import type { TripTime, Duration } from "@itinero/trip-time";

type Airport = { code: string;        // an IATA airport code: three capitals, such as "SCL"
                 name?: string };      // such as "Santiago"
type Leg = { flight: string;           // such as "LA 800"
             from: Airport; to: Airport;
             leaves: TripTime;         // of kind exact, in the zone of `from`
             arrives: TripTime };      // of kind exact, in the zone of `to`
type Seat = { traveller: TravellerId; leg: number;   // leg: its place in `legs`, from 0
              seat: string };                        // such as "23A"

type FlightBooking = Common & { kind: "flight"; legs: readonly Leg[]; seats: readonly Seat[] };

function checkFlight(booking: FlightBooking): Result<FlightBooking>;
function flightTimes(booking: FlightBooking): { starts: TripTime; ends: TripTime };
function flightLabel(booking: FlightBooking): string;
function legDurations(booking: FlightBooking): Duration[];
function connections(booking: FlightBooking): Duration[];
```

| Refusal code | When |
|---|---|
| `no-legs` | A flight holding no leg |
| `too-many-legs` | A flight holding more than 8 legs |
| `bad-flight` | A flight number not in the form of §4.1 |
| `bad-airport` | An airport code that is not three capitals A to Z |
| `bad-text` | An airport name that is empty once trimmed, or longer than 200 characters |
| `exact-only` | A `leaves` or an `arrives` that is not of trip-time's kind `exact` |
| `travel-order` | A leg that certainly arrives before it leaves |
| `leg-order` | A leg that certainly leaves before the leg before it arrives |
| `bad-seat` | A seat that is empty once trimmed, or longer than 8 characters, or names a leg the flight does not hold |
| `seat-traveller` | A seat for a traveller the booking does not name |
| `duplicate-seat` | Two seats for one traveller on one leg |

Each refusal about a leg or a seat gives its place in `legs` or `seats`, from 0, in
`details.leg` or `details.seat`. `checkFlight` also returns any refusal trip-time's `create` gives
for a time, with its code unchanged.

### 3.4 Systems this drives

None. The flight booking calls only `@itinero/trip-time`.

## 4. Behaviour

### 4.1 checkFlight

*Plumbing:* `checkFlight(booking)` checks a flight's own fields, after `bookings/list` has checked
the fields every booking has (`BKG:FLIGHT-F1`, `BKG:FLIGHT-F2`, `BKG:FLIGHT-F4`). It makes its
checks in this order, and returns the first refusal found:

1. `legs` holds 1 to 8 legs, or `no-legs` or `too-many-legs`
2. for each leg, in order:
    - `flight`, once trimmed and with letters made capitals, is two letters or digits, an optional
      space, 1 to 4 digits, and an optional letter, such as `LA 800` or `IB6830`, or `bad-flight`
    - each airport's `code` is three capitals, or `bad-airport`, and its `name`, where present, is
      checked as `bad-text`
    - `leaves` and `arrives` are of kind `exact`, or `exact-only`, and each passes trip-time's
      `create`
    - trip-time's `span(leaves, arrives)` does not refuse with `span-order`, or `travel-order`
    - for each leg after the first, `span(arrives of the leg before, leaves)` does not refuse with
      `span-order`, or `leg-order`
3. for each seat, in order:
    - `seat`, once trimmed, is 1 to 8 characters, and `leg` is a place in `legs`, or `bad-seat`
    - `traveller` is among the booking's `travellers`, or `seat-traveller`
    - no seat before it has the same `traveller` and `leg`, or `duplicate-seat`

The flight given back has its flight numbers written in capitals, trimmed, and its seats sorted by
leg, then by traveller.

A leg's times are exact, so `span-order` is refused exactly when the leg arrives before it leaves,
in the moments the two times mean. A leg that arrives at the very moment it leaves is accepted.

### 4.2 flightTimes and flightLabel

*Porcelain:* `flightTimes(booking)` gives `starts`, the first leg's `leaves`, and `ends`, the last
leg's `arrives`.

`flightLabel(booking)` gives the first leg's flight number, a comma, and the first leg's `from` to
the last leg's `to`, each written as its `name` where present and as its `code` otherwise, such as
`LA 800, Santiago to Punta Arenas`. A flight of more than one leg adds the number of legs, as
`IB 6830, Santiago to Madrid, 2 flights`.

### 4.3 legDurations and connections

*Porcelain:* `legDurations(booking)` gives, for each leg in order, trip-time's `duration` of the
span from its `leaves` to its `arrives` (`BKG:FLIGHT-F3`). `connections(booking)` gives, for each
leg after the first, the `duration` of the span from the `arrives` of the leg before to its
`leaves`. A flight of one leg has no connection.

Each duration is exact, since both its ends are, so its `shortest` and `longest` are equal. The web
app writes each with trip-time's `formatDuration`.

## 5. Resources

A flight is held in the text form of `spec/bookings/list.md` §5.1, with these fields beside those
every booking has:

```json
{
  "kind": "flight",
  "legs": [
    {
      "arrives": "2026-12-06T10:30[America/Punta_Arenas]",
      "flight": "LA 800",
      "from": { "code": "SCL", "name": "Santiago" },
      "leaves": "2026-12-06T07:05[America/Santiago]",
      "to": { "code": "PUQ", "name": "Punta Arenas" }
    }
  ],
  "seats": [{ "leg": 0, "seat": "23A", "traveller": "acct-1" }]
}
```

| Resource | Path | Owned by |
|---|---|---|
| The flight booking | `packages/bookings/src/flight.ts` | Whoever keeps the bookings system's roadmap |

## 6. Quality attributes

- **Measured in the time that really passes** (`BKG:FLIGHT-F2`, `BKG:FLIGHT-F3`). Every order and
  duration is trip-time's, which compares moments, so a leg across time zones or a clock change is
  measured correctly.
- **Offline and the same on every device** (`BKG:LIST-NFR1`). The flight booking holds no network
  code and never reads the device's time zone. The tests of `spec/bookings/list.md` §4.6 cover it.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [BKG:FLIGHT-F1](../../requirements/bookings/flight.md#^bkg-flight-f1) | `Leg` and `Airport`, in §3.3, and the leg checks of §4.1. |
| [BKG:FLIGHT-F2](../../requirements/bookings/flight.md#^bkg-flight-f2) | The `travel-order` and `leg-order` refusals, each naming its leg (§4.1). |
| [BKG:FLIGHT-F3](../../requirements/bookings/flight.md#^bkg-flight-f3) | `legDurations` and `connections`, in §4.3. Showing them is `web/screens`. |
| [BKG:FLIGHT-F4](../../requirements/bookings/flight.md#^bkg-flight-f4) | `Seat`, in §3.3, and the seat checks of §4.1. |
| [BKG-F2](../../requirements/bookings/bookings.md#^bkg-f2) | A flight's times in each airport's local time, its refusals, and how long each leg takes (§4.1, §4.3). A journey's and a stay's are `bookings/journey` and `bookings/stay`. |

## 8. Open

None.
