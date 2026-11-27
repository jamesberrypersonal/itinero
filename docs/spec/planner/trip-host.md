# The trip host

**Assumes** [trip-host.md](../../requirements/planner/trip-host.md) — what the trip host promises, and the calendar, pages, grants and sequence it holds.

## 1. Purpose

The trip host is the part of Itinero's online side that holds the one copy of each trip, which every
change is applied to. Each trip lives in a Cloudflare Durable Object of its own. The trip host
creates trips, checks and applies every change, catches each device up on what it may see, and
tells each open device when a trip changes.

## 2. Scope

The trip host covers a trip's calendar, pages, grants of access, bookings and each traveller's
checklists as stored online, the changes to them, catching a device up, telling open devices of changes, and reading and restoring pages in the
graveyard.

Three things act on it:

- **The web app**, the system travellers use on a computer or a phone, creates trips, sends
  changes, catches up and listens for changes (§3.2).
- **`access/accounts`**, the component that signs travellers in, names the account behind each
  request.
- **`access/membership`**, the component that holds who is on each trip, says whether an account
  is on a trip and whether it is an admin, and hands the trip host the grants of each traveller who
  joins or is removed.

Deliberately absent:

- deciding what a traveller may do, which `access/permissions` does when the trip host asks
- the rules of the calendar and the pages, which `planner/itinerary` and `planner/pages` hold
- the rules of a booking, which `bookings/list`, the component that checks and orders a trip's
  bookings, holds with the components of each kind of booking
- the rules of a checklist, which `planner/checklists`, the component that holds checklists and
  templates, holds
- a traveller's templates, which `planner/library` holds outside any trip
- accepting a change made with no connection, or merging changes made while apart (ADR-0004, a trip
  is read-only offline)
- merging two travellers' edits to one page, which is future work
- searching pages, which a device does on its own copy

Itinero's online side runs on Cloudflare's free plan (ADR-0015, Itinero's online side runs on
Cloudflare's free plan, and travellers sign in with Google alone). Requests reach one Cloudflare
Worker, a program Cloudflare runs for each request. The Worker names the account with
`access/accounts`, and the member with `access/membership`. It then passes the request to the
trip's Durable Object: a small program with its own SQLite database, which Cloudflare runs in one
place and which handles one request at a time. The Durable Object is the trip host's copy of the
trip. It holds the trip's bookings beside the rest of the trip (ADR-0016, a trip's bookings are
entered by hand, as one of four kinds, and kept with the trip online).

## 3. Interface

### 3.1 User interface

None. The web app shows what the trip host gives.

### 3.2 Application interface

The trip host answers these requests over HTTPS, each with a JSON body, from a device signed in
through `access/accounts`. Every request of the online side has a path beginning `/api/`, which no
screen of the web app has. A refusal gives a status of 400, 403, 404 or 409, and a JSON body
`{ "code": ..., "message": ..., "details": ... }`. The `message` is one English sentence the web app
may show.

| Request | Body | Gives |
|---|---|---|
| `POST /api/trips` | `{ "name": ..., "first": ..., "last": ..., "countries": [ ... ] }` | `{ "trip": ... }`, the new trip's identifier, with status 201 (§4.2) |
| `GET /api/trips` | None | `{ "trips": [ { "trip": ..., "name": ..., "dates": { "first": ..., "last": ... } } ] }`: each trip the account is on (§4.2) |
| `POST /api/trips/{trip}/changes` | `{ "target": "calendar" \| "pages" \| "grants" \| "bookings" \| "checklists", "change": ..., "agreed": ... }` | `{ "sequence": ... }` (§4.3) |
| `POST /api/trips/{trip}/sync` | `{ "since": ..., "holdsCalendar": ... }` | What the device may hold that changed since (§4.4) |
| `POST /api/trips/{trip}/pages` | `{ "pages": [ ... ] }` | `{ "pages": [ ... ] }`: the text form of each page named that the traveller may see (§4.4) |
| `POST /api/trips/{trip}/bookings` | `{ "bookings": [ ... ] }` | `{ "bookings": [ ... ] }`: the text form of each booking named that the traveller may see (§4.4) |
| `POST /api/trips/{trip}/checklists` | `{ "id": ..., "title": ... }`, or `{ "id": ..., "from": ... }` | `{ "sequence": ... }`, with status 201 (§4.8) |
| `DELETE /api/trips/{trip}/checklists/{id}` | None | `{ "sequence": ... }` (§4.8) |
| `GET /api/trips/{trip}/buried/{page}` | None | `{ "page": ... }`: a page in the graveyard, in its text form, to an admin (§4.6) |
| `GET /api/trips/{trip}/live` | None | A WebSocket that is told of each change (§4.5) |

A `change` is written in the text form of its package: the itinerary's for `calendar`, the pages'
for `pages`, the permissions' for `grants`, the bookings' for `bookings`, and the checklists' for
`checklists`. `from` is a checklist or a template, in the checklists' text form. `countries` is a list of country codes, from the
itinerary's list of countries. `agreed`, where present, is the number of travellers the traveller
agreed would come to see a moved page.

| Refusal code | Status | When |
|---|---|---|
| `not-a-member` | 404 | A request about a trip the account is not on, whether or not the trip exists, or from a member the trip's grants do not hold |
| `creator-only` | 403 | A calendar change that renames the trip or sets its dates, `rename` or `trip-dates`, by a traveller who is not the trip's creator |
| `own-dates-only` | 403 | A `traveller-dates` change for another traveller, by a traveller who is not an admin |
| `membership-only` | 403 | An `add` or a `remove` grant sent by a device. Only `access/membership` sends them |
| `unknown-traveller` | 409 | A booking naming a traveller who is not on the trip. `details.traveller` names them |
| `agree-first` | 409 | A move that would let more travellers see a page than `agreed` says. `details.count` gives how many |
| `unknown-checklist` | 404 | A change or a delete naming a checklist the traveller does not hold on the trip, whether or not another traveller holds one of that identifier |
| `not-yours` | 403 | A `from` whose owner is not the traveller who sent it |
| `duplicate-checklist` | 409 | A new checklist whose identifier the traveller already holds on the trip |
| `checklists-full` | 409 | A new checklist for a traveller who holds 50 on the trip |
| `malformed` | 400 | A body not in the forms above |

Every refusal from `access/permissions`, `planner/itinerary`, `planner/pages`, `bookings/list` and
`planner/checklists` is
returned with its own code and details unchanged, such as `no-edit`, `stale` or `cycle`. A refusal for missing
access has status 403, and any other has status 409.

### 3.3 Programming interface

Inside the online side, the trip's Durable Object gives these methods, which Cloudflare calls
across from the Worker. Nothing outside the online side can reach them.

```ts
import type { GrantChange, Who } from "@itinero/permissions";

type Member = Who & { creator: boolean };        // the Worker gives it (§4)

class TripHost {
  create(trip: string, creator: Member, name: string, first: string, last: string,
         countries: readonly string[]): Promise<Result<true>>;
  change(who: Member, target: "calendar" | "pages" | "grants" | "bookings" | "checklists",
         change: string, agreed?: number): Promise<Result<{ sequence: number }>>;
  addChecklist(who: Member, id: string, start: { title: string } | { from: string })
         : Promise<Result<{ sequence: number }>>;
  deleteChecklist(who: Member, id: string): Promise<Result<{ sequence: number }>>;
  sync(who: Member, since: number | undefined, holdsCalendar: boolean): Promise<Result<Sync>>;
  pages(who: Member, ids: readonly string[]): Promise<Result<readonly string[]>>;
  bookings(who: Member, ids: readonly string[]): Promise<Result<readonly string[]>>;
  buried(who: Member, page: string): Promise<Result<string>>;
  grant(change: GrantChange): Promise<Result<{ sequence: number }>>;   // from access/membership
  touch(): Promise<{ sequence: number }>;                              // from access/membership
  summary(): Promise<{ name: string; first: string; last: string }>;
}
```

The Worker hands `access/membership` a listener, through `access/membership`'s `onChange`.
`access/membership` tells the listener of each change it makes to a trip's members. The listener
passes each `add` and `remove` to the trip's `grant`, the only way either reaches a trip's grants.
It passes each `admin` change, which names a member made an admin, to the trip's `touch`. `Sync` is
the body of §4.4.

### 3.4 Systems this drives

The trip host drives Cloudflare Durable Objects. Each trip's Durable Object is found by the trip's
identifier, with `idFromName`, so the same trip always reaches the same object. Each object stores
its data in a SQLite database of its own, through its `sql` interface, and runs a write and the
reads before it in one transaction.

A Durable Object can accept WebSockets for hibernation. It sleeps while every socket is idle, and
Cloudflare wakes it when a message is to be sent or received, so an open trip costs nothing while
nobody changes it. The WebSocket hibernation interface of Cloudflare's documents gives the detail.

## 4. Behaviour

Behaviour crossing every operation:

- **Every request names its member.** The Worker passes each request to the trip's Durable Object
  only with the member `access/membership` gives for the account. An account not on the trip is
  refused with `not-a-member`, before the Durable Object is reached. The Durable Object refuses, in
  the same way, a member whom its grants do not hold, such as one whose removal stopped part way
  (`spec/access/membership.md` §4.5).
- **Every change and every read is checked first.** The trip host asks `access/permissions`'
  `authorise`, with the trip's grants, pages and member (ACC-NFR1), apart from the checks §4.3
  names that it makes itself: who may set the trip's name and each traveller's dates, the grant
  changes only `access/membership` sends, and every request about a checklist. A refusal is
  returned unchanged, and nothing is read or written.
- **One request at a time.** A Durable Object handles one request at a time. Each change is
  checked, applied and stored in one transaction of its database, so no change sees another half
  done.
- **The sequence.** The trip's `sequence` starts at 1. Every change applied raises it by one, and
  marks each record it writes with the new sequence, as that record's `changed`.

### 4.1 What the Durable Object stores

*Plumbing:* each trip's Durable Object holds six tables:

| Table | Holds |
|---|---|
| `trip` | One row: the trip, with its calendar, in the itinerary's text form, its `changed`, and the trip's `sequence` |
| `pages` | One row for each page: its `changed`, its text and title, each other field of the page in a column of its own, and `seenBy` for a page a `bury` named (§4.6) |
| `grants` | One row: the trip's grants, in the permissions' text form |
| `bookings` | One row for each booking, keyed by its identifier, in the bookings' text form, with its `changed` and the travellers it names, so that a catch-up works out which bookings a traveller may see without reading every booking's text |
| `creator` | One row: the creator's account |
| `checklists` | One row for each checklist, keyed by its owner and its identifier, with its `changed`, its `order`, and its text form in the checklists' text form, so that a catch-up reads only the rows of the traveller asking |

The trip host reads a page's text only where it gives or writes that text: for a page a request
names, or for a page a catch-up gives because it changed since the device's last one. Every request
needs the tree, to work out what the traveller may see, and the tree needs each page's parent,
order and `buried` alone. The trip host therefore builds the pages it gives `@itinero/pages` and
`@itinero/permissions` from the columns, with the text of only the pages it gives or writes. No
function it calls reads the text of any other page. It writes a page's text form, for a
device, from the same row.

The trip host's logic is written over a small interface to a SQLite database, which runs each
statement and each transaction. The Durable Object gives the logic its own database. The cost tests
of §4.7 give it Node's, so that they time the code the Durable Object runs.

The itinerary and the bookings need the world's time-zone rules, which `shared/trip-time` loads
from a rules file. The Worker carries the rules file as one of its files. The Durable Object loads
it as it starts, before it answers any request, as ADR-0008 says a server does. Reading a stored
trip parses each of its times, so every request needs the rules, a catch-up and the list of trips
included. The rules are held by the isolate, so a Durable Object that starts in an isolate where
another has loaded them finds them loaded. A change checked against these rules stands, whatever
rules a device holds (`PLN:ITINERARY-F6`).

### 4.2 Creating a trip

*Porcelain:* `POST /api/trips` makes the trip's identifier with `crypto.randomUUID()`, and calls
`create` on the new trip's Durable Object (`PLN:HOST-F1`). `create`:

1. makes the trip with the itinerary's `newTrip`, and sets its dates with a `trip-dates` change,
   returning any refusal unchanged
2. makes its pages with the pages' `newPages`, with a page for each country, titled with the name
   the itinerary's `countries()` gives it, and identified as `country-` and the country's code in
   lower case, such as `country-cl`
3. makes its grants with `newGrants`, and adds the creator with edit access to the trip and to the
   calendar
4. stores all three, with a `sequence` of 1

The Worker gives `create` the creator as `{ traveller, admin: true, creator: true }`, from the
account `access/accounts` names, because the traveller becomes a member only once the trip is made.
The Worker then calls `access/membership`'s `createTrip`, which makes the traveller the trip's
creator and admin. A trip whose `createTrip` fails has no member, so no request reaches it.

`GET /api/trips` takes the trips `access/membership`'s `trips` gives for the account, and gives each
one's name and dates, from its `summary`.

### 4.3 Applying a change

*Porcelain:* `change` reads the change from its text, and checks it in this order (`PLN:HOST-F2`):

1. **Who may make it.** For `calendar`, a `rename` or a `trip-dates` change needs the trip's
   creator, or is refused with `creator-only`. A `traveller-dates` change for the traveller's own
   dates needs only that they are on the trip, whatever their access to the calendar (`PLN-F14`).
   One for another traveller needs an admin, or is refused with `own-dates-only`. Any other change
   needs edit access to the calendar. For `pages`, the change is asked of `authorise` as a
   `change-page`. For `grants`, an `add` or a `remove` is refused with `membership-only`, and any
   other change is asked as a `grant`. For `bookings`, the trip host reads the booking held with the
   change's identifier, and takes the bookings' `touches`, which gives `before` and `after`: the
   travellers the booking names before the change and after it. It asks `authorise` for a
   `change-booking` naming `before`, where `before` names anyone, and for one naming `after`, where
   `after` names anyone. Each traveller of `after` must be held in the grants, or named in `before`,
   or the change is refused with `unknown-traveller` (`PLN:HOST-F9`). A booking therefore keeps a
   traveller removed from the trip, and a change cannot add one. For `checklists`, the trip host
   reads the checklist the change's `checklist` names among the traveller's own, and refuses with
   `unknown-checklist` where they hold none of that identifier, whatever their access (§4.8).
2. **A move that widens who may see a page** (`PLN:HOST-F4`). For a `move`, the trip host asks
   `access/permissions`'s `widens`. Where it gives more than 0, and more than `agreed`, the change
   is refused with `agree-first`, with the count in `details.count`.
3. **The change itself.** The change is applied with its package's `apply`: the itinerary's, the
   pages', `applyGrant`, the bookings', given the booking held, or the checklists', given the
   checklist held. Any refusal is returned
   unchanged, such as the pages' `stale`, which holds the page's text as it stands (`PLN:HOST-F3`).

Where every check passes, the trip host raises the `sequence`, and stores each record the change
wrote: the trip, the one page `apply` wrote, the grants, the one booking `apply` gave, or the one
checklist, with its `order`. A removed
booking's row is deleted. It raises the sequence and stores or deletes the records in one
transaction. It then tells every open socket of the new sequence (§4.5), and gives
`{ "sequence": ... }`.

`grant`, from `access/membership`, applies an `add` or a `remove` in the same way, with no check of
who sent it (`PLN:HOST-F7`). After a `remove`, the trip host closes every socket of that traveller,
with the close code 4403.

`grant` is safe to repeat, so that `access/membership` finishes an acceptance or a removal that
stopped part way by sending the same change again:

- an `add` for a traveller the grants already hold sets their access to the trip and to the
  calendar to those given, and keeps their exceptions, the levels set for single pages
- a `remove` for a traveller the grants do not hold succeeds, and changes nothing

A `remove` also applies to the calendar a `traveller-dates` change with no `dates` for the
traveller, in the same transaction, so that their own dates leave with them
(`spec/planner/itinerary.md` §4.9). A `remove` leaves the traveller's checklists in place. No
device is given them while the grants do not hold the traveller, and an `add` for the same account
gives them back, as the section on checklists below gives.

`touch`, from `access/membership`, raises the `sequence`, tells every open socket of it, and writes
nothing else (`PLN:HOST-F6`). `access/membership` calls it when a member is made an admin, which
changes no record the trip host holds. Each open device then catches up. The new admin's device is
given everything an admin may see. Every other device's catch-up also asks `access/membership` for
the trip's members (`spec/web/trip-store.md` §4.2), and so marks the new admin as one.

### 4.4 Catching a device up

*Porcelain:* `sync(who, since, holdsCalendar)` gives the device this body (`PLN:HOST-F5`):

| Field | Holds |
|---|---|
| `sequence` | The trip's sequence now. The device keeps it, and gives it as `since` next time |
| `trip` | The trip's name, its dates and the traveller's own dates, which every traveller may see |
| `you` | Whether the traveller is an admin and the creator, and the traveller's own grant |
| `grants` | The trip's grants, in the permissions' text form, where the traveller is an admin. Absent for any other traveller |
| `calendar` | The trip in the itinerary's text form, with its stretches and firm items, where the traveller's level for the calendar is view or edit, and the `trip` row's `changed` is after `since`, or `holdsCalendar` is false. `holdsCalendar` says whether the device holds the calendar already. `null` where their level is none, and absent where nothing changed |
| `pages` | For each page of `seen`, from `access/permissions`, its identifier and its `changed`. A page whose `changed` is after `since` also holds its text form |
| `graveyard` | For each page the pages' `graveyard` lists whose `seenBy` holds the traveller, or for every one to an admin: its identifier, its title, and the number of pages that went with it |
| `bookings` | For each booking whose `bookingLevel` for the traveller is view or edit, its identifier and its `changed`. A booking whose `changed` is after `since` also holds its text form |
| `checklists` | For each checklist the traveller owns on the trip, in the order the checklists' `ordered` gives, its identifier and its `changed`. A checklist whose `changed` is after `since` also holds its text form. Another traveller's checklist is never listed, an admin's catch-up included |

A `since` that is absent counts as 0, so every page holds its text form. The device then:

- drops each page it holds that `pages` does not list, since the traveller may no longer see it
- fetches, with `POST /api/trips/{trip}/pages`, each page `pages` lists without its text that the
  device does not hold. Such a page has become visible through a change of access, not a change
  to the page
- drops the calendar where `calendar` is `null`
- drops each booking it holds that `bookings` does not list, since it was removed, or the traveller
  may no longer see it (`PLN:HOST-F9`)
- fetches, with `POST /api/trips/{trip}/bookings`, each booking `bookings` lists without its text
  that the device does not hold, such as every booking of a trip once its traveller is made an admin
- drops each checklist it holds that `checklists` does not list, since its traveller deleted it

`pages(who, ids)` gives the text form of each page named that `seen` holds, and leaves out any
other, without saying why. `bookings(who, ids)` does the same for each booking named whose
`bookingLevel` for the traveller is view or edit.

`you` holds only the traveller's own grant, and `grants` is given to an admin alone. A traveller
who is not an admin therefore never learns another's access (`PLN:HOST-NFR1`). The grant in `you`
holds only the exceptions for pages the traveller may see, since an exception for any other names a
page hidden from them. An admin is given
every grant on each catch-up, whatever `since` holds, because an admin sets each traveller's access
and must see it first.

A device whose `sync` is refused with `not-a-member` deletes its copy of the trip (`PLN:HOST-F7`).

### 4.5 Telling open devices of changes

*Porcelain:* `GET /api/trips/{trip}/live` opens a WebSocket to the trip's Durable Object, which
accepts it for hibernation, tagged with the traveller's account (`PLN:HOST-F6`). After every change,
the Durable Object sends each open socket one message, `{ "sequence": ... }`. A device that receives
a sequence newer than its own catches up with `sync`.

The message names no part of the trip, so a socket tells a traveller nothing they may not see. A
device whose socket closes reopens it after 1 second, then after twice as long each time, up to
1 minute, and catches up each time it reopens.

### 4.6 The graveyard

*Porcelain:* `buried(who, page)` asks `authorise` for a `read-buried` request, and gives the page's
text form to an admin (`PLN:HOST-F8`). A restore is a `restore` change to `pages`, which
`authorise` allows only to an admin. The pages' `apply` refuses a restore of a page whose parent
is in the graveyard, with `parent-in-graveyard`, and the trip host returns the refusal unchanged.
A restored page therefore always returns to its old place, and to the access of that place.

*Plumbing:* each traveller is shown in the graveyard the deleted pages they could see when each was
deleted (`ACC-F10`). The trip host records who could see each page as it applies a `bury`. Before
the change is made, it asks `access/permissions`'s `pageLevel` for each traveller the grants hold,
counting none of them as an admin. It then stores, in the buried page's `seenBy`, the accounts whose
level was view or edit. A `restore` clears `seenBy`. An admin is shown every page in the
graveyard, whatever `seenBy` holds.

A page deleted only because a page above it was deleted holds no `seenBy`, because the pages'
`graveyard` does not list it. A page deleted earlier than a page above it keeps its own `seenBy`.
Once the page above is restored, it is shown to the travellers its `seenBy` holds (ADR-0021, a
deleted page is restored only to its old place). A traveller who joins after a delete could not see
the page then, and is not shown it.

### 4.7 The test suite

The suite runs with `npm test` in `services/online/`, inside Wrangler, Cloudflare's tool that runs
the Worker, its Durable Objects and D1 on the developer's machine. The recipe `just test-online`
runs it from anywhere in the repository.

- **Unit tests** cover each refusal of §3.2, and every check in the verification of each
  requirement the trip host claims.
- **Wake tests** start a trip host in an isolate where no rules are loaded, and confirm it has
  loaded them before its first request. They then confirm a trip holding an item at a time is
  listed and caught up.
- **Order tests** send changes to one trip from several connections at once, and confirm each is
  applied once, with its own sequence.
- **Leak tests** catch up, as a traveller hidden from part of a trip, from every sequence the trip
  has held, and confirm nothing given names a page, a stretch, a grant or a booking that traveller
  may not see (`PLN:HOST-NFR1`). They do the same as an admin, and confirm nothing given names
  another traveller's checklist.
- **Cost tests** count the requests, the rows read and written, and the storage of the day of
  `PLN:HOST-NFR2`, and confirm they are within the free plan's limits. They run thirty minutes of
  the day, and multiply each count by eight for its four hours. They also measure the processor time
  of each kind of request on a trip of 500 pages and 300 bookings, the first after the Durable
  Object wakes included, and fail where one takes over 10 milliseconds. That is the trip host's own
  budget. The free plan holds a Worker to 10 milliseconds of processor time, and a Durable Object
  to none: Milestone Web-0.2's trial ran a Durable Object request of 374 milliseconds on the free
  plan, and loaded the rules file in 6 to 23 milliseconds. The budget keeps every request far
  inside what the free plan allows. Loading the rules file is not counted, since it happens at most
  once each time the Durable Object wakes, before its first request. The cost tests run the trip host's
  logic on Node.js, with Node's SQLite, with `node --test` after the rest of the suite. The Workers
  runtime keeps its clock still while code runs, so no test inside it can time code. Continuous
  integration runs on shared machines several times slower than a developer's or Cloudflare's, so
  there the cost tests report each time and do not fail on it. The budget is held on a developer's
  machine.

### 4.8 Checklists

*Porcelain:* the trip host holds each traveller's checklists on the trip, and checks every request
about one itself, without asking `access/permissions` (`PLN:HOST-F10`). A checklist is its
traveller's alone, so the only check is whose it is (ADR-0024, a traveller's checklists are their
own):

- **Who may.** Any traveller the grants hold may add, change and delete their own checklists,
  whatever their access to the trip. Being an admin changes nothing.
- **Which checklist.** A request names a checklist among the traveller's own, by the pair of their
  account and its identifier. One the traveller does not hold is refused with `unknown-checklist`,
  the same way whether another traveller holds that identifier or nobody does.

`addChecklist(who, id, start)` reads the identifier and `order` of every checklist the traveller
holds on the trip. It refuses with `checklists-full` a traveller who holds 50, and with
`duplicate-checklist` an identifier they already hold. It then makes the checklist with
`planner/checklists`, on the trip, given those checklists as its list, so the new one sorts last:

- **With a title**, with `newChecklist`, owned by the traveller's account.
- **With `from`**, with `copyChecklist`, once `checklistFromText` has read `from`. A `from` whose
  `owner` is not the traveller's account is refused with `not-yours`. `from` may be a template, or a
  checklist on any trip.

A device starts a checklist from a template by sending the template as `from`, from its own copy
of the traveller's library. The trip host never asks `planner/library` for it. The template is the
traveller's own, so a device that sends altered text alters only its own traveller's checklist.

`deleteChecklist(who, id)` deletes the traveller's checklist for good. A change to a checklist is a
`checklists` change, applied as §4.3 gives. A move among the traveller's checklists is a `place`
change, which the device works out with `placeAfter` from its own copy of the trip. Each of the
three raises the `sequence`, and tells every open socket of it (§4.5). A device whose traveller's
checklists did not change is given nothing by its catch-up, so the message tells it nothing.

A removed traveller's checklists stay in the `checklists` table. While the grants do not hold the
traveller, every request of theirs is refused with `not-a-member`, so nothing reaches the
checklists. A traveller who rejoins has the same account, and so owns the same rows. Their device
holds no copy of the trip, so its first catch-up has no `since`, and is given each checklist whole.

## 5. Resources

| Resource | Path | Owned by |
|---|---|---|
| The Worker of the online side | `services/online/` | Whoever keeps the planner's roadmap |
| The Durable Object class | `TripHost`, in `services/online/src/trip-host.ts`, bound to the Worker as `TRIPS` | Whoever keeps the planner's roadmap |
| The trip host's logic | `services/online/src/trip-core.ts` | Whoever keeps the planner's roadmap |
| The requests of §3.2 | `services/online/src/trip-routes.ts` | Whoever keeps the planner's roadmap |
| Each trip's database | The SQLite database of the trip's Durable Object, with the tables of §4.1 | Whoever keeps the planner's roadmap |
| The time-zone rules file | One of the Worker's files, from `shared/trip-time` | Whoever keeps the planner's roadmap |
| The Wrangler configuration | `services/online/wrangler.toml` | Whoever keeps the planner's roadmap |
| The recipe | `test-online`, in the `justfile` at the repository root | Whoever keeps the planner's roadmap |

The Worker's runtime dependencies are `@itinero/itinerary`, `@itinero/pages`,
`@itinero/permissions`, `@itinero/bookings`, `@itinero/checklists` and `@itinero/trip-time`. Nothing deletes a trip's
database, since a trip cannot be deleted yet (`ACC-NR4`).

## 6. Quality attributes

- **One change at a time** (`PLN:HOST-F2`). A Durable Object handles one request at a time, and
  stores each change in one transaction.
- **Nothing leaks** (`PLN:HOST-NFR1`). Every read goes through `seen`, `bookingLevel` or
  `authorise`, and only an admin is given another traveller's grant. Every read of a checklist
  names the account asking as its owner, so no traveller, an admin included, is given another's
  (§4.8). Every refusal for a trip the
  account is not on is the same, and a socket carries only a sequence.
- **Grants and members agree, or nobody gets in.** A grant with no member is never reached, and a
  member with no grant is refused with `not-a-member`. `grant` is safe to repeat, so either is put
  right by sending the same change again (§4.3).
- **Fails closed** (`ACC-NFR1`). A request with no account, no member or no access reaches no data.
- **Costs nothing at this scale** (`PLN:HOST-NFR2`). A change is one request to the Durable Object,
  and each open device's catch-up is one more. Ten devices making a change a minute for four hours
  make about 3,000 requests, against a free allowance of 100,000 a day. Hibernating sockets cost
  nothing while idle. A catch-up of a trip of 500 pages and 300 bookings reads 800 rows, and the
  text only of the pages changed since the device's last catch-up. The day reads about 2.4 million
  rows, against a free allowance of 5 million.
- **One set of rules.** The time-zone rules the Worker carries are the ones every change is checked
  against. A device with other rules is corrected by the next catch-up.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [PLN:HOST-F1](../../requirements/planner/trip-host.md#^pln-host-f1) | `POST /api/trips` and `create`, in §4.2. |
| [PLN:HOST-F2](../../requirements/planner/trip-host.md#^pln-host-f2) | The checks and the transaction of §4.3, and one request at a time (§4). |
| [PLN:HOST-F3](../../requirements/planner/trip-host.md#^pln-host-f3) | The pages' `stale` refusal, returned unchanged (§4.3). |
| [PLN:HOST-F4](../../requirements/planner/trip-host.md#^pln-host-f4) | `agreed`, `widens` and the `agree-first` refusal, in §4.3. |
| [PLN:HOST-F5](../../requirements/planner/trip-host.md#^pln-host-f5) | `sync` and `pages`, in §4.4. |
| [PLN:HOST-F6](../../requirements/planner/trip-host.md#^pln-host-f6) | The sockets of §4.5, and `touch`, in §4.3, for a member made an admin. |
| [PLN:HOST-F7](../../requirements/planner/trip-host.md#^pln-host-f7) | `grant`, safe to repeat, in §4.3, and `not-a-member` on catching up, in §4.4. |
| [PLN:HOST-F8](../../requirements/planner/trip-host.md#^pln-host-f8) | `buried`, and the `restore` change, in §4.6. |
| [ACC-F10](../../requirements/access/access.md#^acc-f10) | `seenBy`, recorded at each delete, and the `graveyard` of the catch-up (§4.4, §4.6). Refusing to open or restore a page to a traveller who is not an admin is `access/permissions`. |
| [PLN:HOST-F10](../../requirements/planner/trip-host.md#^pln-host-f10) | The `checklists` table of §4.1, `addChecklist` and `deleteChecklist`, the checks of §4.8, a `remove` that keeps a traveller's checklists (§4.3), and `checklists` in the catch-up of §4.4. |
| [ACC-F14](../../requirements/access/access.md#^acc-f14) | Each checklist given only to its owner, whatever the grants hold, and the checks of §4.8 made without `access/permissions`. A traveller's templates are `planner/library`. |
| [PLN-F18](../../requirements/planner/planner.md#^pln-f18) | Each traveller's checklists on a trip, given to their devices alone, and kept while they are away from the trip (§4.8). The checklists themselves are `planner/checklists`. |
| [PLN:HOST-F9](../../requirements/planner/trip-host.md#^pln-host-f9) | The `bookings` table of §4.1, the checks of a booking change in §4.3, and `bookings` in the catch-up of §4.4. |
| [PLN:HOST-NFR1](../../requirements/planner/trip-host.md#^pln-host-nfr1) | `seen` for every read, `you` holding only the traveller's own grant, `grants` given to an admin alone, and sockets carrying only a sequence (§4.4, §4.5). |
| [PLN:HOST-NFR2](../../requirements/planner/trip-host.md#^pln-host-nfr2) | One request for each change and each catch-up, and hibernating sockets (§6). |
| [PLN-F6](../../requirements/planner/planner.md#^pln-f6) | The one copy every change is applied to, and the sockets that tell open devices of each change (§4.3, §4.5). Showing the change is `web/screens`. |
| [PLN-F10](../../requirements/planner/planner.md#^pln-f10) | A page for each country chosen, at creation (§4.2). |
| [PLN-F14](../../requirements/planner/planner.md#^pln-f14) | Letting only the creator set the trip's dates, and each traveller their own (§4.3). |
| [PLN-F16](../../requirements/planner/planner.md#^pln-f16) | The `stale` refusal, with the text as it stands, returned to the device (§4.3). |
| [ACC-F9](../../requirements/access/access.md#^acc-f9) | The `agree-first` refusal, with the count (§4.3). |
| [ACC-F11](../../requirements/access/access.md#^acc-f11) | `grant` applying each removal, and a device deleting its copy on `not-a-member` (§4.3, §4.4). |
| [ACC-F12](../../requirements/access/access.md#^acc-f12) | Catching each device up on what `seen` gives (§4.4). |
| [ACC-NFR1](../../requirements/access/access.md#^acc-nfr1) | Asking `authorise` before every change and every read (§4), and naming the traveller asking as the owner of every checklist read or changed (§4.8). |
| [ACC-F6](../../requirements/access/access.md#^acc-f6) | Giving each device only the bookings whose `bookingLevel` is view or edit, and checking each change to a booking against its travellers before and after (§4.3, §4.4). |
| [BKG-F1](../../requirements/bookings/bookings.md#^bkg-f1) | Applying an added booking once `authorise` allows it, and the `unknown-traveller` refusal (§4.3). The booking's checks are `bookings/list`. |
| [BKG-F5](../../requirements/bookings/bookings.md#^bkg-f5) | Checking a change or a removal against the travellers the booking names before and after it (§4.3). The `stale` refusal is `bookings/list`. |
| [BKG-F6](../../requirements/bookings/bookings.md#^bkg-f6) | Giving each device every booking its traveller may see, whole, in the catch-up of §4.4. Keeping them on the phone is `web/trip-store`. |

## 8. Open

- **Merging edits.** Two travellers' edits to one page are refused, not merged. Merging them
  automatically is future work, and would change how a page's text is stored and sent.
- **A trip left without a member.** A trip whose `createTrip` failed keeps its Durable Object, which
  no request reaches. Clearing such objects is not designed.
