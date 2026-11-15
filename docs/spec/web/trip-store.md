# The trip store

**Assumes** [trip-store.md](../../requirements/web/trip-store.md) — what the trip store promises, and what a trip's copy holds.

## 1. Purpose

The trip store is the part of the web app that keeps each trip's copy on a device. It catches each
copy up with `planner/trip-host`, the component that holds each trip online, listens for changes
while a trip is open, sends each change a traveller makes, and deletes every copy on sign-out. It
also carries every other request a traveller makes about a trip, such as creating one or inviting a
traveller. It
gives `web/screens` each trip as values of the planner's, the access system's and the bookings
system's packages, ready to show.

## 2. Scope

The trip store covers the device's copy of each trip, catching it up, the live connection to an
open trip, sending changes, whether the device is online, signing out, and sharing the copy between
windows. It also covers creating a trip, the requests about a trip's members and invitations, and
reading a page in the graveyard.

Two things act on it:

- **`web/screens`** reads trips, watches the one open, sends changes, makes the requests of §4.8
  and signs out (§3.3).
- **`planner/trip-host`**, **`access/accounts`** and **`access/membership`**, on the online side,
  answer its requests (§3.4).

Deliberately absent:

- deciding what a copy may hold, which `planner/trip-host` decides, with `access/permissions`
- keeping a change made with no connection (ADR-0004, a trip can be read without a connection, but
  changed only with one)
- protecting a copy beyond the device's own lock (ADR-0017, a trip's copy on a device is protected
  by the device's own lock, and deleted when its traveller signs out)
- the time-zone rules, which `web/shell` holds

The trip store is part of the package `@itinero/web`, in `apps/web/src/store/`, built with the rest
of the web app (ADR-0018, the web app is built with Preact, and served by Itinero's own Worker).

## 3. Interface

### 3.1 User interface

None. `web/screens` shows what the trip store gives.

### 3.2 Application interface

None. The trip store answers no requests. It sends the requests of §3.4.

### 3.3 Programming interface

```ts
import type { Trip, Dates } from "@itinero/itinerary";
import type { Page, Pages } from "@itinero/pages";
import type { Booking } from "@itinero/bookings";
import type { Grant, Grants, Level, TripLevel } from "@itinero/permissions";
import type { Result } from "@itinero/trip-time";

type Member = { account: string; name: string; admin: boolean; creator: boolean; joined: string;
                removed?: string };                   // present: a former member, removed then
type Invitation = { id: string; email: string; trip: TripLevel; calendar: Level;
                    expires: string };                    // expires: an ISO 8601 UTC time

type Copy = {
  id: string; name: string; dates: Dates; mine: Dates;   // mine: the traveller's own dates
  you: { admin: boolean; creator: boolean; grant: Grant };
  calendar?: Trip;                                        // absent: not granted
  pages: Pages; graveyard: readonly { id: string; title: string;
                                       went: number }[];   // went: the pages deleted with it
  bookings: readonly Booking[]; members: readonly Member[];
  grants?: Grants;                                        // an admin's copy alone: everyone's access
  invitations?: readonly Invitation[];                    // an admin's copy alone: those still open
  sequence: number; caughtUp: number;                     // caughtUp: milliseconds since 1970 UTC
};
type Summary = { id: string; name: string; dates: Dates; caughtUp: number };
type Target = "calendar" | "pages" | "grants" | "bookings";

function open(): Promise<{ account?: string }>;   // undefined: signed out
function trips(): Promise<readonly Summary[]>;
function trip(id: string): Promise<Copy | undefined>;
function watch(id: string, listener: (copy: Copy | undefined) => void): () => void;
function onTrips(listener: (trips: readonly Summary[]) => void): () => void;
function send(id: string, target: Target, change: string,
              agreed?: number): Promise<Result<{ sequence: number }>>;
function isOnline(): boolean;
function onOnline(listener: (online: boolean) => void): () => void;
function signedIn(account: string): Promise<void>;
function signOut(): Promise<void>;

function create(name: string, dates: Dates,
                countries: readonly string[]): Promise<Result<{ trip: string }>>;
function accept(invitation: string, token: string): Promise<Result<{ trip: string }>>;
function invite(id: string, email: string, trip: TripLevel,
                calendar: Level): Promise<Result<Invitation>>;
function withdraw(id: string, invitation: string): Promise<Result<true>>;
function makeAdmin(id: string, account: string): Promise<Result<true>>;
function remove(id: string, account: string): Promise<Result<true>>;
function buried(id: string, page: string): Promise<Result<Page>>;
```

`change` is in the text form of its target's package, as `planner/trip-host` takes it. `send`
returns every refusal from the online side unchanged, and refuses with its own code `offline`,
whose message says the device has no connection, where it sends nothing. The seven functions from
`create` to `buried` refuse in the same ways. Once the online side has refused this version of the
web app, each of them, `send` included, refuses with `update-first` (§4).

### 3.4 Systems this drives

The trip store sends these requests to the online side, with the session cookie the browser sends
on its own:

| Request | Answered by | Used for |
|---|---|---|
| `GET /api/trips` | `planner/trip-host` | The trips the traveller is on (§4.2) |
| `POST /api/trips/{trip}/sync` | `planner/trip-host` | Catching a trip up (§4.2) |
| `POST /api/trips/{trip}/pages`, `POST /api/trips/{trip}/bookings` | `planner/trip-host` | Pages and bookings the traveller may now see (§4.2) |
| `GET /api/trips/{trip}/members` | `access/membership` | The trip's members (§4.2) |
| `GET /api/trips/{trip}/live` | `planner/trip-host` | The WebSocket told of each change (§4.3) |
| `POST /api/trips/{trip}/changes` | `planner/trip-host` | Sending a change (§4.4) |
| `POST /api/auth/sign-out` | `access/accounts` | Ending the session (§4.5) |
| `POST /api/trips` | `planner/trip-host` | Creating a trip (§4.8) |
| `GET /api/trips/{trip}/buried/{page}` | `planner/trip-host` | Reading a page in the graveyard (§4.8) |
| `POST /api/invitations/{invitation}/accept` | `access/membership` | Accepting an invitation (§4.8) |
| `POST /api/trips/{trip}/invitations`, `DELETE /api/trips/{trip}/invitations/{invitation}` | `access/membership` | Inviting a traveller, and withdrawing an invitation (§4.8) |
| `POST /api/trips/{trip}/admins`, `DELETE /api/trips/{trip}/members/{account}` | `access/membership` | Making a member an admin, and removing one (§4.8) |

`spec/planner/trip-host.md`, `spec/access/membership.md` and `spec/access/accounts.md` give each
request's body and refusals.

It stores the copy in IndexedDB, the browser's database for a site's own data, which other sites
cannot read. An IndexedDB database holds object stores, each a set of records under keys, and every
read and write is made in a transaction that is applied whole or not at all. It tells other windows
of changes with a BroadcastChannel, which carries messages between the windows of one site on one
device. The MDN Web Docs give the detail of both.

## 4. Behaviour

Behaviour crossing every operation:

- **The copy is the trip store's alone.** Nothing else in the web app writes to its database.
- **Each catch-up is one transaction.** A catch-up is written in one IndexedDB transaction, after
  every request it needs has answered, so a copy is brought up to date whole or not at all
  (`WEB:STORE-F2`).
- **A version too old stops everything but reading.** Every request carries, in the header
  `Itinero-Api`, the shell's `API`: the number of the form of request this version sends
  (`spec/web/shell.md` §4.7). Any request refused with `update-first` writes nothing. The trip store
  then calls the shell's `updateFirst`, which has the shell fetch the new version (`WEB:SHELL-F5`).
  It then sends no request until the window reloads, and refuses with `update-first` every `send`,
  and every function from `create` to `buried`. Every copy stays as it is, and is still read.
- **A session that has ended deletes everything.** Any request refused with `no-session` signs the
  device out, as §4.5 gives, before anything else is done (`WEB:STORE-F5`).

### 4.1 What the device stores

*Plumbing:* the trip store keeps one IndexedDB database, `itinero`, at version 1, with four object
stores:

| Object store | Key | Holds |
|---|---|---|
| `account` | `"me"` | The account signed in, and `signOutOwed` where the session is still to be ended (§4.5) |
| `trips` | The trip's identifier | The trip's name, its dates, the traveller's own, `you`, the calendar in the itinerary's text form or `null`, the graveyard's titles, the members, `sequence` and `caughtUp`. For an admin, also the trip's grants in the permissions' text form, and the open invitations |
| `pages` | The trip's identifier and the page's | The page in the pages' text form, and its `changed` |
| `bookings` | The trip's identifier and the booking's | The booking in the bookings' text form, and its `changed` |

`trip(id)` reads a trip's records in one transaction, and builds its `Copy` with each package's
`FromText` function. A record a package refuses to read is left out of the `Copy`, and the trip is
caught up from the start the next time the device is online.

### 4.2 Catching up

*Porcelain:* the trip store catches every trip up (`WEB:STORE-F2`):

- when it opens and the device is online
- each time the browser fires its `online` event, and each time a window of Itinero comes to the
  front
- every 60 seconds while the device is offline, which it learns by trying

It first asks `GET /api/trips`. It deletes each trip it holds that the answer does not list, and
adds each that it lists and the device does not hold. It then catches each trip up in turn, and
tells `web/shell` the device is online.

To catch one trip up, the trip store:

1. sends `POST /api/trips/{trip}/sync`, with `since` set to the trip's `sequence`, or absent for a
   trip not yet held, and `holdsCalendar` set to whether it holds the calendar
2. sends `POST /api/trips/{trip}/pages` for every page the answer lists without its text that the
   device does not hold, and `POST /api/trips/{trip}/bookings` for every such booking, in groups of
   100
3. sends `GET /api/trips/{trip}/members`, which gives an admin the open invitations too
4. in one transaction, writes the trip's record, with the grants and the invitations where the
   answers hold them, writes every page and booking it was given, deletes every page and booking
   the answer did not list, and sets `sequence` and `caughtUp`

`caughtUp` is the device's clock when the transaction is written. A catch-up refused with
`not-a-member` deletes the trip. A catch-up that fails part way, such as on a lost connection,
writes nothing, and the trip keeps its old `sequence`, so the next catch-up asks again from there.

### 4.3 The open trip

*Porcelain:* `watch(id, listener)` gives the listener the trip's `Copy` at once, and again each time
the copy changes (`WEB:STORE-F3`). Each window runs a trip store of its own. While a window
watches a trip and the device is online, its trip store holds a WebSocket open to
`GET /api/trips/{trip}/live`. A message holding a `sequence`
higher than the copy's catches the trip up.

A socket that closes is opened again after 1 second, then after twice as long each time, up to 1
minute, and the trip is caught up each time it opens, as `spec/planner/trip-host.md` §4.5 gives. A
socket closed with the code 4403 catches the trip up at once, which deletes it where the traveller
has been removed. The socket is closed once no window watches the trip.

### 4.4 Sending a change

*Porcelain:* `send(id, target, change, agreed)` refuses with `offline` where `isOnline()` is false,
and sends nothing (`WEB:STORE-F4`). Otherwise it sends `POST /api/trips/{trip}/changes`. A refusal
is returned unchanged. A request that fails on the network refuses with `offline`, and the change is
not sent again.

Where the change is accepted, the trip store catches the trip up before it returns the sequence. The
copy therefore holds the change, and every change made before it, once `send` returns.

`isOnline()` is false from the first request that fails on the network, or the browser's `offline`
event, until a request is next answered.

### 4.5 Signing in and out

*Porcelain:* `signedIn(account)` records the account once `access/accounts` has signed the traveller
in, and catches every trip up.

`signOut()` (`WEB:STORE-F5`):

1. closes every socket, and tells every other window, which closes its own
2. deletes the `itinero` database, and makes it again with only the `account` record, holding no
   account and `signOutOwed` set
3. sends `POST /api/auth/sign-out`, and clears `signOutOwed` once it is answered

Where the device is offline, `signOutOwed` stays set. The trip store sends `POST /api/auth/sign-out`
the next time it learns the device is online, whether in `open` or in a later catch-up, before
anything else. While `signOutOwed` is set, `open` gives no
account, so the web app shows the sign-in screen. A sign-in clears it.

A session ended by `access/accounts`, after 180 days unused, is learned from the first request it
refuses with `no-session`. The trip store then deletes the database as `signOut` does, with nothing
owed.

### 4.6 Several windows

*Porcelain:* every window of Itinero on a device opens the same database (`WEB:STORE-F6`). After
each write, the window that wrote sends `{ "trip": ..., "sequence": ... }` on a BroadcastChannel
named `itinero`, and a window that receives it reads the trip again and tells its listeners. A
sign-out sends `{ "signedOut": true }`, and every window shows the sign-in screen.

### 4.7 The test suite

The trip store's tests run in the suite of `apps/web/`, which `spec/web/shell.md` §4.5 describes.

- **Unit tests**, with Node's test runner, IndexedDB from the `fake-indexeddb` package, and a
  stand-in for the online side, cover each step of §4.2, the refusals of §4.4, §4.5 online and
  offline, and each function of §4.8.
- **Cut tests** fail the stand-in at each request of a catch-up, and confirm the copy is unchanged
  (`WEB:STORE-F2`).
- **Browser tests**, with Playwright and the online side running in Wrangler, open a trip in two
  windows and on two devices, and confirm each change is shown within five seconds
  (`WEB:STORE-F3`, `WEB:STORE-F6`).
- **Timing tests** read a trip of 500 pages and 300 bookings ten times, and fail where a read takes
  over one second on the machine running them. The check on a phone of `WEB:STORE-NFR1` is made by
  hand before each release.

### 4.8 Creating a trip, the members and the graveyard

*Porcelain:* seven functions carry the requests a traveller makes that are not changes to a trip
(`WEB:STORE-F7`). Each refuses with `offline` where `isOnline()` is false, as `send` does, and sends
nothing. Otherwise each sends one request, and returns a refusal unchanged.

| Function | Sends | Once it is answered |
|---|---|---|
| `create` | `POST /api/trips` | Catches every trip up, so `trips` lists the new trip |
| `accept` | `POST /api/invitations/{invitation}/accept` | Catches every trip up, so `trips` lists the trip joined |
| `invite` | `POST /api/trips/{trip}/invitations` | Catches the trip up, which fetches its invitations again |
| `withdraw` | `DELETE /api/trips/{trip}/invitations/{invitation}` | Catches the trip up |
| `makeAdmin` | `POST /api/trips/{trip}/admins` | Catches the trip up, which fetches its members again |
| `remove` | `DELETE /api/trips/{trip}/members/{account}` | Catches the trip up |
| `buried` | `GET /api/trips/{trip}/buried/{page}` | Reads the page with the pages' `pageFromText`, and gives it |

Each function returns only once its catch-up is written, so the copy holds what the request did.
`buried` stores nothing, so a page in the graveyard is never on the device (`PLN-F13`).

An admin's copy holds the trip's `grants` and its open `invitations`, which each catch-up replaces
whole. A copy whose traveller is no longer an admin is given neither, and the catch-up deletes
both.

## 5. Resources

| Resource | Path | Owned by |
|---|---|---|
| The trip store | `apps/web/src/store/` | Whoever keeps the web app's roadmap |
| A device's copies | The IndexedDB database `itinero`, for Itinero's site | The device's browser |
| The channel between windows | The BroadcastChannel `itinero` | The device's browser |

The trip store holds nothing online. A copy holds personal details, such as a booking's reference
and seats. It is protected by the device's own lock, and deleted on sign-out (ADR-0017).

## 6. Quality attributes

- **Whole or not at all** (`WEB:STORE-F2`). A catch-up waits for every answer, then writes once.
- **Nothing it may not hold** (`ACC-NFR1`). The trip store holds only what `planner/trip-host`
  gives, and drops whatever a catch-up no longer lists.
- **Deleted on sign-out** (`WEB:STORE-F5`). The database is deleted before the session is ended,
  and a sign-out owed is sent on the next connection.
- **Quick to read** (`WEB:STORE-NFR1`). A trip is read in one transaction, with one record for each
  page and booking.
- **Costs little online** (`PLN:HOST-NFR2`). Catching one trip up is two requests, with more only
  for pages and bookings newly seen, and catching every trip up adds one `GET /api/trips`. Each
  window holds one socket for each trip it shows.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [WEB:STORE-F1](../../requirements/web/trip-store.md#^web-store-f1) | The database of §4.1, `caughtUp`, and `isOnline`, in §4.4. |
| [WEB:STORE-F2](../../requirements/web/trip-store.md#^web-store-f2) | Catching up, in §4.2, in one transaction (§4). |
| [WEB:STORE-F3](../../requirements/web/trip-store.md#^web-store-f3) | `watch` and the socket, in §4.3. |
| [WEB:STORE-F4](../../requirements/web/trip-store.md#^web-store-f4) | `send`, in §4.4. |
| [WEB:STORE-F5](../../requirements/web/trip-store.md#^web-store-f5) | `signOut`, `signOutOwed` and the session ended, in §4.5. |
| [WEB:STORE-F6](../../requirements/web/trip-store.md#^web-store-f6) | The BroadcastChannel of §4.6. |
| [WEB:STORE-F7](../../requirements/web/trip-store.md#^web-store-f7) | The seven functions of §4.8, and the grants and invitations of an admin's copy, in §4.1 and §4.2. |
| [WEB:STORE-NFR1](../../requirements/web/trip-store.md#^web-store-nfr1) | One transaction for each trip read (§4.1, §6). |
| [WEB:SHELL-F5](../../requirements/web/shell.md#^web-shell-f5) | Sending `API` with every request, and stopping on `update-first` with every copy kept (§4). |
| [WEB-F2](../../requirements/web/web.md#^web-f2) | Every trip given offline, with `caughtUp` and `isOnline` (§4.1, §4.4). Saying so on every screen, and offering no change offline, is `web/screens`. |
| [WEB-F3](../../requirements/web/web.md#^web-f3) | A copy that stays until sign-out (§4.5). Keeping the browser from clearing it is `web/shell`. |
| [WEB-F4](../../requirements/web/web.md#^web-f4) | Catching up on connecting, and the socket of an open trip (§4.2, §4.3). |
| [WEB-F5](../../requirements/web/web.md#^web-f5) | Deleting every trip on sign-out and when a session has ended (§4.5). The notice on a computer is `web/screens`. |
| [WEB-NFR1](../../requirements/web/web.md#^web-nfr1) | Reading a large trip within one second (§6). Showing it is `web/screens`. |
| [BKG-F6](../../requirements/bookings/bookings.md#^bkg-f6) | Keeping every booking the traveller may see, whole, on the device (§4.1, §4.2). |
| [PLN-F6](../../requirements/planner/planner.md#^pln-f6) | Taking each change while a trip is open (§4.3). Showing it is `web/screens`. |
| [PLN:ITINERARY-NFR1](../../requirements/planner/itinerary.md#^pln-itinerary-nfr1) | Keeping a trip's calendar on the phone (§4.1). |
| [PLN:PAGES-NFR1](../../requirements/planner/pages.md#^pln-pages-nfr1) | Keeping a trip's pages on the phone (§4.1). Searching them is `web/screens`. |
| [ACC-F11](../../requirements/access/access.md#^acc-f11) | Deleting a trip the traveller is no longer on, on the next catch-up (§4.2). |
| [ACC-F12](../../requirements/access/access.md#^acc-f12) | Dropping and gaining pages, bookings and the calendar on each catch-up (§4.2). |

## 8. Open

- **A catch-up that grows large.** A trip whose every page changed while a device was away is
  caught up in one answer. A trip large enough for that answer to be slow on a poor connection may
  need its catch-up given in parts.
