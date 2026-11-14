# The itinerary component

**Assumes** [itinerary.md](../../requirements/planner/itinerary.md) — what the itinerary promises, and the parts of a trip it holds.

## 1. Purpose

The itinerary is the component, built as one package, that holds a trip's calendar: the stretches a traveller pencils in,
and the firm items fixed to a date. Other components, such as the web app, use it to build a trip,
apply each change to it, lay its days out, and write it as text. It works the same in a browser with
no connection as on a server.

## 2. Scope

The itinerary covers a trip's name, its stretches, its firm items, the changes that edit them, the
day-by-day layout, and the text form a trip and a change are stored and sent in.

Two things act on it:

- **A caller**, such as the web app, builds changes, applies them, and lays out days (§3.3).
- **The component holding the copy of each trip online** applies every change a traveller makes,
  and sends the changed trip back. That component is not yet registered (§8).

Deliberately absent:

- storing a trip, or sending a trip or a change between devices
- deciding who may see or change a trip, which is the access system's
- finding a place's time zone. The caller gives every time's zone
- warning of gaps, overlaps or missing travel (ADR-0009, a trip's calendar is pencilled in)
- merging changes made on two devices while apart (ADR-0004, a trip is read-only offline)
- a trip's pages, which are `planner/pages`
- reading the device's clock or its time zone

A trip's calendar is pencilled in, and only its firm items are fixed (ADR-0009, a trip's calendar
is pencilled in). Every stretch is therefore pencilled in, and nothing in a stretch is checked
against a firm item, or against another stretch.

A stretch or a firm item can name one page of the trip (ADR-0010, a trip's pages form a tree, with
links between any two). The page belongs to `planner/pages`, the component that holds a trip's
pages, and the itinerary never checks that it exists.

The itinerary is written in TypeScript, as one package that runs unchanged in the browser and on
Node.js, the JavaScript runtime servers use. It holds every time as a value of `shared/trip-time`,
the package that holds dates and times in the local time of their place.

## 3. Interface

### 3.1 User interface

None. The itinerary has no user interface. The web app shows what its functions return.

### 3.2 Application interface

None. The itinerary has no network or service interface. A change reaches the copy of a trip held
online through the component that holds it (§8).

### 3.3 Programming interface

The package `@itinero/itinerary` exports the types and functions below. Every value is a frozen
object. No function changes its arguments. Every function gives a result that depends only on its
arguments and the time-zone rules trip-time last loaded.

```ts
import type { TripTime, LocalDate, Duration, Refusal, Result } from "@itinero/trip-time";

type Id = string;            // 1 to 64 of A–Z, a–z, 0–9, "-" and "_", unique within a trip
type Country = string;       // an ISO 3166-1 alpha-2 code, such as "FR"
type Place = { country: Country; name?: string };      // name: somewhere in the country

type PageId = string;        // a page of the trip, as planner/pages names it

type Stretch = { id: Id; place: Place; first: LocalDate; last: LocalDate; page?: PageId };

type Day = { kind: "day"; date: LocalDate };           // a date with no time
type When = Day | TripTime;                             // TripTime of a kind holding a time
type Way = "flight" | "train" | "bus" | "ferry" | "car" | "other";
type Travel = { from: Place; to: Place; by: Way; arrive?: When };

type FirmItem = { id: Id; title: string; when: When; travel?: Travel; page?: PageId };

type Trip = { format: 1; id: Id; name: string; revision: number;
              stretches: readonly Stretch[]; firm: readonly FirmItem[] };

type Change =
  | { op: "rename";         name: string }
  | { op: "pencil";         stretch: Stretch }
  | { op: "move";           id: Id; first: LocalDate; last: LocalDate }
  | { op: "re-place";       id: Id; place: Place }
  | { op: "remove-stretch"; id: Id }
  | { op: "add-firm";       item: FirmItem }
  | { op: "change-firm";    item: FirmItem }
  | { op: "remove-firm";    id: Id };

type DayLayout = { date: LocalDate; countries: Country[];
                   stretches: Stretch[]; firm: FirmItem[] };

function newTrip(id: Id, name: string): Result<Trip>;
function apply(trip: Trip, change: Change): Result<Trip>;

function extent(trip: Trip): { first: LocalDate; last: LocalDate } | undefined;
function layout(trip: Trip, first: LocalDate, last: LocalDate): Result<DayLayout[]>;
function travelDuration(item: FirmItem): Duration | undefined;

function countries(): readonly { code: Country; name: string }[];

function tripToText(trip: Trip): string;
function tripFromText(text: string): Result<Trip>;
function changeToText(change: Change): string;
function changeFromText(text: string): Result<Change>;
```

`Refusal` and `Result` are trip-time's, so a caller handles a refusal from either package the same
way. A refusal's `message` is one English sentence saying what was refused and why. A caller may
show it to the traveller.

| Refusal code | Returned by | When |
|---|---|---|
| `malformed` | every function returning a `Result` | The fields or the text are not in the form §3.3 or §5.1 gives |
| `bad-id` | `newTrip`, `apply` | An identifier outside the form of `Id` |
| `bad-text` | `newTrip`, `apply` | A name or title that is empty once trimmed, or longer than 200 characters |
| `invalid-date` | `apply`, `layout` | A `LocalDate` that does not exist, or falls outside 1970-01-01 to 9999-12-31 |
| `stretch-order` | `apply` | A stretch whose last day is before its first |
| `stretch-length` | `apply` | A stretch of more than 366 days |
| `unknown-country` | `apply` | A country not in the list of §5.2 |
| `date-only` | `apply` | A `when` or an `arrive` of trip-time's kind `date` or `tbd`. A date with no time is a `Day` |
| `duplicate-id` | `apply` | An added stretch or firm item whose identifier the trip already holds |
| `unknown-id` | `apply` | A change naming a stretch or firm item the trip does not hold |
| `travel-order` | `apply` | Travel that certainly arrives before it leaves (§4.4) |
| `range-order` | `layout` | A range whose last date is before its first |
| `range-length` | `layout` | A range of more than 366 days |
| `unknown-format` | `tripFromText` | A trip whose `format` is not 1 |

`apply` also returns any refusal trip-time's `create` gives for a time in the change, with its code
unchanged, such as `skipped-time` for a time in the hour the clocks skip.

### 3.4 Systems this drives

None. The itinerary calls only `@itinero/trip-time`, which `spec/shared/trip-time.md` specifies.

## 4. Behaviour

Behaviour crossing every operation:

- **Dates are calendar dates.** A `LocalDate` is a Gregorian date written `YYYY-MM-DD`. A stretch's
  dates and a `Day` belong to no time zone, because the place they are pencilled at has none
  (`PLN:ITINERARY-NR3`).
- **The device's own time zone is never read.** The itinerary works out dates by counting days
  in the Gregorian calendar, and orders times with trip-time, which never reads it either.
- **The local date of a `When`** is its `date` field. Its last local date is its `endDate` for
  trip-time's `window` kind, and its `date` for every other kind.
- **A date with no time is always a `Day`.** trip-time's two kinds with no time, `date` and `tbd`,
  are refused in a firm item with `date-only`, so that a date with no time has one form only.

### 4.1 newTrip

*Porcelain:* `newTrip(id, name)` gives a trip with that identifier and name, no stretches, no firm
items, and revision 1. The caller makes the identifier, as `crypto.randomUUID()` does, so that a
trip is named before any copy of it is stored.

### 4.2 apply

*Porcelain:* `apply(trip, change)` checks the change against the trip and gives a new trip, with
the change made and its revision one higher (`PLN:ITINERARY-F6`). A change it refuses gives the
refusal, and the trip given is unchanged (`PLN:ITINERARY-F7`). Every check is made before
anything is changed.

| Change | Effect | Refused when |
|---|---|---|
| `rename` | Sets the trip's name | `bad-text` |
| `pencil` | Adds the stretch, after those the trip holds | `duplicate-id`, and any refusal of §4.3 |
| `move` | Sets the stretch's first and last days | `unknown-id`, and any date refusal of §4.3 |
| `re-place` | Sets the stretch's place | `unknown-id`, `unknown-country`, `bad-text` |
| `remove-stretch` | Removes the stretch | `unknown-id` |
| `add-firm` | Adds the firm item, after those the trip holds | `duplicate-id`, and any refusal of §4.4 |
| `change-firm` | Replaces the firm item with the same identifier, keeping its place in the list | `unknown-id`, and any refusal of §4.4 |
| `remove-firm` | Removes the firm item | `unknown-id` |

An identifier is unique across a trip's stretches and its firm items together. A removed
identifier may be used again.

A change sets whole fields, and never adds to or subtracts from them. Two changes to the same
field of one stretch or firm item therefore leave the later one standing.

The result depends on the rules trip-time has loaded, because trip-time's `create` refuses a time
in the hour the clocks skip, and the hour moves when a zone's rules change. The copy held online
applies every change, and its result is the one that stands (§8).

### 4.3 Stretches

*Plumbing:* a stretch is checked as follows (`PLN:ITINERARY-F1`, `PLN:ITINERARY-F2`):

- its `first` and `last` are real dates in range, or the change is refused with `invalid-date`
- `last` is on or after `first`, or it is refused with `stretch-order`. One day is a stretch whose
  `first` and `last` are the same
- it covers at most 366 days, both ends counted, or it is refused with `stretch-length`
- its place's country is in the list of §5.2, or it is refused with `unknown-country`
- its place's name, where present, is checked as a title is, with `bad-text`
- its `page`, where present, has the form of an `Id`, or it is refused with `bad-id`

Nothing compares a stretch with any other stretch, or with a firm item. Gaps and overlaps are
accepted (ADR-0009).

### 4.4 Firm items

*Plumbing:* a firm item is checked as follows (`PLN:ITINERARY-F3`, `PLN:ITINERARY-F4`):

- its title is checked with `bad-text`
- its `page`, where present, has the form of an `Id`, or it is refused with `bad-id`
- a `when` or an `arrive` of kind `day` has a real date in range, or is refused with
  `invalid-date`
- a `when` or an `arrive` of trip-time's kind `date` or `tbd` is refused with `date-only`
- any other `when` or `arrive` is passed to trip-time's `create`, and any refusal it gives is
  returned unchanged
- a travel's two places are checked as a stretch's place is
- a travel with an `arrive` is refused with `travel-order` where it certainly arrives before it
  leaves

Travel certainly arrives before it leaves when:

- both `when` and `arrive` are trip-time values, and trip-time's `span(when, arrive)` refuses with
  `span-order`
- either is a `Day`, and the last local date of `arrive` is before the local date of `when`

`travelDuration(item)` gives trip-time's `duration` of the span from `when` to `arrive`. It gives
`undefined` for an item that is not travel, has no `arrive`, or has a `Day` at either end.

### 4.5 extent

*Porcelain:* `extent(trip)` gives the first and the last dates that any stretch or firm item
covers, or `undefined` for a trip holding neither. A firm item covers the days of §4.6.

### 4.6 layout

*Porcelain:* `layout(trip, first, last)` gives one `DayLayout` for each date from `first` to `last`,
both included, in date order (`PLN:ITINERARY-F5`). It refuses a range with `invalid-date`,
`range-order` or `range-length`, as §3.3 gives.

Each day holds:

- **stretches:** every stretch covering the date, ordered by first day, then by last day, then as
  the trip lists them
- **countries:** the country of each of those stretches, in their order, each country once
  (`PLN:ITINERARY-F2`)
- **firm:** every firm item covering the date, in the order below

A firm item covers every date from the local date of its `when` to the last local date its `when`
or its `arrive` reaches. An overnight bus is therefore on the day it leaves and the day it arrives,
and a window from 23:00 to 01:00 is on both its dates.

A day's firm items are ordered in two groups:

1. items whose `when` is a `day`, as the trip lists them
2. every other item, sorted by trip-time's `sort` on its `when`, which keeps tied items as the trip
   lists them

An item shown on a later day than its `when`, such as the overnight bus on its day of arrival, is
ordered by its `when` all the same, and so comes before the items that start that day.

### 4.7 The text form

*Porcelain:* `tripToText` and `changeToText` write a trip and a change as the JSON of §5.1.
`tripFromText` and `changeFromText` read them back (`PLN:ITINERARY-F8`).

Reading checks the form, and reads every time with trip-time's `parse`, which reads a time written
under older rules without refusing it. Reading does not apply the checks of §4.3 and §4.4 again,
so a trip stored once can always be read back. `tripFromText(tripToText(t))` gives a trip equal to
`t`, and the same trip always gives the same text.

### 4.8 The test suite

The suite runs with `npm test` in `packages/itinerary/`, using Node's built-in test runner. A just
recipe, `just test-itinerary`, runs it from anywhere in the repository.

- **Unit tests** cover each refusal of §3.3, each row of the table of §4.2, and every check in the
  verification of each requirement the itinerary claims.
- **Order tests** apply the same changes to two copies of a trip, and confirm the two trips are
  equal (`PLN:ITINERARY-F6`).
- **Round-trip tests** confirm that a trip holding every kind of stretch and firm item reads back
  equal to itself, after another rules file is loaded (`PLN:ITINERARY-F8`).
- **Time-zone independence tests** run the suite with the `TZ` environment variable set to
  `Europe/London` and to `Asia/Tokyo`, and confirm every result is the same
  (`PLN:ITINERARY-NFR1`).

## 5. Resources

### 5.1 The text form of a trip

A trip is one JSON object. Every time is held as a string in trip-time's text form, as
`spec/shared/trip-time.md` §4.1 gives it. Keys are written in sorted order.

```json
{
  "firm": [
    {
      "id": "b3c1",
      "title": "Flight to New York",
      "travel": {
        "arrive": "2026-06-05T12:30[America/New_York]",
        "by": "flight",
        "from": { "country": "FR", "name": "Paris" },
        "to": { "country": "US", "name": "New York" }
      },
      "when": "2026-06-05T10:00[Europe/Paris]"
    },
    { "id": "c9d0", "title": "Move on from Lyon", "when": { "day": "2026-06-03" } }
  ],
  "format": 1,
  "id": "6f1e",
  "name": "June 2026",
  "revision": 7,
  "stretches": [
    { "first": "2026-06-01", "id": "a17f", "last": "2026-06-05", "place": { "country": "FR" } }
  ]
}
```

A `day` is written as an object holding its date, `{ "day": "2026-06-03" }`, and any other `when`
as a string. A change is written the same way, as an object holding its `op` and its fields.

### 5.2 The list of countries

The package holds the list of countries as a table of each code and its English name, such as
`FR` and France. It holds every code ISO 3166-1 assigns officially, the international standard for
country codes. `countries()` gives the table, in the order of its names.

A code later withdrawn from ISO 3166-1 stays in the table, so that a stored trip naming it still
reads back.

| Resource | Path | Owned by |
|---|---|---|
| The package | `packages/itinerary/` | Whoever keeps the planner's roadmap |
| The list of countries | `packages/itinerary/src/countries.ts` | Whoever keeps the planner's roadmap |
| The npm workspace membership | `packages/itinerary` in the workspaces of `package.json` at the repository root | Whoever keeps the planner's roadmap |
| The recipe | `test-itinerary`, in the `justfile` at the repository root | Whoever keeps the planner's roadmap |

The package's one runtime dependency is `@itinero/trip-time`. Its development dependencies are
TypeScript and Node's type definitions.

## 6. Quality attributes

- **Offline** (`PLN:ITINERARY-NFR1`). The itinerary holds no network code. Every function works
  from its arguments and the rules trip-time has loaded.
- **The same on every device** (`PLN:ITINERARY-NFR1`). The itinerary never reads the device's time
  zone, and orders times with trip-time, which never reads it either. The tests of §4.8 run under
  two device time zones.
- **Deterministic** (`PLN:ITINERARY-F6`). The same changes, applied in the same order under the
  same rules, give equal trips. The same trip always gives the same text.
- **Readable forever** (`PLN:ITINERARY-F8`). `tripFromText` reads any trip `tripToText` wrote,
  under any later rules (§4.7).
- **Bounded.** A range covers at most 366 days, so no layout lists more than 366 days.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [PLN:ITINERARY-F1](../../requirements/planner/itinerary.md#^pln-itinerary-f1) | The `pencil`, `move`, `re-place` and `remove-stretch` changes of §4.2, and the checks of §4.3. |
| [PLN:ITINERARY-F2](../../requirements/planner/itinerary.md#^pln-itinerary-f2) | The list of countries of §5.2, the `unknown-country` refusal, and each day's countries in §4.6. |
| [PLN:ITINERARY-F3](../../requirements/planner/itinerary.md#^pln-itinerary-f3) | The `add-firm`, `change-firm` and `remove-firm` changes of §4.2, and the checks of §4.4. The zone of each time comes from the caller. |
| [PLN:ITINERARY-F4](../../requirements/planner/itinerary.md#^pln-itinerary-f4) | The `Travel` type of §3.3, the `travel-order` refusal, and `travelDuration`, in §4.4. |
| [PLN:ITINERARY-F5](../../requirements/planner/itinerary.md#^pln-itinerary-f5) | `layout` and `extent`, in §4.5 and §4.6. |
| [PLN:ITINERARY-F6](../../requirements/planner/itinerary.md#^pln-itinerary-f6) | `apply` and the revision, in §4.2. Applying each change to the copy held online is the component that holds it, which is not yet registered. |
| [PLN:ITINERARY-F7](../../requirements/planner/itinerary.md#^pln-itinerary-f7) | Every check made before anything is changed, in §4.2. |
| [PLN:ITINERARY-F8](../../requirements/planner/itinerary.md#^pln-itinerary-f8) | The text form of §4.7 and §5.1. |
| [PLN:ITINERARY-F9](../../requirements/planner/itinerary.md#^pln-itinerary-f9) | The `page` field of `Stretch` and `FirmItem` in §3.3, kept unchecked (§2). Whether the page exists is `planner/pages`, whose specification is not yet written. |
| [PLN:ITINERARY-NFR1](../../requirements/planner/itinerary.md#^pln-itinerary-nfr1) | No network code, and never reading the device's time zone (§4, §6). Keeping a copy on the phone is the web app, whose specification is not yet written. |
| [PLN-F1](../../requirements/planner/planner.md#^pln-f1) | A trip's stretches, changed freely (§4.2, §4.3). Showing them on a calendar is the web app, whose specification is not yet written. |
| [PLN-F2](../../requirements/planner/planner.md#^pln-f2) | Each day's countries (§4.6). Showing them is the web app. |
| [PLN-F3](../../requirements/planner/planner.md#^pln-f3) | Firm items with a date or a time (§4.4). Entering them is the web app. |
| [PLN-F4](../../requirements/planner/planner.md#^pln-f4) | Travel, its order and its duration (§4.4). Entering and showing it is the web app. |
| [PLN-F5](../../requirements/planner/planner.md#^pln-f5) | Each day's firm items, in order (§4.6). Showing them apart from the stretches is the web app. |
| [PLN-F11](../../requirements/planner/planner.md#^pln-f11) | The page each stretch and firm item names (§3.3). Opening the page is `planner/pages` and the web app, whose specifications are not yet written. |
| [PLN-F6](../../requirements/planner/planner.md#^pln-f6) | Changes that give the same trip wherever they are applied (§4.2). Holding the copy online, and bringing each traveller the changed trip, is the component that holds it, which is not yet registered. |

## 8. Open

- **Where the copy of a trip held online lives.** No component holds it yet. That component applies
  every change with `apply`, keeps the result, and sends the changed trip to every traveller who may
  see it. Its result is the one that stands when a device and the copy online have different
  time-zone rules (§4.2). It also decides whether a change names the revision it was made against.
  It is to be registered in the planner before Milestone Planner-0.1 is complete.
