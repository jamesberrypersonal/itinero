# Trip time

**Assumes** [trip-time.md](../../requirements/shared/trip-time.md) — what trip-time promises, and the six kinds of value it holds.

## 1. Purpose

trip-time is the package that holds a trip's dates and times, in the local time of the place each
one happens. Other components, such as the planner's itinerary and the web app, use it to create,
store, sort, measure and write those values. It works the same in a browser with no connection as
on a server.

## 2. Scope

trip-time covers the six kinds of value its requirements define, spans between two values, the
text form a value is stored in, and the rules file that holds every time zone's rules. It also
covers the build script that makes the rules file from a release of the IANA time zone database.

Two things act on it:

- **A caller**, such as the planner's itinerary or the web app, calls its functions (§3.3).
- **A maintainer** runs the build script when the IANA time zone database publishes a release
  (§4.11).

Deliberately absent:

- finding a place's time zone. The caller gives it
- showing a value in any time zone but its own
- any language but English
- fetching, storing or refreshing the rules file on a device. The web app does that (ADR-0008,
  trip-time carries its own copy of the time-zone rules)
- reading the device's clock or its time zone. The caller passes the current moment

trip-time is written in TypeScript, as one package that runs unchanged in the browser and on Node
(ADR-0007, trip-time is written in TypeScript).

## 3. Interface

### 3.1 User interface

None. trip-time has no user interface. Callers reach it through its functions (§3.3), and the web
app shows what they return.

### 3.2 Application interface

None. trip-time has no network or service interface. Callers reach it through its functions
(§3.3).

### 3.3 Programming interface

The package `@itinero/trip-time` exports the types and functions below. Every value is a frozen
object, and no function changes its arguments. Every function except `loadRules` is pure, apart
from reading the rules last loaded.

```ts
type Zone = string;                      // a time zone's IANA name, such as "Europe/Paris"
type LocalDate = string;                 // "YYYY-MM-DD"
type ClockTime = { time: string;         // "HH:MM", 00:00 to 23:59
                   second?: true };      // the second occurrence of a repeated time
type PartOfDay = "morning" | "afternoon" | "evening" | "night";

type TripTime =
  | { kind: "exact";  zone: Zone; date: LocalDate; at: ClockTime }
  | { kind: "date";   zone: Zone; date: LocalDate }
  | { kind: "tbd";    zone: Zone; date: LocalDate }
  | { kind: "part";   zone: Zone; date: LocalDate; part: PartOfDay }
  | { kind: "approx"; zone: Zone; date: LocalDate; at: ClockTime }
  | { kind: "window"; zone: Zone; date: LocalDate; from: ClockTime;
                      endDate: LocalDate; to: ClockTime };

type Span = { start: TripTime; end: TripTime };
type Duration = { shortest: number; longest: number };   // whole minutes

type Refusal = { code: RefusalCode; message: string; details?: Record<string, string> };
type Result<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

type TextStyle = { clock: "24h" | "12h"; dateOrder: "day-first" | "month-first" };

function loadRules(file: string): Result<{ version: string }>;
function rulesVersion(): string | undefined;

function create(fields: TripTime): Result<TripTime>;
function parse(text: string): Result<TripTime>;
function toText(value: TripTime): string;

function compare(a: TripTime, b: TripTime): -1 | 0 | 1;
function sort(values: readonly TripTime[]): TripTime[];

function span(start: TripTime, end: TripTime): Result<Span>;
function duration(span: Span): Duration;

function format(value: TripTime, style: TextStyle): string;
function formatDuration(duration: Duration): string;
function relativeTo(value: TripTime, now: number): string;   // now: milliseconds since 1970 UTC
```

The kinds map to the six kinds of the requirements: `exact` is an exact time, `date` a whole date,
`tbd` a date with time to be decided, `part` a part of a day, `approx` an approximate time, and
`window` a window.

| Refusal code | Returned by | When |
|---|---|---|
| `malformed` | `create`, `parse` | The fields or the text are not in the form §4.1 gives |
| `out-of-range` | `create`, `parse` | A date before 1970-01-01 or after 9999-12-31 |
| `invalid-date` | `create`, `parse` | A date that does not exist, such as 2026-02-30 |
| `invalid-time` | `create`, `parse` | A clock time outside 00:00 to 23:59, or one holding seconds |
| `unknown-zone` | `create`, `parse` | A zone that neither names a zone nor an alias in the rules file |
| `no-rules` | `create`, `parse`, `span` | No rules file has been loaded |
| `skipped-time` | `create` | A clock time that falls in a gap (§4.3). The details give `before` and `after` |
| `not-repeated` | `create` | A clock time marked `second` that does not happen twice on its date |
| `window-order` | `create`, `parse` | A window whose end is not after its start |
| `span-order` | `span` | A span that certainly ends before it starts (§4.7) |
| `bad-rules` | `loadRules` | A rules file that is not in the form §5.1 gives |

A refusal's `message` is one English sentence saying what was refused and why. A caller may show
it to the traveller.

### 3.4 Systems this drives

At run time, none. trip-time reads no clock, no file, no network and no setting of the device.

At build time, the build script drives two things from the IANA time zone database (§4.11):

- **The IANA time zone database**, often called tzdb, is the public record of every time zone's
  rules, kept by the Internet Assigned Numbers Authority. It names each zone after its largest
  city, such as `Europe/Paris`, and keeps old names as aliases, such as `Asia/Calcutta` for
  `Asia/Kolkata`. Each release is named for its year and a letter, such as `2026a`, and ships its
  rules as text source files.
- **zic**, the zone compiler, ships with each release. It compiles the source files into one
  binary file per zone, in the TZif format. A TZif file lists the moments a zone's offset from UTC
  changes. It ends with a POSIX TZ string, a one-line rule for every year after the last listed
  change, such as `CET-1CEST,M3.5.0,M10.5.0/3`. Both are described in the tzfile manual page that
  ships with the release.

## 4. Behaviour

Behaviour crossing every operation:

- **Moments are counted in seconds.** A moment is a count of seconds since 1970-01-01 00:00 UTC.
  Offsets are held in seconds, because a few offsets after 1970 are not whole minutes, such as
  Liberia's until 1972.
- **The device's own time zone is never read.** trip-time never calls `Date` methods that use the
  device's time zone, nor Intl, nor Temporal. Every date and offset is worked out from the loaded
  rules, with the proleptic Gregorian calendar.
- **Dates are counted in whole days.** A local date and clock time convert to a local count of
  seconds as if the zone were UTC. §4.2 turns that count into a moment.

### 4.1 The text form

*Porcelain:* each value is stored and sent as one line of text, built on RFC 9557, the standard for
dates and times with a time zone in brackets. `toText` writes it, and `parse` reads it.

| Kind | Text form | Example |
|---|---|---|
| `exact` | `<date>T<time>[<zone>]` | `2026-06-03T09:10[Europe/Paris]` |
| `date` | `<date>[<zone>]` | `2026-06-03[Asia/Tokyo]` |
| `tbd` | `<date>/tbd[<zone>]` | `2026-06-03/tbd[Europe/Paris]` |
| `part` | `<date>/<part>[<zone>]` | `2026-06-03/afternoon[Europe/Paris]` |
| `approx` | `<date>~<time>[<zone>]` | `2026-06-03~14:00[Europe/Paris]` |
| `window` | `<date>T<time>/<time>[<zone>]` | `2026-06-03T14:00/16:00[Europe/Paris]` |
| `window`, ending on a later date | `<date>T<time>/<date>T<time>[<zone>]` | `2026-06-03T23:00/2026-06-04T01:00[Europe/Paris]` |

A clock time marked as the second occurrence of a repeated time carries the offset from UTC of
that occurrence, as `+HH:MM` or `-HH:MM`, straight after it: `2026-10-25T02:30+01:00[Europe/Paris]`.
No other clock time carries an offset. A value therefore records its local clock time and not its
moment, which is what keeps the local time when a zone's rules change
(`SHR:TRIP-TIME-F2`).

`toText` and `parse` are inverses: `parse(toText(v))` gives a value equal to `v`, and `toText`
writes exactly one text for each value. The zone is written as the caller gave it, so an alias
stays an alias.

`parse` reads text that was stored, perhaps under older rules. It refuses no clock time for
falling in a gap or for its marking, so a value stored once can always be read back:

- a clock time that falls in a gap under the loaded rules takes the moment it would have had at
  the offset before the gap, as §4.2 gives
- a clock time marked as the second occurrence, whose offset no longer matches a second occurrence,
  loses its mark, and means its only or first occurrence

### 4.2 From a local time to a moment

*Plumbing:* the offset of a zone at a moment is found in the zone's entry of the rules file
(§5.1). Its list of changes is searched for the last change at or before the moment. Before the
first change, the zone's initial offset applies. After the last, its POSIX TZ string gives the
offset, from the rules for that year.

A local count of seconds `L` in a zone becomes a moment as follows. Take every offset the zone uses
in the 48 hours around `L`. Each offset `o` for which the offset at `L − o` is `o` gives one
candidate moment, `L − o`.

| Candidates | Means | The moment |
|---|---|---|
| One | An ordinary time | That candidate |
| None | A gap: the clocks went forward over `L` | `L` minus the offset in force before the gap |
| Two | A repeat: the clocks went back over `L` | The earlier candidate, or the later for a clock time marked `second` |

### 4.3 create

*Porcelain:* `create(fields)` checks a value's fields, and returns the value, frozen. A caller
builds every new value with `create`, and uses `parse` only for text it stored.

It refuses, in this order, the cases of §3.3 for `create`. Rules apply to every clock time in the
value, the window's two ends included:

- **A gap.** A clock time with no candidate (§4.2) is refused with `skipped-time`. The details
  give `before`, the last whole minute before the gap, and `after`, the first minute after it, both
  as local times. For Paris on 2026-03-29 these are 01:59 and 03:00 (`SHR:TRIP-TIME-F3`).
- **A mark on a time that does not repeat.** A clock time marked `second` with one candidate is
  refused with `not-repeated` (`SHR:TRIP-TIME-F4`).
- **A window out of order.** A window whose end's moment is not after its start's is refused with
  `window-order`. A window whose `endDate` is its `date` writes no end date in its text form.

A whole date, a date with time to be decided, and a part of a day hold no clock time, so no gap
refuses them. The zone must name a zone or an alias in the loaded rules (`SHR:TRIP-TIME-F1`).

### 4.4 parse and toText

*Porcelain:* `parse(text)` reads one value in the text form of §4.1, and refuses text in any
other form with `malformed`. It applies the same checks as `create` except the gap and the mark,
which §4.1 resolves instead. `toText(value)` writes the text form, and never refuses.

### 4.5 The moments a value covers

*Plumbing:* every value covers a range of moments, from its earliest to its latest. Sorting
(§4.6) and spans (§4.7) both read from it.

| Kind | Earliest | Latest |
|---|---|---|
| `exact` | Its moment | Its moment |
| `approx` | The moment of its stated time | The same |
| `window` | The moment of its start | The moment of its end |
| `part` | The start of its hours | The end of its hours |
| `date`, `tbd` | The start of its date | The start of the next date |

The hours of each part of a day are fixed for every zone: morning from 06:00 to 12:00, afternoon
from 12:00 to 18:00, evening from 18:00 to 22:00, and night from 22:00 to 06:00 on the next date.
The start of a date is the moment of its 00:00. Where 00:00 falls in a gap, as in a zone whose
clocks go forward at midnight, it is the first moment after the gap.

### 4.6 compare and sort

*Porcelain:* `compare` orders two values by a sort key of two parts, a moment and then a rank.
`sort` returns a new array, ordered by `compare`, and keeps tied values in the order given
(`SHR:TRIP-TIME-F7`).

| Kind | Moment | Rank |
|---|---|---|
| `date` | The start of its date | 0 |
| `exact` | Its moment | 1 |
| `approx`, `window`, `part` | Its earliest moment | 2 |
| `tbd` | The start of the next date | −1 |

A whole date's rank puts it ahead of every other value at the start of its date. A date with time
to be decided sorts at the start of the next date, and its rank puts it ahead of anything there,
so it comes after everything on its own date.

### 4.7 span and duration

*Porcelain:* `span(start, end)` pairs two values into a span. It refuses with `span-order` when
the end's latest moment is before the start's earliest, since the end is then before the start
whatever the imprecise ends turn out to be (`SHR:TRIP-TIME-F6`).

`duration(span)` gives the shortest and the longest time that can pass, in whole minutes, from the
moments of §4.5 (`SHR:TRIP-TIME-F5`):

- **shortest** is the end's earliest moment minus the start's latest, or zero where that is less
- **longest** is the end's latest moment minus the start's earliest

An approximate time covers only its stated time, so it counts as that time. Both ends exact give
equal shortest and longest. Moments are compared, never clock times, so a span across time zones,
or across a clock change, measures the time that really passes.

### 4.8 format and formatDuration

*Porcelain:* `format(value, style)` writes a value as English text for a traveller
(`SHR:TRIP-TIME-F8`). The same value and style always give the same text.

| Kind | 24-hour clock, day first |
|---|---|
| `exact` | `Wed 3 June 2026, 09:10, Paris time` |
| `date` | `Wed 3 June 2026, Paris time` |
| `tbd` | `Wed 3 June 2026, time to be decided, Paris time` |
| `part` | `Wed 3 June 2026, afternoon, Paris time` |
| `approx` | `Wed 3 June 2026, around 14:00, Paris time` |
| `window` | `Wed 3 June 2026, 14:00–16:00, Paris time` |
| `window`, ending on a later date | `Wed 3 June 2026, 23:00 – Thu 4 June, 01:00, Paris time` |
| A time marked `second` | `Sun 25 October 2026, 02:30 (second time), Paris time` |

- **The weekday** is its three-letter English abbreviation, and the month its full English name.
- **A window's end date** omits its year, unless the year differs from the start's.
- **The 12-hour clock** writes `9:10 am` and `2:00 pm`, with no leading zero. Midnight is
  `12:00 am` and noon `12:00 pm`.
- **Month first** writes `Wed June 3, 2026`.
- **The zone's name** is the last part of the zone as given, with underscores as spaces, followed
  by `time`: `America/New_York` reads `New York time`. A short table in the package names the
  zones whose last part is not a place: `Etc/UTC` and `UTC` read `UTC`, and `Etc/GMT-2` reads
  `UTC+2`, because the IANA database writes the sign of `Etc` zones backwards.

`formatDuration(duration)` writes each length as days, hours and minutes, leaving out any part
that is zero: `40 min`, `8 h 30 min`, `1 day`, `2 days 4 h`. Equal shortest and longest are
written once. A range in whole hours below a day is written `3–9 h`, and any other range is
written as its two lengths around a spaced dash, as `2 h 30 min – 4 h`.

### 4.9 relativeTo

*Porcelain:* `relativeTo(value, now)` says how a value relates to the moment `now`, which the
caller reads from the device's clock (`SHR:TRIP-TIME-F9`). It works in one of two ways.

**By time,** for an exact time, an approximate time, and a window, measured from the moment of its
start. The distance is rounded to the nearest whole minute:

| Distance | Text |
|---|---|
| Under 1 minute | `now` |
| Under 1 hour | `in 40 minutes`, `20 minutes ago` |
| Under 12 hours | `in 2 hours 40 minutes`, `3 hours ago`. Zero minutes are left out |
| 12 hours or more | By date, as below |

An approximate time adds `about`, as `in about 3 hours`. One minute or one hour is written in the
singular.

**By date,** for a whole date, a date with time to be decided, a part of a day, and any value 12
hours or more away. The value's date is compared with today's date in the value's own zone, at
`now`:

| Days from today | Text |
|---|---|
| 0 | `today` |
| 1 | `tomorrow` |
| −1 | `yesterday` |
| 2 or more | `in 3 days` |
| −2 or less | `2 days ago` |

### 4.10 loadRules

*Porcelain:* `loadRules(file)` reads a rules file (§5.1) given as its JSON text, and replaces the
rules loaded before. It returns the file's version. It refuses a file not in the form of §5.1 with
`bad-rules`, and keeps the rules loaded before. `rulesVersion()` gives the version loaded, or
`undefined` before the first load.

The web app calls `loadRules` with the copy bundled in its build when it starts, and again with
any newer copy it fetches (ADR-0008). Two versions compare as text, since IANA release names sort
in release order. trip-time does not compare them. The caller does.

### 4.11 The build script

*Plumbing:* `npm run build-rules -- <release>` in `packages/trip-time/` makes the rules file from
one IANA release, such as `2026a`, that a maintainer has downloaded:

1. It compiles the release's source files with the release's own zic, into one TZif file per zone.
2. For each zone, it reads the offset changes from 1970 on, the offset in force at 1970-01-01, and
   the POSIX TZ string at the end of the file.
3. It reads the release's list of aliases, the links, mapping each to its canonical zone.
4. It writes `packages/trip-time/rules/<release>.json`, in the form of §5.1, with its keys in
   sorted order, so the same release always gives the same bytes.

### 4.12 The test suite

The suite runs with `npm test` in `packages/trip-time/`, using Node's built-in test runner, and a
just recipe, `just test-trip-time`, runs it from anywhere in the repository.

- **Unit tests** cover each refusal of §3.3, each row of every table in §4, and every check in the
  verification of each requirement trip-time claims.
- **Round-trip tests** confirm `parse(toText(v))` equals `v` for every kind, with and without
  marks.
- **Rule-change tests** load two rules files that differ for one zone, and confirm a stored value
  keeps its local time under both (`SHR:TRIP-TIME-F2`).
- **Time-zone independence tests** run the suite with the `TZ` environment variable set to
  `Europe/London` and to `Asia/Tokyo`, and confirm every result is the same
  (`SHR:TRIP-TIME-NFR2`).

## 5. Resources

### 5.1 The rules file

The rules file is a JSON object, made by the build script (§4.11) and read by `loadRules`.

```json
{
  "format": 1,
  "version": "2026a",
  "zones": {
    "Europe/Paris": {
      "initial": 3600,
      "changes": [[354675600, 7200], [370400400, 3600]],
      "rule": "CET-1CEST,M3.5.0,M10.5.0/3"
    }
  },
  "aliases": { "Asia/Calcutta": "Asia/Kolkata" }
}
```

| Field | Holds |
|---|---|
| `format` | The file format's version, 1. `loadRules` refuses any other |
| `version` | The IANA release it was made from |
| `zones` | One entry per canonical zone, named as the IANA database names it |
| `initial` | The zone's offset from UTC, in seconds, at 1970-01-01 00:00 UTC |
| `changes` | Each change from 1970 on, as a pair: its moment in seconds, and the offset in seconds from then |
| `rule` | The POSIX TZ string that gives the offset after the last change |
| `aliases` | Each alias, mapped to its canonical zone |

| Resource | Path | Owned by |
|---|---|---|
| The package | `packages/trip-time/` | The keeper of the planner's roadmap |
| The rules files | `packages/trip-time/rules/<release>.json`, one per release built, committed to the repository | The keeper of the planner's roadmap |
| The npm workspace membership | `packages/trip-time` in the workspaces of `package.json` at the repository root | The keeper of the planner's roadmap |
| The recipe | `test-trip-time`, in the `justfile` at the repository root | The keeper of the planner's roadmap |
| The served copy | A fixed path on the web app's own host, served as a static file | The web app (ADR-0008) |

The package declares no runtime dependencies. Its development dependencies are TypeScript and
Node's type definitions.

## 6. Quality attributes

- **Offline** (`SHR:TRIP-TIME-NFR1`). trip-time holds no network code. Every function works from
  the rules last loaded and the arguments it is given.
- **The same on every device** (`SHR:TRIP-TIME-NFR2`). trip-time never reads the device's time
  zone (§4), and every device that has loaded the same rules file gives the same results. The
  tests of §4.12 run under two device time zones.
- **Deterministic.** Every function but `loadRules` gives the same result for the same arguments
  and the same rules. `sort` keeps tied values in the order given.
- **Readable forever.** `parse` reads any text `toText` wrote, under any later rules (§4.1).
- **Fast.** Finding an offset is a binary search of one zone's changes, so sorting a trip of a few
  thousand values takes no noticeable time on a phone.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [SHR:TRIP-TIME-F1](../../requirements/shared/trip-time.md#^shr-trip-time-f1) | The six kinds of §3.3, created by §4.3 and stored in the text form of §4.1, and the `unknown-zone` refusal. The zone itself comes from the caller. |
| [SHR:TRIP-TIME-F2](../../requirements/shared/trip-time.md#^shr-trip-time-f2) | A text form that records clock times and not moments (§4.1), with every moment worked out from the rules loaded (§4.2). |
| [SHR:TRIP-TIME-F3](../../requirements/shared/trip-time.md#^shr-trip-time-f3) | The `skipped-time` refusal of §4.3, with its nearest valid times. |
| [SHR:TRIP-TIME-F4](../../requirements/shared/trip-time.md#^shr-trip-time-f4) | The first candidate by default, and the `second` mark, of §4.2 and §4.3. |
| [SHR:TRIP-TIME-F5](../../requirements/shared/trip-time.md#^shr-trip-time-f5) | `duration`, from the moments each value covers (§4.5, §4.7). |
| [SHR:TRIP-TIME-F6](../../requirements/shared/trip-time.md#^shr-trip-time-f6) | The `span-order` refusal of §4.7. |
| [SHR:TRIP-TIME-F7](../../requirements/shared/trip-time.md#^shr-trip-time-f7) | The sort key of §4.6, and the fixed hours of §4.5. |
| [SHR:TRIP-TIME-F8](../../requirements/shared/trip-time.md#^shr-trip-time-f8) | `format` and `formatDuration`, in §4.8. Where the traveller chooses the styles is the web app, whose specification is not yet written. |
| [SHR:TRIP-TIME-F9](../../requirements/shared/trip-time.md#^shr-trip-time-f9) | `relativeTo`, in §4.9. Reading the device's clock is the caller. |
| [SHR:TRIP-TIME-NFR1](../../requirements/shared/trip-time.md#^shr-trip-time-nfr1) | No network code, and every function working from the loaded rules (§6). Bundling, fetching and storing the rules file is the web app, whose specification is not yet written (ADR-0008). |
| [SHR:TRIP-TIME-NFR2](../../requirements/shared/trip-time.md#^shr-trip-time-nfr2) | Never reading the device's time zone (§4), and the tests under two time zones (§4.12). One rules file on every device is the web app (ADR-0008). |

## 8. Open

None. Nothing in this specification is undecided.
