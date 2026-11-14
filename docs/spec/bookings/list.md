# The bookings list

**Assumes** [list.md](../../requirements/bookings/list.md) — what the bookings list promises, and the identifier, revision, travellers and details every booking has.

## 1. Purpose

The bookings list is the component that holds a trip's bookings, whatever their kind. Other
components use it to check and apply each change to a booking, to learn which travellers a change
touches, to order bookings by when they happen, and to write a booking as text. It works the same
in a browser with no connection as on a server.

## 2. Scope

The bookings list covers what every booking has, the changes that add, change and remove one, the
order of a trip's bookings, the dates each covers, and the text form a booking and a change are
stored and sent in.

Two things act on it:

- **`planner/trip-host`**, the component holding the copy of each trip online, applies every
  change a traveller makes to a booking, and stores each booking.
- **The web app**, the system travellers use on a computer or a phone, builds changes, and orders
  and finds the bookings on the phone's copy, for the bookings page, the calendar and the home page.

Deliberately absent:

- the details of each kind, which `bookings/flight`, `bookings/stay`, `bookings/journey` and
  `bookings/activity` hold. The bookings list calls their checks (§4.2)
- deciding who may see or change a booking, which `access/permissions` does from the travellers
  §4.3 gives
- checking that each traveller is on the trip, which `planner/trip-host` does
- storing a booking, or sending one between devices
- finding a place's time zone. The caller gives every time's zone
- reading the device's clock or its time zone. The caller gives the moment `notOver` compares with

A trip's bookings are entered by hand, as one of four kinds, and kept with the trip online
(ADR-0016, a trip's bookings are entered by hand, as one of four kinds, and kept with the trip
online). A booking is seen only by the travellers it names and the admins (ADR-0013, a trip's
bookings have a page of their own, and its calendar is seen only by the travellers an admin
chooses).

The bookings list and the four kinds are written in TypeScript, as one package,
`@itinero/bookings`, that runs unchanged in the browser and on Node.js, the JavaScript runtime
servers use. Every time is a value of `@itinero/trip-time`, the package of `shared/trip-time`, which
holds dates and times in the local time of their place.

## 3. Interface

### 3.1 User interface

None. The bookings list has no user interface. The web app shows what its functions return.

### 3.2 Application interface

None. The bookings list has no network or service interface. A change reaches the copy of a trip
held online through `planner/trip-host`.

### 3.3 Programming interface

The package `@itinero/bookings` exports the types and functions below, with each kind's own, which
the kinds' specifications give. Every object a function returns is frozen. No function changes its
arguments. Every function gives a result that depends only on its arguments and the time-zone rules
trip-time last loaded.

```ts
import type { TripTime, LocalDate, Refusal, Result } from "@itinero/trip-time";

type Id = string;            // 1 to 64 of A–Z, a–z, 0–9, "-" and "_", unique within a trip's bookings
type TravellerId = string;   // an account's identifier, as access/accounts gives it
type PageId = string;        // a page of the trip, as planner/pages names it

type Details = {
  reference?: string;        // the booking reference, such as "K7Q2ZP"
  provider?: string;         // who it is booked with, such as "LATAM" or "Booking.com"
  link?: string;             // an https: address
  notes?: string;            // plain text
  page?: PageId;
};

type Common = { id: Id; revision: number;
                travellers: readonly TravellerId[];   // in sorted order
                details: Details };

type Booking = FlightBooking | StayBooking | JourneyBooking | ActivityBooking;

type Change =
  | { op: "add";    booking: Booking }
  | { op: "change"; booking: Booking; base: number }   // base: the revision changed from
  | { op: "remove"; id: Id; base: number };

type Touches = { id: Id;
                 before: readonly TravellerId[];       // those named now, or none
                 after: readonly TravellerId[] };      // those named once changed, or none

type Extent = { starts: TripTime; ends?: TripTime; first: LocalDate; last: LocalDate };

function check(booking: Booking): Result<Booking>;
function touches(held: Booking | undefined, change: Change): Touches;
function apply(held: Booking | undefined, change: Change): Result<Booking | undefined>;

function extent(booking: Booking): Extent;
function label(booking: Booking): string;
function order(bookings: readonly Booking[]): Booking[];
function onDate(bookings: readonly Booking[], date: LocalDate): Booking[];
function notOver(bookings: readonly Booking[], now: TripTime): Booking[];

function bookingToText(booking: Booking): string;
function bookingFromText(text: string): Result<Booking>;
function changeToText(change: Change): string;
function changeFromText(text: string): Result<Change>;
```

`FlightBooking`, `StayBooking`, `JourneyBooking` and `ActivityBooking` are each `Common` with a
`kind` and the fields of their kind, which `spec/bookings/flight.md`, `spec/bookings/stay.md`,
`spec/bookings/journey.md` and `spec/bookings/activity.md` give.

`Refusal` and `Result` are trip-time's, so a caller handles a refusal from every planner, access and
bookings package the same way. A refusal's `message` is one English sentence saying what was
refused and why, which a caller may show to the traveller.

| Refusal code | Returned by | When |
|---|---|---|
| `malformed` | every function returning a `Result` | The fields or the text are not in the form §3.3 or §5.1 gives |
| `unknown-kind` | `check`, `apply` | A `kind` that is not `flight`, `stay`, `journey` or `activity` |
| `bad-id` | `check`, `apply` | An `id` or a `page` outside the form of `Id` |
| `no-travellers` | `check`, `apply` | A booking naming no traveller |
| `too-many-travellers` | `check`, `apply` | A booking naming more than 50 travellers |
| `duplicate-traveller` | `check`, `apply` | A booking naming one traveller twice. `details.traveller` names them |
| `bad-text` | `check`, `apply` | A text field that is empty once trimmed, or longer than its limit (§4.1) |
| `bad-link` | `check`, `apply` | A link that is not an `https:` address, or is longer than 2,000 characters |
| `duplicate-id` | `apply` | An `add` for a booking already held |
| `unknown-id` | `apply` | A `change` or a `remove` for a booking not held |
| `kind-change` | `apply` | A `change` giving the booking another kind |
| `stale` | `apply` | A `change` or a `remove` whose `base` is not the booking's `revision`. `details.booking` holds the booking as it stands, in its text form, and `details.revision` its revision |
| `unknown-format` | `bookingFromText` | A booking whose `format` is not 1 |

`check` and `apply` also return any refusal a kind's check gives, and any refusal trip-time's
`create` gives for a time, with its code unchanged, such as `travel-order` from a flight or
`skipped-time` from trip-time.

### 3.4 Systems this drives

None. The bookings list calls only `@itinero/trip-time`, which `spec/shared/trip-time.md`
specifies.

## 4. Behaviour

Behaviour crossing every operation:

- **The device's own time zone is never read.** The bookings list orders and measures times with
  trip-time, which never reads it either, and counts dates in the Gregorian calendar.
- **Each kind is reached through one table.** For each `kind`, the package holds the kind's check,
  its times and its label, as the kinds' specifications give them. Every function below that
  depends on the kind calls that kind's.
- **A change sets whole fields.** A `change` replaces the whole booking. Apart from raising
  `revision`, nothing is added to a field or subtracted from it.

### 4.1 check

*Plumbing:* `check(booking)` checks the fields every booking has, then the kind's own, and gives the
booking as it will be held (`BKG:LIST-F1`, `BKG:LIST-F2`, `BKG:LIST-F6`). The first refusal found is
returned:

- `kind` is one of the four, or `unknown-kind`
- `id` has the form of `Id`, or `bad-id`
- `travellers` holds 1 to 50 identifiers, each once, or `no-travellers`, `too-many-travellers` or
  `duplicate-traveller`
- each detail present is checked as the table below gives
- the kind's check passes, as its specification gives

| Detail | Limit | Refused with |
|---|---|---|
| `reference` | 1 to 64 characters once trimmed | `bad-text` |
| `provider` | 1 to 200 characters once trimmed | `bad-text` |
| `link` | An address the `URL` constructor reads, whose protocol is `https:`, of at most 2,000 characters | `bad-link` |
| `notes` | 1 to 4,000 characters once trimmed | `bad-text` |
| `page` | The form of `Id` | `bad-id` |

Every text field, here and in each kind, is trimmed of white space at both ends before it is
checked and held. A detail that is empty once trimmed is refused, not dropped, so that a caller
leaves out a detail the traveller cleared. Characters are counted as Unicode code points.

The booking given back has its text fields trimmed and its `travellers` sorted. `check` does not
look at `revision`, which `apply` sets.

### 4.2 touches and apply

*Porcelain:* `touches(held, change)` gives the booking a change is for, and the travellers it names
before and after the change, with no check made (`BKG:LIST-F2`). `held` is the booking the caller
holds with the change's identifier, or `undefined`.

| Change | `before` | `after` |
|---|---|---|
| `add` | None | The new booking's travellers |
| `change` | `held`'s travellers, or none where nothing is held | The new booking's travellers |
| `remove` | `held`'s travellers, or none where nothing is held | None |

The caller asks whether the traveller making the change may change a booking naming `before`, and
one naming `after`, before it calls `apply`. A refusal from `apply` then tells only a traveller who
may change the booking anything about it.

`apply(held, change)` checks the change against `held`, and gives the booking with the change made,
or `undefined` for a removal (`BKG:LIST-F1`, `BKG:LIST-F3`). A change it refuses gives the refusal,
and `held` is unchanged. Every check is made before anything is made.

| Change | Effect | Refused when |
|---|---|---|
| `add` | Gives the booking, checked, with `revision` 1 | `duplicate-id` where a booking is held, and any refusal of `check` |
| `change` | Gives the booking, checked, with `held`'s `revision` plus one | `unknown-id`, `kind-change`, `stale`, and any refusal of `check` |
| `remove` | Gives `undefined` | `unknown-id`, `stale` |

The checks are made in the order the table lists them. A `change` whose `booking.id` is not
`held`'s is refused with `unknown-id`. The `revision` a caller puts in an added or changed booking
is ignored.

### 4.3 extent and label

*Porcelain:* `extent(booking)` gives when the booking starts and ends, and the local dates it covers
(`BKG:LIST-F5`):

- **starts** and **ends** are the kind's times, as its specification gives them. `ends` is absent
  for a booking with no end, such as a journey with no arrival time
- **first** is the `date` of `starts`
- **last** is the last local date of `ends`, or of `starts` where `ends` is absent. A value's last
  local date is its `endDate` for trip-time's `window` kind, and its `date` for every other kind

A booking whose `ends` is in another time zone than its `starts`, such as a flight, covers its dates
as each time reads in its own zone. A flight leaving Santiago at 23:40 on 1 December and arriving in
Madrid on 2 December covers 1 and 2 December.

`label(booking)` gives one line naming the booking, as its kind's specification gives, such as
`LA 800, Santiago to Punta Arenas` for a flight. The web app shows it as the booking's title.

### 4.4 order, onDate and notOver

*Porcelain:* `order(bookings)` gives the bookings ordered by `starts` (`BKG:LIST-F4`). It first
sorts them by `label`, comparing code points, then by `id`, and then sorts that list with
trip-time's `sort` on each booking's `starts`. trip-time's `sort` keeps tied values in the order
given, so bookings starting together come by label, then by identifier. The same bookings,
given in any order, therefore always come back in the same order.

`onDate(bookings, date)` gives, in the order of `order`, each booking whose `first` is on or before
`date`, and whose `last` is on or after it (`BKG:LIST-F5`).

`notOver(bookings, now)` gives, in the order of `order`, each booking not yet over at `now`
(`BKG:LIST-F5`). A booking is over when trip-time's `span(now, end)` refuses with `span-order`,
where `end` is its `ends`, or its `starts` where it has no end. trip-time refuses a span that
certainly ends before it starts, so a booking is over once the latest moment its end can mean has
passed.

`now` is an exact time. The web app makes it from the device's clock in the zone `Etc/UTC`, with
JavaScript's `Date` methods that read UTC, such as `getUTCHours`, which never read the device's
time zone.

### 4.5 The text form

*Porcelain:* `bookingToText` and `changeToText` write a booking and a change as the JSON of §5.1.
`bookingFromText` and `changeFromText` read them back (`BKG:LIST-F7`).

Reading checks the form, and reads every time with trip-time's `parse`, which reads a time written
under older rules without refusing it. Reading does not apply the checks of §4.1 again, so a booking
stored once can always be read back. `bookingFromText(bookingToText(b))` gives a booking equal to
`b`, and the same booking always gives the same text.

### 4.6 The test suite

The suite runs with `npm test` in `packages/bookings/`, using Node's built-in test runner. The recipe
`just test-bookings` runs it from anywhere in the repository. It covers the four kinds as well.

- **Unit tests** cover each refusal of §3.3 and of each kind, each row of the tables of §4.1 and
  §4.2, and every check in the verification of each requirement the package's specifications claim.
- **Order tests** give the same bookings to `order` in many orders, and confirm the result is the
  same (`BKG:LIST-F4`).
- **Round-trip tests** confirm a booking of each kind, holding every field, reads back equal to
  itself, after another rules file is loaded (`BKG:LIST-F7`).
- **Time-zone independence tests** run the suite with the `TZ` environment variable set to
  `Europe/London` and to `Asia/Tokyo`, and confirm every result is the same (`BKG:LIST-NFR1`).
- **Speed tests** order 1,000 bookings of every kind, and find those not yet over, and fail where
  either takes over 50 milliseconds in Node.js on the machine running them. They run on a phone of
  `BKG:LIST-NFR2` before each release (`BKG:LIST-NFR2`).

## 5. Resources

### 5.1 The text form of a booking

A booking is one JSON object, holding `format`, which is 1, and every field of its type. Every time
is held as a string in trip-time's text form, as `spec/shared/trip-time.md` §4.1 gives it. A field
that is absent is left out. Keys are written in sorted order, and no white space is written between
them.

The stay below is shown with white space added, to be read:

```json
{
  "checkIn": "2026-12-09T15:00/22:00[America/Punta_Arenas]",
  "checkOut": "2026-12-12~11:00[America/Punta_Arenas]",
  "details": {
    "link": "https://example.com/stays/k7q2zp",
    "notes": "Ring the bell at the side gate on arrival.",
    "page": "c3e2",
    "provider": "Booking.com",
    "reference": "K7Q2ZP"
  },
  "format": 1,
  "id": "5d1a",
  "kind": "stay",
  "name": "Hostal Lady Florence",
  "revision": 2,
  "travellers": ["acct-1", "acct-2"]
}
```

A change is written the same way, as an object holding its `op` and its fields, with a booking
written as above:

```json
{ "base": 2, "id": "5d1a", "op": "remove" }
```

### 5.2 Where it lives

| Resource | Path | Owned by |
|---|---|---|
| The package | `packages/bookings/` | Whoever keeps the bookings system's roadmap |
| The bookings list | `packages/bookings/src/list.ts` | Whoever keeps the bookings system's roadmap |
| The npm workspace membership | `packages/bookings` in the workspaces of `package.json` at the repository root | Whoever keeps the bookings system's roadmap |
| The recipe | `test-bookings`, in the `justfile` at the repository root | Whoever keeps the bookings system's roadmap |

The package's one runtime dependency is `@itinero/trip-time`. Its development dependencies are
TypeScript and Node's type definitions.

## 6. Quality attributes

- **Offline** (`BKG:LIST-NFR1`). The bookings list holds no network code. Every function works from
  its arguments and the rules trip-time has loaded.
- **The same on every device** (`BKG:LIST-NFR1`). The bookings list never reads the device's time
  zone or clock. The tests of §4.6 run under two device time zones.
- **Deterministic** (`BKG:LIST-F4`, `BKG:LIST-F7`). The same bookings always come in the same
  order, and the same booking always gives the same text.
- **Fast** (`BKG:LIST-NFR2`). `order` sorts twice, and `notOver` makes one span for each booking,
  so each takes time in proportion to `n log n` for `n` bookings, with no work on the network.
- **Tells nothing to a traveller who may not change a booking** (`ACC-NFR1`). `touches` needs no
  check, so a caller asks for access before `apply` can refuse with `stale`, which holds the
  booking.
- **Readable forever** (`BKG:LIST-F7`). `bookingFromText` reads any booking `bookingToText` wrote,
  under any later rules (§4.5).

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [BKG:LIST-F1](../../requirements/bookings/list.md#^bkg-list-f1) | `apply` and its table, and every check made before anything is made, in §4.2, with `check` in §4.1. |
| [BKG:LIST-F2](../../requirements/bookings/list.md#^bkg-list-f2) | The travellers checks of §4.1, and `touches`, in §4.2. |
| [BKG:LIST-F3](../../requirements/bookings/list.md#^bkg-list-f3) | The `base` of a change, and the `stale` refusal, in §3.3 and §4.2. |
| [BKG:LIST-F4](../../requirements/bookings/list.md#^bkg-list-f4) | `order`, in §4.4. |
| [BKG:LIST-F5](../../requirements/bookings/list.md#^bkg-list-f5) | `extent`, in §4.3, and `onDate` and `notOver`, in §4.4. |
| [BKG:LIST-F6](../../requirements/bookings/list.md#^bkg-list-f6) | `Details`, in §3.3, and its checks, in §4.1. |
| [BKG:LIST-F7](../../requirements/bookings/list.md#^bkg-list-f7) | The text form of §4.5 and §5.1. |
| [BKG:LIST-NFR1](../../requirements/bookings/list.md#^bkg-list-nfr1) | No network code, and never reading the device's time zone or clock (§4, §6). |
| [BKG:LIST-NFR2](../../requirements/bookings/list.md#^bkg-list-nfr2) | `order` and `notOver`, and the speed tests of §4.6. |
| [BKG-F1](../../requirements/bookings/bookings.md#^bkg-f1) | A booking of one of four kinds, naming 1 to 50 travellers (§4.1), and the travellers each change touches (§4.2). Allowing the change is `planner/trip-host`, by asking `access/permissions`. Entering the booking is `web/screens`. |
| [BKG-F3](../../requirements/bookings/bookings.md#^bkg-f3) | `order`, `extent` and `notOver` (§4.3, §4.4), and each booking's `label`. Showing the page is `web/screens`. |
| [BKG-F4](../../requirements/bookings/bookings.md#^bkg-f4) | `Details`, checked in §4.1. Showing a hidden page as not available is `web/screens`. |
| [BKG-F5](../../requirements/bookings/bookings.md#^bkg-f5) | The `change` and `remove` changes, and the `stale` refusal holding the booking as it stands (§4.2). Who may make each change is `planner/trip-host`, by asking `access/permissions`. |
| [BKG-F6](../../requirements/bookings/bookings.md#^bkg-f6) | The text form a phone keeps each booking in (§4.5). Giving each phone its bookings is `planner/trip-host`, and keeping them on the phone is `web/trip-store`. |
| [BKG-NFR1](../../requirements/bookings/bookings.md#^bkg-nfr1) | Ordering the page's bookings within 50 milliseconds (§6). Drawing the page is `web/screens`. |
| [PLN-F5](../../requirements/planner/planner.md#^pln-f5) | The dates each booking covers, and when it starts, for the calendar to order it among the firm items (§4.3). Showing them together is `web/screens`. |
| [PLN-F15](../../requirements/planner/planner.md#^pln-f15) | `onDate` for a traveller's bookings today, and `notOver` for their next ones (§4.4). Showing the home page is `web/screens`. |

## 8. Open

- **A trip's last booking.** Nothing limits how many bookings a trip holds. A limit is for
  `planner/trip-host` to set, if a trip's storage ever needs one.
