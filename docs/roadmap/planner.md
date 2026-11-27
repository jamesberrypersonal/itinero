# The planner's roadmap

**Kept by:** James Berry

The planner holds each trip: the calendar a traveller pencils it in on, the dates that are fixed,
and the pages where travellers write up their research. Phase 0 designs it: the requirements and
specifications for the planner and its components, before any of it is built. Phase 1 builds it,
one component at a time, starting from the components that depend on no other. Phase 2 designs and
builds each traveller's checklists, and the library of templates they start from. Phase 3 readies
the pages and the itinerary for a first trip with the app.

This roadmap also plans `shared/trip-time`, the component that holds the local dates and times of
the planner's itinerary. The planner is the first system that needs that component.

## Completed

### Phase 2 — Checklists

#### Milestone Planner-2.2 — Checklists built

- `planner/checklists` is built as `@itinero/checklists`, in `packages/checklists/`, as its
  specification gives it. It imports only types from `@itinero/trip-time`, and has no runtime
  dependency.
- Its test suite proves each requirement of `planner/checklists` by the verification it carries,
  except the checks of `PLN:CHECKLISTS-NFR1` that need a phone.
- `planner/library` is in the Worker of the online side, as its specification gives it. Each
  traveller's library is two tables of its D1 database, made by the migration
  `0003_library.sql`.
- Its test suite proves each requirement of `planner/library` by the verification it carries,
  inside Wrangler, with ten travellers' day of `PLN:LIBRARY-NFR2` within the free plan.
- `planner/trip-host` holds each traveller's checklists on a trip, in a table of each trip's
  Durable Object, and gives each traveller only their own, an admin included. A removed
  traveller's checklists are kept, and given back if they rejoin.
- The online side's suite proves `PLN:HOST-F10`, and the checks of `PLN:HOST-NFR1` and `ACC-F14`
  that need only the online side. A day of ten devices still reads about 2 million rows, within the
  free plan's 5 million.

#### Milestone Planner-2.1 — The design of checklists

- A traveller's checklists are their own, and start from templates kept outside any trip. Only that
  traveller sees or ticks them, an admin included. A copy of a template stands apart from it, and a
  delete is for good (ADR-0024, a traveller's checklists are their own).
- The planner system's requirements promise each traveller's templates and their checklists on a
  trip (`PLN-F17`, `PLN-F18`).
- `planner/checklists` has its requirements and its specification. Each checklist is one record,
  holding its items, and a traveller's checklists keep the order they give.
- `planner/library` has its requirements and its specification. Each traveller's library is kept in
  the online side's D1 database, one row for each template.
- `planner/trip-host` holds each traveller's checklists on a trip, and gives them to that traveller
  alone (`PLN:HOST-F10`). The access system promises that no traveller sees another's checklists
  (`ACC-F14`).
- The web app's trip store keeps the library and each trip's checklists on the device, and its
  screens show them in screens of their own (`WEB:STORE-F8`, `WEB:SCREENS-F11`).

### Phase 1 — Build

#### Milestone Planner-1.4 — The trip held online

- `packages/trip-time/rules/2026f.json` is built with the build script from IANA's own release
  2026f, and gives every zone the same offset as the file it replaces, which Milestone Planner-1.1
  read from the files macOS ships.
- `planner/trip-host` is in the Worker of the online side, as its specification gives it. Each trip
  is a Durable Object of its own, Cloudflare's object with storage of its own that handles one
  request at a time. It holds the trip's calendar, pages, grants of access and bookings in its own
  SQLite database. `access/membership` hands it each traveller who joins, leaves or is made an
  admin.
- Its test suite proves each requirement of `planner/trip-host` by the verification it carries,
  inside Wrangler, with the tests of its cost on Node.js. A request takes at most 3 milliseconds on
  a trip of 500 pages and 300 bookings, within the trip host's budget of 10. A day of ten devices,
  each holding the trip open while a change is made each minute, reads about 2 million rows, within
  the free plan's 5 million.
- The suite proves the checks of the planner's own requirements that need only the online side:
  `PLN-F6`, `PLN-F10`, `PLN-F13`, `PLN-F14` and `PLN-F16`. It proves `BKG-F1`, and every check of
  `BKG-F5` except that a removed booking is gone from every traveller's bookings page.

#### Milestone Planner-1.3 — Pages

- `planner/pages` is built as `@itinero/pages`, in `packages/pages/`, as its specification gives
  it. It imports only types from `@itinero/trip-time`, and has no runtime dependency.
- Its test suite proves each requirement of `planner/pages` by the verification it carries, except
  the checks of `PLN:PAGES-NFR1` that need a phone.

#### Milestone Planner-1.2 — The itinerary

- `planner/itinerary` is built as `@itinero/itinerary`, in `packages/itinerary/`, as its
  specification gives it, with the list of every country ISO 3166-1 assigns.
- Its test suite proves each requirement of `planner/itinerary` by the verification it carries,
  except the checks of `PLN:ITINERARY-NFR1` that need a phone.

#### Milestone Planner-1.1 — Dates and times

- The npm workspace, in `package.json` at the repository root, holds the product's packages under
  `packages/`. The workflow `test-packages` runs their tests in continuous integration, beside the
  documentation check.
- `shared/trip-time` is built as `@itinero/trip-time`, in `packages/trip-time/`, as its
  specification gives it, in TypeScript with no runtime dependencies (ADR-0007, trip-time is
  written in TypeScript).
- Its rules file, `rules/2026f.json`, holds release 2026f of the IANA time zone database, read from
  the TZif files, the compiled rules, macOS ships for that release (ADR-0008, trip-time carries its
  own copy of the time-zone rules). The build script, `npm run build-rules`, makes the rules file
  from an unpacked IANA release with that release's own zic, its compiler of the rules.
- Its test suite proves each requirement of `shared/trip-time` by the verification it carries,
  except the checks of `SHR:TRIP-TIME-NFR1` that need a phone.

### Phase 0 — Design

#### Milestone Planner-0.3 — The home page, and the trip held online

- A trip opens on a home page for each traveller, with their own dates, the part of the trip they
  come for, their bookings and the country the phone is in (ADR-0014, a trip opens on a home page
  for each traveller).
- A trip's calendar holds pencilled stretches, each a place and rough dates, and firm items fixed to
  a date that are not bookings. It is seen only by the travellers an admin chooses. Bookings have a
  page of their own (ADR-0013, a trip's bookings have a page of their own, and its calendar is seen
  only by the travellers an admin chooses).
- The planner system's requirements promise a trip's dates, each traveller's dates within them, and
  the home page.
- `planner/trip-host` holds the copy of each trip online, in a Cloudflare Durable Object of its own
  (ADR-0015, Itinero's online side runs on Cloudflare's free plan). It applies every change once
  `access/permissions` allows it, one at a time, and tells each open device of each change.
- A traveller's save of a page that another traveller changed since the first began editing it is
  refused, and the traveller is shown both texts.
- `planner/trip-host` holds a trip's bookings beside its calendar and pages, and gives each device
  only the bookings its traveller may see (ADR-0016, a trip's bookings are entered by hand, as one
  of four kinds, and kept with the trip online).

#### Milestone Planner-0.2 — Pages

- A trip's pages form a tree, with links between any two, and hold Markdown text. A trip's chosen
  countries each get a page, and the calendar links to pages. A deleted page goes to the trip's
  graveyard. Only an admin, a traveller who may manage the trip, reads or restores a page there
  (ADR-0011, a trip's pages form a tree).
- A deleted page is restored only to its old place. The graveyard lists only the highest deleted
  page of each branch. A page deleted along with the page above it returns when that page does. A
  page deleted earlier than the page above it is listed again once that page is restored (ADR-0021,
  a deleted page is restored only to its old place).
- The planner system's requirements promise the tree, the links between pages, a page for each
  chosen country, and links from the calendar to pages.
- Each pencilled stretch and each firm item on a trip's calendar, which `planner/itinerary` holds,
  can name a page.
- The planner system's requirements promise search across a trip's pages, with or without a
  connection. They also promise the graveyard, where deleted pages wait for an admin to restore
  them.
- `planner/pages` has its requirements and its specification. Each page is stored as a record of
  its own. Every change writes the record of one page, however many pages lie beneath the page it
  moves or deletes.

#### Milestone Planner-0.1 — The itinerary model

- The planner system is registered, with its itinerary and pages components and the shared
  trip-time component.
- A trip can be read on a phone with no connection, and changed only with one (ADR-0004, a trip
  is read-only offline).
- `shared/trip-time` has its requirements and its specification. A date or time is held in the
  local time of the place it happens, such as a train leaving Lyon at 09:10 Paris time.
- `shared/trip-time` is written in TypeScript (ADR-0007, trip-time is written in TypeScript), and
  carries its own copy of the time-zone rules (ADR-0008, trip-time carries its own copy of the
  time-zone rules).
- A trip's calendar holds pencilled stretches, each a place and rough dates, and firm items fixed to
  a date (ADR-0010, a trip's calendar is pencilled in).
- The planner system has its requirements: a trip pencilled in on a calendar, the country of each
  day, firm items, among them travel, in local time, changes shared between travellers, and pages.
- `planner/itinerary` has its requirements and its specification. Each change to a trip is applied
  by one function, the same on a phone and on the copy held online.

## Pending

The checks of the planner's requirements that need a phone or the screens wait in the web app's
roadmap.

### Phase 3 — Before a first trip

#### Milestone Planner-3.1 — A page's starting headings

- Add the requirements for the headings every new page starts with to `planner/pages` and to the
  web app's screens. Do TODO-52.
- Build them in `@itinero/pages`, for a new trip's country pages, and prove their requirements by
  their verification.

#### Milestone Planner-3.2 — A firm item's address

- Decide whether a firm item holds an address, and whether it fills in the item's time zone. Add
  the requirements to `planner/itinerary` and to the web app's screens. Do TODO-48.
- Build the address in `@itinero/itinerary`, and prove its requirements by their verification.
