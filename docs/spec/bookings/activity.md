# The activity booking

**Assumes** [activity.md](../../requirements/bookings/activity.md) — what an activity booking promises, and its four sorts.

## 1. Purpose

The activity booking is the kind of booking that holds something booked at one place, such as a
tour, a ticket or a table, and any booking that fits no other kind. It gives `bookings/list`, the
component that holds a trip's bookings, an activity's check, its times and its label.

## 2. Scope

The activity booking covers an activity's sort, its title, its place, its start and end, and the
checks, times and label of an activity.

Two things act on it:

- **`bookings/list`** calls its check, its times and its label for every booking of kind `activity`
  (`spec/bookings/list.md` §4).
- **The web app**, the system travellers use on a computer or a phone, builds activities, and marks
  each by its sort.

Deliberately absent:

- what every booking has, such as its travellers and its details, which `bookings/list` holds and
  checks
- finding a place's time zone

The activity booking is part of the package `@itinero/bookings`, which `spec/bookings/list.md`
describes. An activity is entered by hand, and importing one is not planned (ADR-0016, a trip's
bookings are entered by hand, as one of four kinds, and kept with the trip online).

## 3. Interface

### 3.1 User interface

None. The web app shows what its functions return.

### 3.2 Application interface

None. An activity reaches the copy of a trip held online inside a change of `bookings/list`.

### 3.3 Programming interface

`@itinero/bookings` exports the types and functions below. `Common` and `Result` are those of
`spec/bookings/list.md` §3.3.

```ts
import type { TripTime } from "@itinero/trip-time";

type Sort = "tour" | "ticket" | "table" | "other";

type ActivityBooking = Common & { kind: "activity"; sort: Sort;
                                  title: string;        // such as "Torres del Paine full day"
                                  where?: string;       // such as "Puerto Natales, Plaza de Armas"
                                  starts: TripTime;     // of any kind
                                  ends?: TripTime };    // of any kind

function checkActivity(booking: ActivityBooking): Result<ActivityBooking>;
function activityTimes(booking: ActivityBooking): { starts: TripTime; ends?: TripTime };
function activityLabel(booking: ActivityBooking): string;
```

| Refusal code | When |
|---|---|
| `unknown-sort` | A `sort` that is not `tour`, `ticket`, `table` or `other` |
| `bad-text` | A title that is empty once trimmed or longer than 200 characters, or a `where` that is empty once trimmed or longer than 500 |
| `end-order` | An activity that certainly ends before it starts |
| `too-long` | An activity whose longest duration is more than 366 days |

`checkActivity` also returns any refusal trip-time's `create` gives for a time, with its code
unchanged.

### 3.4 Systems this drives

None. The activity booking calls only `@itinero/trip-time`.

## 4. Behaviour

### 4.1 checkActivity

*Plumbing:* `checkActivity(booking)` checks an activity's own fields, after `bookings/list` has
checked the fields every booking has (`BKG:ACTIVITY-F1`, `BKG:ACTIVITY-F2`). It makes its checks in
this order, and returns the first refusal found:

1. `sort` is one of the four, or `unknown-sort`
2. `title`, and `where` where present, with `bad-text`
3. `starts`, and `ends` where present, each pass trip-time's `create`, whatever their kind
4. where `ends` is present, trip-time's `span(starts, ends)` does not refuse with `span-order`, or
   `end-order`
5. where `ends` is present, the `longest` of the span's `duration` is at most 527,040 minutes,
   which is 366 days, or `too-long`

`ends` may be in another zone than `starts`, such as a cruise that ends in another country.

### 4.2 activityTimes and activityLabel

*Porcelain:* `activityTimes(booking)` gives `starts` and `ends` as the activity holds them. An
activity whose `starts` is a window, such as 14:00 to 16:00, and that has no `ends`, covers the
dates of its window (`spec/bookings/list.md` §4.3). `activityLabel(booking)` gives its `title`.

## 5. Resources

An activity is held in the text form of `spec/bookings/list.md` §5.1, with these fields beside those
every booking has:

```json
{
  "ends": "2026-12-10T19:00[America/Punta_Arenas]",
  "kind": "activity",
  "sort": "tour",
  "starts": "2026-12-10T07:30[America/Punta_Arenas]",
  "title": "Torres del Paine full day",
  "where": "Puerto Natales, Plaza de Armas"
}
```

| Resource | Path | Owned by |
|---|---|---|
| The activity booking | `packages/bookings/src/activity.ts` | Whoever keeps the bookings system's roadmap |

## 6. Quality attributes

- **As precise as the booking** (`BKG:ACTIVITY-F1`). A start and an end are each of any kind
  trip-time holds, and trip-time orders them among every other booking.
- **Offline and the same on every device** (`BKG:LIST-NFR1`). The activity booking holds no network
  code and never reads the device's time zone. The tests of `spec/bookings/list.md` §4.6 cover it.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [BKG:ACTIVITY-F1](../../requirements/bookings/activity.md#^bkg-activity-f1) | `ActivityBooking` and `Sort`, in §3.3, and the checks of §4.1. |
| [BKG:ACTIVITY-F2](../../requirements/bookings/activity.md#^bkg-activity-f2) | The `end-order` and `too-long` refusals of §4.1, and `activityTimes`, in §4.2. The dates covered are worked out by `bookings/list`'s `extent`. |
| [BKG-F2](../../requirements/bookings/bookings.md#^bkg-f2) | An activity's start in the local time of its place (§3.3). A flight's, a stay's and a journey's are `bookings/flight`, `bookings/stay` and `bookings/journey`. |

## 8. Open

None.
