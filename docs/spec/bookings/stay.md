# The stay booking

**Assumes** [stay.md](../../requirements/bookings/stay.md) — what a stay booking promises, and the kinds of value its times can be.

## 1. Purpose

The stay booking is the kind of booking that holds one or more nights in one place. It gives
`bookings/list`, the component that holds a trip's bookings, a stay's check, its times and its
label, and gives the web app how many nights a stay is.

## 2. Scope

The stay booking covers a stay's name, its address, its check-in and check-out, and the checks,
times and label of a stay.

Two things act on it:

- **`bookings/list`** calls its check, its times and its label for every booking of kind `stay`
  (`spec/bookings/list.md` §4).
- **The web app**, the system travellers use on a computer or a phone, builds stays, and shows how
  many nights each one is.

Deliberately absent:

- what every booking has, such as its travellers and its details, which `bookings/list` holds and
  checks
- the rooms and guests of a stay
- finding a stay's time zone, or its place on a map

The stay booking is part of the package `@itinero/bookings`, which `spec/bookings/list.md`
describes. A stay is entered by hand, and importing one from a confirmation email is planned
(ADR-0016, a trip's bookings are entered by hand, as one of four kinds, and kept with the trip
online).

## 3. Interface

### 3.1 User interface

None. The web app shows what its functions return.

### 3.2 Application interface

None. A stay reaches the copy of a trip held online inside a change of `bookings/list`.

### 3.3 Programming interface

`@itinero/bookings` exports the types and functions below. `Common` and `Result` are those of
`spec/bookings/list.md` §3.3.

```ts
import type { TripTime } from "@itinero/trip-time";

type StayBooking = Common & { kind: "stay";
                              name: string;          // such as "Hostal Lady Florence"
                              address?: string;
                              checkIn: TripTime;     // of any kind
                              checkOut: TripTime };  // of any kind, in the zone of checkIn

function checkStay(booking: StayBooking): Result<StayBooking>;
function stayTimes(booking: StayBooking): { starts: TripTime; ends: TripTime };
function stayLabel(booking: StayBooking): string;
function nights(booking: StayBooking): number;
```

| Refusal code | When |
|---|---|
| `bad-text` | A name that is empty once trimmed or longer than 200 characters, or an address that is empty once trimmed or longer than 500 |
| `zone-mismatch` | A check-out in another time zone than the check-in |
| `stay-order` | A check-out on or before the date of the check-in |
| `stay-length` | A stay of more than 366 nights |

`checkStay` also returns any refusal trip-time's `create` gives for a time, with its code
unchanged.

### 3.4 Systems this drives

None. The stay booking calls only `@itinero/trip-time`.

## 4. Behaviour

### 4.1 checkStay

*Plumbing:* `checkStay(booking)` checks a stay's own fields, after `bookings/list` has checked the
fields every booking has (`BKG:STAY-F1`, `BKG:STAY-F2`). It makes its checks in this order, and
returns the first refusal found:

1. `name`, and `address` where present, with `bad-text`
2. `checkIn` and `checkOut` each pass trip-time's `create`, whatever their kind
3. `checkOut` has the same `zone` as `checkIn`, written the same way, or `zone-mismatch`
4. the `date` of `checkOut` is after the last local date of `checkIn`, or `stay-order`
5. `nights` is at most 366, or `stay-length`

The last local date of a value is its `endDate` for trip-time's `window` kind, and its `date` for
every other kind. A check-in window ending after midnight therefore counts from the date it ends.

### 4.2 stayTimes, stayLabel and nights

*Porcelain:* `stayTimes(booking)` gives `starts`, the `checkIn`, and `ends`, the `checkOut`.
`stayLabel(booking)` gives the stay's `name`. A stay therefore covers every date from its check-in
to its check-out, both included (`BKG:STAY-F3`, `spec/bookings/list.md` §4.3).

`nights(booking)` gives the number of days from the `date` of `checkIn` to the `date` of
`checkOut`, counted in the Gregorian calendar (`BKG:STAY-F3`). A stay from 9 to 12 December is 3
nights.

## 5. Resources

A stay is held in the text form of `spec/bookings/list.md` §5.1, whose example is a stay.

| Resource | Path | Owned by |
|---|---|---|
| The stay booking | `packages/bookings/src/stay.ts` | Whoever keeps the bookings system's roadmap |

## 6. Quality attributes

- **As precise as the confirmation** (`BKG:STAY-F2`). A check-in and a check-out are each of any
  kind trip-time holds, and trip-time orders them among every other booking.
- **Offline and the same on every device** (`BKG:LIST-NFR1`). The stay booking holds no network
  code and never reads the device's time zone. The tests of `spec/bookings/list.md` §4.6 cover it.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [BKG:STAY-F1](../../requirements/bookings/stay.md#^bkg-stay-f1) | `StayBooking`, in §3.3, and the checks of §4.1. |
| [BKG:STAY-F2](../../requirements/bookings/stay.md#^bkg-stay-f2) | A check-in and a check-out of any kind, each passed to trip-time's `create` (§4.1). |
| [BKG:STAY-F3](../../requirements/bookings/stay.md#^bkg-stay-f3) | `nights` and `stayTimes`, in §4.2. The dates covered are worked out by `bookings/list`'s `extent`. |
| [BKG-F2](../../requirements/bookings/bookings.md#^bkg-f2) | A stay's check-in and check-out in its own local time, and the `stay-order` refusal (§4.1). A flight's and a journey's are `bookings/flight` and `bookings/journey`. |

## 8. Open

None.
