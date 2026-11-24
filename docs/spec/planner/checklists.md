# The checklists component

**Assumes** [checklists.md](../../requirements/planner/checklists.md) — what the checklists component promises, and the checklists, templates and items it holds.

## 1. Purpose

The checklists component is the component, built as one package, that holds each traveller's
checklists: those on a trip, and the templates the traveller keeps outside any trip. Other
components, such as the web app, use it to make a checklist, apply each change to it, copy it into
another, keep a traveller's checklists in order, count its ticked items, and write it as text. It works the same in a browser with no
connection as on a server.

## 2. Scope

The checklists component covers one checklist at a time: its title, its items in order, their
ticks, the changes that edit it, and the copy from one checklist into a new one. It also covers the
order of a traveller's checklists on one trip, or of their templates, and the text form each
checklist and change is stored and sent in.

Three things act on it:

- **A caller**, such as the web app, makes checklists, builds changes, applies them and copies
  checklists (§3.3).
- **`planner/trip-host`**, the component holding the copy of each trip online, applies every change
  to a checklist on that trip, stores the checklist, and sends it to its traveller's devices alone.
- **`planner/library`**, the component holding each traveller's library online, does the same for
  each template, in a table of the online side's D1 database, Cloudflare's SQL database (ADR-0024,
  a traveller's checklists are their own).

Deliberately absent:

- storing a checklist, deleting one, or sending a checklist or a change between devices. A
  checklist is deleted for good, once its traveller confirms, by whatever stores it (ADR-0024)
- deciding who may see or change a checklist, which is its caller's. A checklist is given only to
  the traveller it belongs to (ADR-0024, a traveller's checklists are their own)
- showing a checklist, which is the web app's
- remembering which template a checklist was copied from (ADR-0024)
- anything in a checklist but its title and items, such as a date to finish by, notes, or a link to
  a page
- merging changes made on two devices while apart (ADR-0004, a trip is read-only offline)

Each checklist is held as a record of its own, holding its items, so that it is stored and sent
only to the traveller it belongs to. Every change writes exactly that one record.

The checklists component is written in TypeScript, like `planner/pages`, the component that holds
a trip's pages. It is one package that runs unchanged in the browser and on Node.js, the
JavaScript runtime servers use.

## 3. Interface

### 3.1 User interface

None. The checklists component has no user interface. The web app shows what its functions return,
in a section of its own, apart from the pages.

### 3.2 Application interface

None. The checklists component has no network or service interface. A change reaches the copy of a
checklist held online through the online side (§2).

### 3.3 Programming interface

The package `@itinero/checklists` exports the types and functions below. Every object a function
returns is frozen. No function changes its arguments. Every function gives a result that depends
only on its arguments.

```ts
import type { Refusal, Result } from "@itinero/trip-time";

type Id = string;            // 1 to 64 of A–Z, a–z, 0–9, "-" and "_"

type Item = { id: Id;        // unique within its checklist
              text: string;
              ticked?: true };   // present: ticked. Never present on a template's item

type Checklist = { format: 1; id: Id;
                   owner: Id;    // the traveller's account, as access/accounts gives it
                   trip?: Id;    // absent: a template
                   order: string;   // its place in its list (§4.5)
                   title: string;
                   items: readonly Item[] };   // in the traveller's order

// A list: one traveller's checklists on one trip, or their templates, each by its id and order.
// The caller gives it. A Checklist is a Placed, so a caller holding the checklists passes them.
type Placed = { id: Id; order: string };
type List = readonly Placed[];

type Change =
  | { op: "rename"; checklist: Id; title: string }
  | { op: "add";    checklist: Id; item: Id; text: string; after?: Id }   // after absent: first
  | { op: "write";  checklist: Id; item: Id; text: string }
  | { op: "move";   checklist: Id; item: Id; after?: Id }
  | { op: "remove"; checklist: Id; item: Id }
  | { op: "tick";   checklist: Id; item: Id; ticked: boolean }
  | { op: "place";  checklist: Id; order: string };

type Progress = { ticked: number; of: number };

function newChecklist(id: Id, owner: Id, title: string, list: List, trip?: Id): Result<Checklist>;
function apply(checklist: Checklist, change: Change): Result<Checklist>;
function copyChecklist(from: Checklist, id: Id, list: List, trip?: Id): Result<Checklist>;
function progress(checklist: Checklist): Progress;

function ordered<T extends Placed>(list: readonly T[]): readonly T[];
function placeAfter(list: List, id: Id, after?: Id): Result<Change>;   // after absent: first

function checklistToText(checklist: Checklist): string;
function checklistFromText(text: string): Result<Checklist>;
function changeToText(change: Change): string;
function changeFromText(text: string): Result<Change>;
```

`Refusal` and `Result` are those of `shared/trip-time`, the component that holds a trip's dates and
times, so a caller handles a refusal from any planner package the same way. A `Result` is
`{ ok: true, value }` on success, and `{ ok: false, refusal }` otherwise. A `Refusal` holds a
`code`, from the table below, and a `message`. A refusal's `message` is one English sentence saying
what was refused and why. A caller may show it to the traveller.

| Refusal code | Returned by | When |
|---|---|---|
| `malformed` | every function returning a `Result` | The fields or the text are not in the form §3.3 or §5.1 gives |
| `bad-id` | `newChecklist`, `apply`, `copyChecklist` | An identifier outside the form of `Id` |
| `bad-title` | `newChecklist`, `apply` | A title that is empty once trimmed, holds a line break, or is longer than 200 characters |
| `bad-text` | `apply` | An item's text that is empty once trimmed, holds a line break, or is longer than 500 characters |
| `too-many-items` | `apply` | An `add` to a checklist that holds 200 items |
| `duplicate-id` | `apply` | An `add` of an item whose identifier the checklist already holds |
| `unknown-item` | `apply` | An `item` or an `after` the checklist does not hold |
| `wrong-checklist` | `apply` | A change whose `checklist` is not the identifier of the checklist given |
| `template-tick` | `apply` | A `tick` of an item of a template |
| `bad-order` | `apply` | A `place` whose `order` is outside the form §4.5 gives |
| `unknown-checklist` | `placeAfter` | An `id` or an `after` the list does not hold |
| `unknown-format` | `checklistFromText` | A checklist whose `format` is not 1 |

A character, wherever a length is counted, is one Unicode code point. A line break is a line feed,
a carriage return, or any other character Unicode classes as a line or paragraph separator.

### 3.4 Systems this drives

None. The checklists component imports only the types `Refusal` and `Result` from
`@itinero/trip-time`, which `spec/shared/trip-time.md` specifies.

## 4. Behaviour

Behaviour crossing every operation:

- **The owner never changes.** No change sets `owner`, and a copy takes the owner of the checklist
  copied. A checklist therefore never passes from one traveller to another (ADR-0024).
- **A trip's checklist and a template differ only in `trip`.** No change sets or clears it. A
  checklist moves between a trip and the library only by a copy (§4.3).
- **Nothing reads the device.** No function reads the clock, the time zone or the language the
  device is set to (`PLN:CHECKLISTS-NFR1`).

### 4.1 newChecklist

*Porcelain:* `newChecklist(id, owner, title, list, trip)` gives a checklist with the title given
and no items. With `trip`, it is a checklist on that trip. Without it, it is a template. Its `order`
puts it after every checklist of `list`, which holds the owner's other checklists on the same trip,
or their other templates (§4.5). The caller makes
the identifier, as `crypto.randomUUID()` does, and gives the owner from the account signed in. It
refuses with `bad-id` an `id`, `owner` or `trip` outside the form of `Id`, and with `bad-title` a
title §4.2 refuses.

### 4.2 apply

*Porcelain:* `apply(checklist, change)` checks the change against the checklist, and gives the
checklist with the change made (`PLN:CHECKLISTS-F6`). A change it refuses gives the refusal, and the
checklist given is unchanged. Every check is made before anything is changed. Every change is first
refused with `wrong-checklist` where its `checklist` is not the checklist's `id`.

| Change | Effect | Refused when |
|---|---|---|
| `rename` | Sets the checklist's title | `bad-title` |
| `add` | Adds an item, unticked, with the text given, after the item `after` names, or first where `after` is absent | `bad-id`, `duplicate-id`, `unknown-item` for `after`, `bad-text`, `too-many-items` |
| `write` | Sets the item's text, and keeps its tick | `unknown-item`, `bad-text` |
| `move` | Puts the item after the item `after` names, or first where `after` is absent. An item moved after itself keeps its place | `unknown-item`, for `item` or `after` |
| `remove` | Removes the item, ticked or not | `unknown-item` |
| `tick` | Sets the item ticked where `ticked` is true, and unticked where it is false | `unknown-item`, `template-tick` |
| `place` | Sets the checklist's `order`, which `placeAfter` works out (§4.5) | `bad-order` |

A title and an item's text are trimmed of spaces at both ends before they are checked and kept, and
are otherwise kept as given (`PLN:CHECKLISTS-F2`). The checks of a title and an item's text, which
§3.3 gives, are made on the trimmed text. A change sets whole fields, and never adds to or subtracts
from them. Of two changes to the same field, the later one therefore stands. A `tick` of an item
already as `ticked` gives it, is accepted, and changes nothing.

A ticked item holds `ticked: true`, and an unticked item holds no `ticked`. A checklist therefore
has one form for each state, and two equal checklists give the same text (§4.4).

### 4.3 copyChecklist

*Porcelain:* `copyChecklist(from, id, list, trip)` gives a new checklist, identified by `id`, with
the owner, the title and the items of `from`, in the same order, each with the same identifier and
text, and none ticked (`PLN:CHECKLISTS-F4`). With `trip`, the copy is a checklist on that trip.
Without it, the copy is a template. Its `order` puts it after every checklist of `list`, the list
it joins, as for `newChecklist`. `from` may be a template or a checklist on a trip. It refuses with
`bad-id` an `id` or `trip` outside the form of `Id`.

The copy holds no reference to `from`, so later changes to either never reach the other
(ADR-0024). A traveller starts a trip's checklist from a template by copying the template with the
trip, and saves a trip's checklist as a template by copying it without one.

### 4.4 progress

*Porcelain:* `progress(checklist)` gives the number of its items that are ticked, as `ticked`, and
the number of its items, as `of` (`PLN:CHECKLISTS-F3`). A template's `ticked` is always 0. The web
app shows it beside each checklist, such as "1 of 3", and lists on a trip's home page each checklist
not yet done, before the traveller's first date.

### 4.5 The order of a traveller's checklists

*Porcelain:* `ordered(list)` gives the checklists of a list in their traveller's order
(`PLN:CHECKLISTS-F7`). `placeAfter(list, id, after)` gives the `place` change that moves the
checklist `id` to just after the checklist `after`, or to the start where `after` is absent. The
caller applies that change to the checklist moved, so that a move writes that one checklist alone.
A checklist placed after itself keeps its place.

*Plumbing:* a list is ordered by `order`, comparing code unit by code unit, then by `id`. An
`order` is one or more of the 62 characters 0–9, A–Z and a–z, taken in that order, and never ends in
0. Between any two such strings there is always another. A checklist placed between two neighbours
takes the shortest `order` that sorts between them, and the lower of two equally short ones. The
form and the choice are those `spec/planner/pages.md` §4.3 gives the pages under one parent.

- a new checklist, and a copy, sort after the last checklist of the list given, with nothing after
  them
- a checklist moved sorts after the checklist `after` names and before the one that follows it, or
  before the first checklist of the list where `after` is absent

The caller gives each list whole: every checklist of one traveller on one trip, or every template of
one traveller. Two checklists of different lists are never compared. A caller that stores the
`order` of each checklist apart from its text, as `planner/library` does, builds a list without
reading any checklist's text.

### 4.6 The text form

*Porcelain:* `checklistToText` and `changeToText` write a checklist and a change as the JSON of
§5.1. `checklistFromText` and `changeFromText` read them back (`PLN:CHECKLISTS-F5`). Reading checks
the form, including that no template's item holds `ticked` and that no two items share an
identifier. Reading does not apply the limits of §4.2 again, so a checklist stored once can always be
read back. `checklistFromText(checklistToText(c))` gives a checklist equal to `c`, and the same
checklist always gives the same text.

### 4.7 The test suite

The suite runs with `npm test` in `packages/checklists/`, using Node's built-in test runner. The
recipe `just test-checklists`, of just, the command runner the repository uses, runs it from
anywhere in the repository.

- **Unit tests** cover each refusal of §3.3, each row of the table of §4.2, and every check in the
  verification of each requirement the checklists component claims.
- **Order tests** apply the same changes to two copies of a checklist, and confirm the two are equal
  (`PLN:CHECKLISTS-F6`). They also place a thousand checklists, each before the last placed, and
  confirm every `order` stays in the form of §4.5 (`PLN:CHECKLISTS-F7`).
- **Round-trip tests** confirm that a template, and a checklist on a trip with every item ticked,
  each holding text with every kind of character, read back equal to themselves
  (`PLN:CHECKLISTS-F5`).
- **Device independence tests** apply the same changes in two processes, one with the `LANG` and
  `LC_ALL` environment variables set to `en_GB.UTF-8` and the `TZ` variable to `Europe/London`,
  and one with them set to `tr_TR.UTF-8` and `Asia/Tokyo`, and confirm every result is the same
  (`PLN:CHECKLISTS-NFR1`).
- **Source tests** confirm that no module of the package uses `Date`, Intl, Temporal, any network
  call, any Node module, any function whose result depends on the device's language, such as
  `toLocaleLowerCase`, or anything but types from another package (§4, §6).

The workflow `.github/workflows/test-packages.yml` runs the suite on each pull request and each
push to `main`, with every other package of the npm workspace (ADR-0023, continuous integration
runs on each pull request and each push to main).

## 5. Resources

### 5.1 The text form of a checklist

A checklist is one JSON object, holding its items. Keys are written in sorted order, with no white
space between tokens. A checklist on a trip, and a template, read as below, spread over lines only
to be read:

```json
{ "format": 1, "id": "b2c9", "items": [
    { "id": "i1", "text": "Passport valid for six months", "ticked": true },
    { "id": "i2", "text": "Copies of documents" },
    { "id": "i3", "text": "Travel insurance" } ],
  "order": "V", "owner": "7a0d", "title": "Before leaving", "trip": "6f1e" }
```

```json
{ "format": 1, "id": "e51a", "items": [
    { "id": "i1", "text": "Passport valid for six months" } ],
  "order": "k", "owner": "7a0d", "title": "Before leaving" }
```

A change is written the same way, as an object holding its `op` and its fields.

| Resource | Path | Owned by |
|---|---|---|
| The package | `packages/checklists/` | Whoever keeps the planner's roadmap |
| The npm workspace membership | `packages/checklists` in the workspaces of `package.json` at the repository root | Whoever keeps the planner's roadmap |
| The recipe | `test-checklists`, in the `justfile` at the repository root | Whoever keeps the planner's roadmap |

The package imports only types from `@itinero/trip-time`, so it has no runtime dependency. Its
development dependencies are `@itinero/trip-time`, TypeScript and Node's type definitions.

## 6. Quality attributes

- **Offline** (`PLN:CHECKLISTS-NFR1`). The checklists component holds no network code. Every
  function works from its arguments alone.
- **The same on every device** (`PLN:CHECKLISTS-NFR1`). Nothing reads the device's clock, time zone
  or language. The tests of §4.7 run under two languages and two time zones.
- **Deterministic** (`PLN:CHECKLISTS-F6`). The same changes, applied in the same order, give equal
  checklists. The same checklist always gives the same text.
- **One record per change.** Every change writes exactly one record, the checklist it names (§2).
- **Bounded** (`PLN:CHECKLISTS-F2`). A checklist holds at most 200 items of at most 500 characters
  each, so its text form stays under half a megabyte, however it is written to.
- **Private by construction.** A checklist's owner is set once, and no change or copy gives it to
  another traveller (§4). Keeping it from everyone else is its caller's (ADR-0024).

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [PLN:CHECKLISTS-F1](../../requirements/planner/checklists.md#^pln-checklists-f1) | The `rename`, `add`, `write`, `move` and `remove` changes of §4.2. |
| [PLN:CHECKLISTS-F2](../../requirements/planner/checklists.md#^pln-checklists-f2) | The trimming of §4.2, and the `bad-title`, `bad-text` and `too-many-items` refusals of §3.3. |
| [PLN:CHECKLISTS-F3](../../requirements/planner/checklists.md#^pln-checklists-f3) | The `tick` change and the `template-tick` refusal, in §4.2, and `progress`, in §4.4. |
| [PLN:CHECKLISTS-F4](../../requirements/planner/checklists.md#^pln-checklists-f4) | `copyChecklist`, in §4.3, and an owner no change sets (§4). |
| [PLN:CHECKLISTS-F5](../../requirements/planner/checklists.md#^pln-checklists-f5) | The text form of §4.6 and §5.1. |
| [PLN:CHECKLISTS-F6](../../requirements/planner/checklists.md#^pln-checklists-f6) | `apply`, with every check made before anything is changed, in §4.2. Applying each change to the copy held online is `planner/trip-host`'s and `planner/library`'s. |
| [PLN:CHECKLISTS-F7](../../requirements/planner/checklists.md#^pln-checklists-f7) | `ordered`, `placeAfter` and the `place` change, and the order a new checklist or a copy takes (§4.1, §4.3, §4.5). |
| [PLN:CHECKLISTS-NFR1](../../requirements/planner/checklists.md#^pln-checklists-nfr1) | No network code, and never reading the device (§4, §6). Keeping a copy on the phone is `web/trip-store`. |
| [PLN-F17](../../requirements/planner/planner.md#^pln-f17) | Templates, made by `newChecklist` without a trip or by `copyChecklist` from a trip's checklist (§4.1, §4.3). Keeping each traveller's library online, and giving it to them alone, is `planner/library`. |
| [PLN-F18](../../requirements/planner/planner.md#^pln-f18) | Checklists on a trip, copied from a template with no item ticked, and ticked with `tick` (§4.2, §4.3). Giving each checklist only to its traveller is `planner/trip-host`. |

## 8. Open

None. `web/screens` shows a trip's checklists and the traveller's library in screens of their own,
as `spec/web/screens.md` §4.10 gives.
