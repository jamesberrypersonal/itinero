# The permissions component

**Assumes** [permissions.md](../../requirements/access/permissions.md) — what the permissions component promises, and the levels, exceptions and grants it holds.

## 1. Purpose

The permissions component is the component, built as one package, that holds the access each
traveller has been given to a trip, and decides what each traveller may see and change. Other
components use it to apply each grant an admin makes, to ask whether to allow a request, and to
choose what a traveller and their phone are given. It works the same in a browser with no
connection as on a server.

## 2. Scope

The permissions component covers a trip's grants, each traveller's level for a page, the calendar
and a booking, the check of each request, what a traveller may see and hold on a phone, and the text
form a trip's grants are stored in.

Two things act on it:

- **The component holding the copy of each trip online** applies every grant, checks every
  request before carrying it out, and gives each traveller only what the component says they may
  see. That component is not yet registered (§8).
- **The web app**, the system travellers use on a computer or a phone, asks the same questions of
  the copy on the phone, to show a traveller what they may change.

Deliberately absent:

- carrying out or stopping a request, which the caller does on its answer
- who is on a trip and who is an admin, which `access/membership` holds and the caller passes in
- who is making a request, which `access/accounts` establishes
- storing the grants, or sending them between devices
- access to one stretch or one firm item of the calendar, which is granted whole

Access passes down a trip's tree of pages, from the trip as its root (ADR-0012, access to a page
passes down to the pages beneath it). The calendar is granted apart from the pages, and is hidden
from each traveller until an admin grants it. Each booking is seen by the travellers it names and
the admins (ADR-0013, a trip's bookings have a page of their own, and its calendar is seen only by
the travellers an admin chooses).

The permissions component is written in TypeScript, as one package that runs unchanged in the
browser and on Node.js, the JavaScript runtime servers use. It reads a trip's pages as values of
`@itinero/pages`, the package of `planner/pages`, the component that holds a trip's pages.

## 3. Interface

### 3.1 User interface

None. The permissions component has no user interface. The web app shows what its functions
return.

### 3.2 Application interface

None. The permissions component has no network or service interface. A request reaches it through
the component holding the copy of each trip online (§8).

### 3.3 Programming interface

The package `@itinero/permissions` exports the types and functions below. Every object a function
returns is frozen. No function changes its arguments. Every function gives a result that depends
only on its arguments.

```ts
import type { Refusal, Result } from "@itinero/trip-time";
import type { Pages, Change as PageChange } from "@itinero/pages";

type Id = string;                     // as @itinero/pages gives it
type Level = "none" | "view" | "edit";
type TripLevel = "view" | "edit";

type Grant = { traveller: Id; trip: TripLevel; calendar: Level;
               pages: readonly { page: Id; level: Level }[] };     // the exceptions, by page id
type Grants = { format: 1; trip: Id; revision: number;
                grants: readonly Grant[] };                         // ordered by traveller

type Who = { traveller: Id; admin: boolean };    // the caller gives it, from access/membership

type GrantChange =
  | { op: "add";      traveller: Id; trip: TripLevel; calendar: Level }
  | { op: "remove";   traveller: Id }
  | { op: "trip";     traveller: Id; level: TripLevel }
  | { op: "calendar"; traveller: Id; level: Level }
  | { op: "page";     traveller: Id; page: Id; level: Level }
  | { op: "unpage";   traveller: Id; page: Id };

type Request =
  | { kind: "read-page";    page: Id }
  | { kind: "change-page";  change: PageChange }
  | { kind: "read-buried";  page: Id }
  | { kind: "read-calendar" }
  | { kind: "change-calendar" }
  | { kind: "read-booking";   travellers: readonly Id[] }    // the travellers the booking names
  | { kind: "change-booking"; travellers: readonly Id[] }
  | { kind: "grant";        change: GrantChange };

type Seen = { pages: Pages; graveyard: readonly Id[]; calendar: Level };

function newGrants(trip: Id): Grants;
function applyGrant(grants: Grants, pages: Pages, change: GrantChange): Result<Grants>;

function pageLevel(grants: Grants, who: Who, pages: Pages, page: Id): Level;
function calendarLevel(grants: Grants, who: Who): Level;
function bookingLevel(grants: Grants, who: Who, travellers: readonly Id[]): Level;

function authorise(grants: Grants, who: Who, pages: Pages, request: Request): Result<true>;
function seen(grants: Grants, who: Who, pages: Pages): Seen;
function widens(grants: Grants, pages: Pages, page: Id, to: { parent?: Id }): number;

function grantsToText(grants: Grants): string;
function grantsFromText(text: string): Result<Grants>;
function grantChangeToText(change: GrantChange): string;
function grantChangeFromText(text: string): Result<GrantChange>;
```

`Refusal` and `Result` are those of `shared/trip-time`, the component that holds a trip's dates and
times, so a caller handles a refusal from every planner and access package the same way. A
`Result` is `{ ok: true, value }` on success, and `{ ok: false, refusal }` otherwise. A `Refusal`
holds a `code`, from the table below, a `message`, which is one English sentence a caller may show,
and `details` where the table names them.

| Refusal code | Returned by | When |
|---|---|---|
| `malformed` | every function returning a `Result` | The fields or the text are not in the form §3.3 or §5.1 gives |
| `not-on-trip` | `applyGrant`, `authorise` | A traveller the grants do not hold |
| `already-on-trip` | `applyGrant` | An `add` for a traveller the grants already hold |
| `unknown-page` | `applyGrant`, `authorise` | A page the trip's pages do not hold |
| `hidden-above` | `applyGrant` | A view or edit exception beneath a page whose level for the traveller is none. `details.page` names that page |
| `no-view` | `authorise` | A read of something whose level for the traveller is none |
| `no-edit` | `authorise` | A change to something whose level for the traveller is not edit |
| `admin-only` | `authorise` | A `read-buried`, a `restore` of a page, or a `grant`, by a traveller who is not an admin |
| `unknown-format` | `grantsFromText` | Grants whose `format` is not 1 |

### 3.4 Systems this drives

None. The permissions component imports only the types of `@itinero/trip-time`, and the types and
functions of `@itinero/pages`, which `spec/planner/pages.md` specifies.

## 4. Behaviour

Behaviour crossing every operation:

- **An admin has edit for everything.** Every level function gives `edit` for a `Who` whose
  `admin` is true, and `authorise` allows every request of an admin.
- **Levels are ordered** none, then view, then edit. A request needing view is allowed at view or
  edit.
- **The tree is the pages' own.** The permissions component reads a page's parent from the page's
  record in `@itinero/pages`. A page in the graveyard keeps its parent, so its level is worked out
  in the same way as a page in the tree's.

### 4.1 Grants

*Porcelain:* `newGrants(trip)` gives a trip's grants with no traveller and revision 1.
`applyGrant(grants, pages, change)` checks the change and gives the grants with it made, and with
the revision one higher (`ACC:PERMISSIONS-F2`, `ACC:PERMISSIONS-F6`). A change it refuses gives
the refusal, and the grants passed in are unchanged. Every check is made before anything is
changed.

| Change | Effect | Refused when |
|---|---|---|
| `add` | Adds the traveller with the access to the trip and the calendar given, and no exceptions | `already-on-trip` |
| `remove` | Removes the traveller and every exception they hold | `not-on-trip` |
| `trip` | Sets the traveller's access to the trip | `not-on-trip`, and `malformed` for a level of none |
| `calendar` | Sets the traveller's level for the calendar | `not-on-trip` |
| `page` | Sets the traveller's exception for the page, replacing any it holds | `not-on-trip`, `unknown-page`, `hidden-above` |
| `unpage` | Removes the traveller's exception for the page, if any | `not-on-trip` |

A `page` change of level view or edit is refused with `hidden-above` where the page's parent, or
any page above it, has level none for the traveller. The level is worked out as §4.2 gives, with
the change not yet made. `details.page` names the highest such page, so that the admin is shown the
page to open first. A `page` change of level none is never refused for this reason.

An exception for a page the trip no longer holds is kept, and does nothing. A change sets whole
fields, so of two changes to the same field, the later one stands.

### 4.2 A traveller's level for a page

*Plumbing:* `pageLevel(grants, who, pages, page)` works down from the top of the trip to the page
(`ACC:PERMISSIONS-F1`):

1. the level starts as the traveller's access to the trip
2. at each page on the way, from the page at the top of the trip down to the page asked about, an
   exception the traveller holds for that page replaces the level
3. once the level is none at any page on the way, it stays none to the end

A traveller the grants do not hold has level none for every page. So does a page the trip does not
hold.

### 4.3 The calendar and bookings

*Porcelain:* `calendarLevel(grants, who)` gives the traveller's level for the calendar, which `add`
sets and `calendar` changes (`ACC:PERMISSIONS-F3`). `bookingLevel(grants, who, travellers)` gives
the traveller's access to the trip where `travellers` names them, and none where it does not. The
bookings system, which holds a trip's bookings, passes the travellers each booking names.

### 4.4 authorise

*Porcelain:* `authorise(grants, who, pages, request)` allows a request with `{ ok: true }`, or
refuses it with the first refusal below that applies (`ACC:PERMISSIONS-F4`).

| Request | Needs |
|---|---|
| `read-page` | View for the page |
| `change-page` `add` | Edit for the parent given, or edit access to the trip for a page at the top |
| `change-page` `rename`, `write`, `bury` | Edit for the page |
| `change-page` `move` | Edit for the page, and edit for the new parent or the trip, as for `add` |
| `change-page` `restore` | An admin |
| `read-buried` | An admin |
| `read-calendar`, `change-calendar` | View, or edit, for the calendar |
| `read-booking`, `change-booking` | View, or edit, for the booking, by `bookingLevel` |
| `grant` | An admin |

A traveller the grants do not hold is refused every request with `not-on-trip`. A request naming a
page the trip does not hold is refused with `unknown-page`. Otherwise a request short of view is
refused with `no-view`, one short of edit with `no-edit`, and one needing an admin with
`admin-only`.

`authorise` answers only. The caller carries out an allowed request, and returns a refusal to the
traveller unchanged (`ACC:PERMISSIONS-NR1`).

### 4.5 What a traveller sees

*Porcelain:* `seen(grants, who, pages)` gives what the traveller may see (`ACC:PERMISSIONS-F5`):

- **pages:** the result of `forPhone` of `@itinero/pages`, with every page of level none left out.
  A page left out takes the pages beneath it with it, as §4.2 makes them none too. The pages kept
  are whole branches from the top of the trip down
- **graveyard:** the identifiers of the pages of `@itinero/pages`'s `graveyard` whose level for the
  traveller is view or edit, in the order `graveyard` gives
- **calendar:** the traveller's level for the calendar

The caller gives the traveller, and keeps on the traveller's phone, the pages of `seen`, the
calendar where its level is not none, and each booking whose `bookingLevel` is not none.

### 4.6 widens

*Porcelain:* `widens(grants, pages, page, to)` counts the travellers the grants hold whose level
for the page is none now, and would be view or edit after a move of the page under `to.parent`, or
to the top of the trip where `to` has no parent (`ACC:PERMISSIONS-F7`). The level after the move
is worked out as §4.2 gives, on the pages with the move made and the exceptions as they stand.
Admins are not counted, because their level is always edit.

### 4.7 The text form

*Porcelain:* `grantsToText` and `grantChangeToText` write grants and a change as the JSON of §5.1.
`grantsFromText` and `grantChangeFromText` read them back (`ACC:PERMISSIONS-F8`). Reading checks the
form, and does not apply the checks of §4.1 again. `grantsFromText(grantsToText(g))` gives grants
equal to `g`, and the same grants always give the same text.

### 4.8 The test suite

The suite runs with `npm test` in `packages/permissions/`, using Node's built-in test runner. The
recipe `just test-permissions` runs it from anywhere in the repository.

- **Unit tests** cover each refusal of §3.3, each row of the tables of §4.1 and §4.4, and every
  check in the verification of each requirement the permissions component claims.
- **Tree tests** build trees of up to a thousand pages, with exceptions at random places, and
  confirm that no page of `seen` lacks its parent (ADR-0012).
- **Order tests** apply the same grants to two copies, and confirm they are equal
  (`ACC:PERMISSIONS-F8`).
- **Round-trip tests** confirm grants holding every kind of exception read back equal to
  themselves.

## 5. Resources

### 5.1 The text form of a trip's grants

A trip's grants are one JSON object. Keys are written in sorted order, travellers in the order of
their identifiers, and each traveller's exceptions in the order of their pages' identifiers.

```json
{ "format": 1, "grants": [
    { "calendar": "none", "pages": [ { "level": "none", "page": "c3e2" } ],
      "traveller": "u-41a0", "trip": "edit" },
    { "calendar": "view", "pages": [], "traveller": "u-9b17", "trip": "view" } ],
  "revision": 6, "trip": "6f1e" }
```

A change is written the same way, as an object holding its `op` and its fields.

| Resource | Path | Owned by |
|---|---|---|
| The package | `packages/permissions/` | Whoever keeps the access system's roadmap |
| The npm workspace membership | `packages/permissions` in the workspaces of `package.json` at the repository root | Whoever keeps the access system's roadmap |
| The recipe | `test-permissions`, in the `justfile` at the repository root | Whoever keeps the access system's roadmap |

The package's one runtime dependency is `@itinero/pages`. Its development dependencies are
`@itinero/trip-time`, TypeScript and Node's type definitions.

## 6. Quality attributes

- **Offline, and the same everywhere** (`ACC:PERMISSIONS-NFR1`). The package holds no network code,
  reads nothing from the device, and works from its arguments alone.
- **Deterministic** (`ACC:PERMISSIONS-F8`). The same grants, applied in the same order, give equal
  grants, and the same grants always give the same text.
- **Never a page without its parent** (ADR-0012). Once a page's level is none, every page beneath
  it is none, whatever its exceptions (§4.2), so `seen` gives only whole branches.
- **Fails closed** (`ACC-NFR1`). A traveller, a page or a request the component does not recognise
  gives none, or a refusal, never access.
- **Bounded.** A level is worked out by one walk from the top of the trip to the page, so its cost
  grows with the page's depth, not with the number of pages.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [ACC:PERMISSIONS-F1](../../requirements/access/permissions.md#^acc-permissions-f1) | `pageLevel`, in §4.2. |
| [ACC:PERMISSIONS-F2](../../requirements/access/permissions.md#^acc-permissions-f2) | `applyGrant` and the `hidden-above` refusal, in §4.1. |
| [ACC:PERMISSIONS-F3](../../requirements/access/permissions.md#^acc-permissions-f3) | `calendarLevel` and `bookingLevel`, in §4.3. |
| [ACC:PERMISSIONS-F4](../../requirements/access/permissions.md#^acc-permissions-f4) | `authorise`, in §4.4. |
| [ACC:PERMISSIONS-F5](../../requirements/access/permissions.md#^acc-permissions-f5) | `seen`, in §4.5. |
| [ACC:PERMISSIONS-F6](../../requirements/access/permissions.md#^acc-permissions-f6) | The `add` and `remove` changes of §4.1. |
| [ACC:PERMISSIONS-F7](../../requirements/access/permissions.md#^acc-permissions-f7) | `widens`, in §4.6. |
| [ACC:PERMISSIONS-F8](../../requirements/access/permissions.md#^acc-permissions-f8) | The text form of §4.7 and §5.1, and every check made before anything is changed, in §4.1. |
| [ACC:PERMISSIONS-NFR1](../../requirements/access/permissions.md#^acc-permissions-nfr1) | No network code, and nothing read from the device (§6). |
| [ACC-F4](../../requirements/access/access.md#^acc-f4) | Access to the trip passing to every page, in §4.2. A new page needs no grant, because its level comes from its parent. |
| [ACC-F5](../../requirements/access/access.md#^acc-f5) | The calendar's level, none until granted (§4.1, §4.3). Showing or hiding the calendar is the web app, whose specification is not yet written. |
| [ACC-F6](../../requirements/access/access.md#^acc-f6) | `bookingLevel` (§4.3). The travellers each booking names are the bookings system's, whose specification is not yet written. |
| [ACC-F7](../../requirements/access/access.md#^acc-f7) | Exceptions, and the `hidden-above` refusal naming the page (§4.1, §4.2). |
| [ACC-F8](../../requirements/access/access.md#^acc-f8) | `no-view` and `no-edit` (§4.4), and pages of level none left out of `seen` (§4.5). Showing a link as not available is the web app. |
| [ACC-F9](../../requirements/access/access.md#^acc-f9) | `widens` (§4.6). Asking the traveller to confirm is the web app. |
| [ACC-F10](../../requirements/access/access.md#^acc-f10) | The graveyard of `seen` (§4.5), and `admin-only` for `read-buried` and `restore` (§4.4). |
| [ACC-F12](../../requirements/access/access.md#^acc-f12) | `seen`, which gives what a phone may hold (§4.5). Bringing the phone's copy up to date is the component holding the copy of each trip online, which is not yet registered. |
| [ACC-NFR1](../../requirements/access/access.md#^acc-nfr1) | `authorise`, which fails closed (§4.4, §6). Asking it before every request is the component holding the copy of each trip online, which is not yet registered. Knowing who sent the request is `access/accounts`. |

## 8. Open

- **Where the grants are held, and who calls `authorise`.** The component holding the copy of each
  trip online stores each trip's grants beside its pages, and asks `authorise` before every
  request. It is to be registered in Milestone Planner-0.3.
- **Changes to access after a delete.** A page in the graveyard keeps its parent, so a traveller's
  level for it follows their access as it stands, not as it stood at the delete (§4.5). An admin
  who hides a branch after one of its pages was deleted hides that page in the graveyard too.
