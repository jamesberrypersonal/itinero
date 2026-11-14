# The trip host

**Assumes** [trip-host.md](../../requirements/planner/trip-host.md) — what the trip host promises, and the calendar, pages, grants and sequence it holds.

## 1. Purpose

The trip host is the part of Itinero's online side that holds the one copy of each trip, which every
change is applied to. Each trip lives in a Cloudflare Durable Object of its own. The trip host
creates trips, checks and applies every change, catches each device up on what it may see, and
tells each open device when a trip changes.

## 2. Scope

The trip host covers a trip's calendar, pages, grants of access and bookings as stored online, the
changes to them, catching a device up, telling open devices of changes, and reading and restoring pages in the
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
- the rules of a booking, which `bookings/list`, the component that holds a trip's bookings, holds
  with the components of each kind of booking
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
through `access/accounts`. A refusal gives a status of 400, 403, 404 or 409, and a JSON body
`{ "code": ..., "message": ..., "details": ... }`. The `message` is one English sentence the web app
may show.

| Request | Body | Gives |
|---|---|---|
| `POST /trips` | `{ "name": ..., "first": ..., "last": ..., "countries": [ ... ] }` | `{ "trip": ... }`, the new trip's identifier (§4.2) |
| `GET /trips` | None | Each trip the account is on, with its name and dates (§4.2) |
| `POST /trips/{trip}/changes` | `{ "target": "calendar" \| "pages" \| "grants" \| "bookings", "change": ..., "agreed": ... }` | `{ "sequence": ... }` (§4.3) |
| `POST /trips/{trip}/sync` | `{ "since": ..., "holdsCalendar": ... }` | What the device may hold that changed since (§4.4) |
| `POST /trips/{trip}/pages` | `{ "pages": [ ... ] }` | The pages named that the traveller may see (§4.4) |
| `POST /trips/{trip}/bookings` | `{ "bookings": [ ... ] }` | The bookings named that the traveller may see (§4.4) |
| `GET /trips/{trip}/buried/{page}` | None | A page in the graveyard, to an admin (§4.6) |
| `GET /trips/{trip}/live` | None | A WebSocket that is told of each change (§4.5) |

A `change` is written in the text form of its package: the itinerary's for `calendar`, the pages'
for `pages`, the permissions' for `grants`, and the bookings' for `bookings`. `countries` is a list of country codes, from the
itinerary's list of countries. `agreed`, where present, is the number of travellers the traveller
agreed would come to see a moved page.

| Refusal code | Status | When |
|---|---|---|
| `not-a-member` | 404 | A request about a trip the account is not on, whether or not the trip exists |
| `creator-only` | 403 | A `rename` or a `trip-dates` change by a traveller who is not the trip's creator |
| `own-dates-only` | 403 | A `traveller-dates` change for another traveller, by a traveller who is not an admin |
| `membership-only` | 403 | An `add` or a `remove` grant sent by a device. Only `access/membership` sends them |
| `unknown-traveller` | 409 | A booking naming a traveller who is not on the trip. `details.traveller` names them |
| `agree-first` | 409 | A move that would let more travellers see a page than `agreed` says. `details.count` gives how many |
| `malformed` | 400 | A body not in the forms above |

Every refusal from `access/permissions`, `planner/itinerary`, `planner/pages` and `bookings/list` is
returned with its own code and details unchanged, such as `no-edit`, `stale` or `cycle`. A refusal for missing
access has status 403, and any other has status 409.

### 3.3 Programming interface

Inside the online side, the trip's Durable Object gives these methods, which Cloudflare calls
across from the Worker. Nothing outside the online side can reach them.

```ts
import type { GrantChange, Who } from "@itinero/permissions";

type Member = Who & { creator: boolean };        // the caller gives it, from access/membership

class TripHost {
  create(trip: string, creator: Member, name: string, first: string, last: string,
         countries: readonly string[]): Promise<Result<true>>;
  change(who: Member, target: "calendar" | "pages" | "grants" | "bookings", change: string,
         agreed?: number): Promise<Result<{ sequence: number }>>;
  sync(who: Member, since: number | undefined, holdsCalendar: boolean): Promise<Result<Sync>>;
  pages(who: Member, ids: readonly string[]): Promise<Result<readonly string[]>>;
  bookings(who: Member, ids: readonly string[]): Promise<Result<readonly string[]>>;
  buried(who: Member, page: string): Promise<Result<string>>;
  grant(change: GrantChange): Promise<Result<{ sequence: number }>>;   // from access/membership
  summary(): Promise<{ name: string; first: string; last: string }>;
}
```

`grant` is the listener `access/membership` names with its `onChange`, and is the only way an `add`
or a `remove` reaches a trip's grants. `Sync` is the body of §4.4.

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
  refused with `not-a-member`, before the Durable Object is reached.
- **Every change and every read is asked of `access/permissions` first**, with the trip's grants,
  pages and member, by its `authorise` (ACC-NFR1). A refusal is returned unchanged, and nothing is
  read or written.
- **One request at a time.** A Durable Object handles one request at a time. Each change is
  checked, applied and stored in one transaction of its database, so no change sees another half
  done.
- **The sequence.** The trip's `sequence` starts at 1. Every change applied raises it by one, and
  marks each record it writes with the new sequence, as that record's `changed`.

### 4.1 What the Durable Object stores

*Plumbing:* each trip's Durable Object holds five tables:

| Table | Holds |
|---|---|
| `trip` | One row: the trip, in the itinerary's text form, its `changed`, and the trip's `sequence` |
| `pages` | One row for each page, in the pages' text form, with its `changed` |
| `grants` | One row: the trip's grants, in the permissions' text form |
| `bookings` | One row for each booking, keyed by its identifier, in the bookings' text form, with its `changed` |
| `creator` | One row: the creator's account |

The itinerary needs the world's time-zone rules, which `shared/trip-time` loads from a rules file.
The Worker carries the rules file as one of its files, and the Durable Object loads it as it starts.
Its result is the one that stands when a device holds other rules (`PLN:ITINERARY-F6`).

### 4.2 Creating a trip

*Porcelain:* `POST /trips` makes the trip's identifier with `crypto.randomUUID()`, and calls
`create` on the new trip's Durable Object (`PLN:HOST-F1`). `create`:

1. makes the trip with the itinerary's `newTrip`, and sets its dates with a `trip-dates` change,
   returning any refusal unchanged
2. makes its pages with the pages' `newPages`, with a page for each country, titled with the name
   the itinerary's `countries()` gives it
3. makes its grants with `newGrants`, and adds the creator with edit access to the trip and to the
   calendar
4. stores all three, with a `sequence` of 1

The Worker then calls `access/membership`'s `createTrip`, which makes the traveller the trip's
creator and admin. A trip whose `createTrip` fails has no member, so no request reaches it.

`GET /trips` takes the trips `access/membership`'s `trips` gives for the account, and gives each
one's name and dates, from its `summary`.

### 4.3 Applying a change

*Porcelain:* `change` reads the change from its text, and checks it in this order (`PLN:HOST-F2`):

1. **Who may make it.** For `calendar`, a `rename` or a `trip-dates` change needs the trip's
   creator, or is refused with `creator-only`. A `traveller-dates` change for another traveller
   needs an admin, or is refused with `own-dates-only`. Any other change needs edit access to the
   calendar. For `pages`, the change is asked of `authorise` as a `change-page`. For `grants`, an
   `add` or a `remove` is refused with `membership-only`, and any other change is asked as a
   `grant`. For `bookings`, the trip host reads the booking held with the change's identifier, and
   takes the bookings' `touches`. It asks `authorise` for a `change-booking` naming `before`, where
   `before` names anyone, and for one naming `after`, where `after` names anyone. Each traveller of
   `after` must be held in the grants, or the change is refused with `unknown-traveller`
   (`PLN:HOST-F9`).
2. **A move that widens who may see a page** (`PLN:HOST-F4`). For a `move`, the trip host asks
   `access/permissions`'s `widens`. Where it gives more than 0, and more than `agreed`, the change
   is refused with `agree-first`, with the count in `details.count`.
3. **The change itself.** The change is applied with its package's `apply`: the itinerary's, the
   pages', `applyGrant`, or the bookings', given the booking held. Any refusal is returned unchanged, such as the pages' `stale`, which
   holds the page's text as it stands (`PLN:HOST-F3`).

Where every check passes, the trip host raises the `sequence`, and stores each record the change
wrote: the trip, the one page `apply` wrote, the grants, or the one booking `apply` gave. A removed
booking's row is deleted. It does both in one transaction. It
then tells every open socket of the new sequence (§4.5), and gives `{ "sequence": ... }`.

`grant`, from `access/membership`, applies an `add` or a `remove` in the same way, with no check of
who sent it (`PLN:HOST-F7`). After a `remove`, the trip host closes every socket of that traveller,
with the close code 4403.

### 4.4 Catching a device up

*Porcelain:* `sync(who, since, holdsCalendar)` gives the device this body (`PLN:HOST-F5`):

| Field | Holds |
|---|---|
| `sequence` | The trip's sequence now. The device keeps it, and gives it as `since` next time |
| `trip` | The trip's name, its dates and the traveller's own dates, which every traveller may see |
| `you` | Whether the traveller is an admin and the creator, and the traveller's own grant |
| `calendar` | The stretches and firm items, where the traveller's level for the calendar is view or edit, and the trip changed after `since`, or `holdsCalendar` is false. `null` where their level is none, and absent where nothing changed |
| `pages` | For each page of `seen`, from `access/permissions`, its identifier and its `changed`. A page whose `changed` is after `since` also holds its text form |
| `graveyard` | The identifiers and titles of the pages in the graveyard the traveller may see |
| `bookings` | For each booking whose `bookingLevel` for the traveller is view or edit, its identifier and its `changed`. A booking whose `changed` is after `since` also holds its text form |

A `since` that is absent counts as 0, so every page holds its text form. The device then:

- drops each page it holds that `pages` does not list, since the traveller may no longer see it
- fetches, with `POST /trips/{trip}/pages`, each page `pages` lists without its text that the
  device does not hold. Such a page has become visible through a change of access, not a change
  to the page
- drops the calendar where `calendar` is `null`
- drops each booking it holds that `bookings` does not list, since it was removed, or the traveller
  may no longer see it (`PLN:HOST-F9`)
- fetches, with `POST /trips/{trip}/bookings`, each booking `bookings` lists without its text that
  the device does not hold, such as every booking of a trip once its traveller is made an admin

`pages(who, ids)` gives the text form of each page named that `seen` holds, and leaves out any
other, without saying why. `bookings(who, ids)` does the same for each booking named whose
`bookingLevel` for the traveller is view or edit. `you` holds only the traveller's own grant, so that no traveller learns
another's access (`PLN:HOST-NFR1`).

A device whose `sync` is refused with `not-a-member` deletes its copy of the trip (`PLN:HOST-F7`).

### 4.5 Telling open devices of changes

*Porcelain:* `GET /trips/{trip}/live` opens a WebSocket to the trip's Durable Object, which accepts
it for hibernation, tagged with the traveller's account (`PLN:HOST-F6`). After every change, the
Durable Object sends each open socket one message, `{ "sequence": ... }`. A device that receives a
sequence newer than its own catches up with `sync`.

The message names no part of the trip, so a socket tells a traveller nothing they may not see. A
device whose socket closes reopens it after 1 second, then after twice as long each time, up to
1 minute, and catches up each time it reopens.

### 4.6 The graveyard

*Porcelain:* `buried(who, page)` asks `authorise` for a `read-buried` request, and gives the page's
text form to an admin (`PLN:HOST-F8`). A restore is a `restore` change to `pages`, which
`authorise` allows only to an admin.

### 4.7 The test suite

The suite runs with `npm test` in `services/online/`, inside Wrangler, Cloudflare's tool that runs
the Worker, its Durable Objects and D1 on the developer's machine. The recipe `just test-online`
runs it from anywhere in the repository.

- **Unit tests** cover each refusal of §3.2, and every check in the verification of each
  requirement the trip host claims.
- **Order tests** send changes to one trip from several connections at once, and confirm each is
  applied once, with its own sequence.
- **Leak tests** catch up, as a traveller hidden from part of a trip, from every sequence the trip
  has held, and confirm nothing given names a page, a stretch, a grant or a booking that traveller
  may not see (`PLN:HOST-NFR1`).
- **Cost tests** count the requests and the storage of the day of `PLN:HOST-NFR2`, and confirm
  they are within the free plan's limits.

## 5. Resources

| Resource | Path | Owned by |
|---|---|---|
| The Worker of the online side | `services/online/` | Whoever keeps the planner's roadmap |
| The Durable Object class | `TripHost`, in `services/online/src/trip-host.ts`, bound to the Worker as `TRIPS` | Whoever keeps the planner's roadmap |
| Each trip's database | The SQLite database of the trip's Durable Object, with the tables of §4.1 | Whoever keeps the planner's roadmap |
| The time-zone rules file | One of the Worker's files, from `shared/trip-time` | Whoever keeps the planner's roadmap |
| The Wrangler configuration | `services/online/wrangler.toml` | Whoever keeps the planner's roadmap |
| The recipe | `test-online`, in the `justfile` at the repository root | Whoever keeps the planner's roadmap |

The Worker's runtime dependencies are `@itinero/itinerary`, `@itinero/pages`,
`@itinero/permissions`, `@itinero/bookings` and `@itinero/trip-time`. A trip's database is deleted with nothing, since a
trip cannot be deleted yet (`ACC-NR4`).

## 6. Quality attributes

- **One change at a time** (`PLN:HOST-F2`). A Durable Object handles one request at a time, and
  stores each change in one transaction.
- **Nothing leaks** (`PLN:HOST-NFR1`). Every read goes through `seen`, `bookingLevel` or `authorise`, every refusal
  for a trip the account is not on is the same, and a socket carries only a sequence.
- **Fails closed** (`ACC-NFR1`). A request with no account, no member or no access reaches no data.
- **Costs nothing at this scale** (`PLN:HOST-NFR2`). A change is one request to the Durable Object,
  and each open device's catch-up is one more. Ten devices making a change a minute for four hours
  make about 3,000 requests, against a free allowance of 100,000 a day. Hibernating sockets cost
  nothing while idle.
- **One set of rules.** The time-zone rules the Worker carries are the ones every change is checked
  against. A device with other rules is corrected by the next catch-up.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [PLN:HOST-F1](../../requirements/planner/trip-host.md#^pln-host-f1) | `POST /trips` and `create`, in §4.2. |
| [PLN:HOST-F2](../../requirements/planner/trip-host.md#^pln-host-f2) | The checks and the transaction of §4.3, and one request at a time (§4). |
| [PLN:HOST-F3](../../requirements/planner/trip-host.md#^pln-host-f3) | The pages' `stale` refusal, returned unchanged (§4.3). |
| [PLN:HOST-F4](../../requirements/planner/trip-host.md#^pln-host-f4) | `agreed`, `widens` and the `agree-first` refusal, in §4.3. |
| [PLN:HOST-F5](../../requirements/planner/trip-host.md#^pln-host-f5) | `sync` and `pages`, in §4.4. |
| [PLN:HOST-F6](../../requirements/planner/trip-host.md#^pln-host-f6) | The sockets of §4.5. |
| [PLN:HOST-F7](../../requirements/planner/trip-host.md#^pln-host-f7) | `grant`, in §4.3, and `not-a-member` on catching up, in §4.4. |
| [PLN:HOST-F8](../../requirements/planner/trip-host.md#^pln-host-f8) | `buried`, and the `restore` change, in §4.6. |
| [PLN:HOST-F9](../../requirements/planner/trip-host.md#^pln-host-f9) | The `bookings` table of §4.1, the checks of a booking change in §4.3, and `bookings` in the catch-up of §4.4. |
| [PLN:HOST-NFR1](../../requirements/planner/trip-host.md#^pln-host-nfr1) | `seen` for every read, `you` holding only the traveller's own grant, and sockets carrying only a sequence (§4.4, §4.5). |
| [PLN:HOST-NFR2](../../requirements/planner/trip-host.md#^pln-host-nfr2) | One request for each change and each catch-up, and hibernating sockets (§6). |
| [PLN-F6](../../requirements/planner/planner.md#^pln-f6) | The one copy every change is applied to, and the sockets that tell open devices of each change (§4.3, §4.5). Showing the change is `web/screens`. |
| [PLN-F10](../../requirements/planner/planner.md#^pln-f10) | A page for each country chosen, at creation (§4.2). |
| [PLN-F14](../../requirements/planner/planner.md#^pln-f14) | Letting only the creator set the trip's dates, and each traveller their own (§4.3). |
| [PLN-F16](../../requirements/planner/planner.md#^pln-f16) | The `stale` refusal, with the text as it stands, returned to the device (§4.3). |
| [ACC-F9](../../requirements/access/access.md#^acc-f9) | The `agree-first` refusal, with the count (§4.3). |
| [ACC-F11](../../requirements/access/access.md#^acc-f11) | `grant` applying each removal, and a device deleting its copy on `not-a-member` (§4.3, §4.4). |
| [ACC-F12](../../requirements/access/access.md#^acc-f12) | Catching each device up on what `seen` gives (§4.4). |
| [ACC-NFR1](../../requirements/access/access.md#^acc-nfr1) | Asking `authorise` before every change and every read (§4). |
| [ACC-F6](../../requirements/access/access.md#^acc-f6) | Giving each device only the bookings whose `bookingLevel` is view or edit, and checking each change to a booking against its travellers before and after (§4.3, §4.4). |
| [BKG-F1](../../requirements/bookings/bookings.md#^bkg-f1) | Applying an added booking once `authorise` allows it, and the `unknown-traveller` refusal (§4.3). The booking's checks are `bookings/list`. |
| [BKG-F5](../../requirements/bookings/bookings.md#^bkg-f5) | Checking a change or a removal against the travellers the booking names before and after it (§4.3). The `stale` refusal is `bookings/list`. |
| [BKG-F6](../../requirements/bookings/bookings.md#^bkg-f6) | Giving each device every booking its traveller may see, whole, in the catch-up of §4.4. Keeping them on the phone is `web/trip-store`. |

## 8. Open

- **Merging edits.** Two travellers' edits to one page are refused, not merged. Merging them
  automatically is future work, and would change how a page's text is stored and sent.
- **A trip left without a member.** A trip whose `createTrip` failed keeps its Durable Object, which
  no request reaches. Clearing such objects is not designed.
