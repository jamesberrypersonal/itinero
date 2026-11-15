# The planner's roadmap

**Kept by:** James Berry

The planner holds each trip: the calendar a traveller pencils it in on, the dates that are fixed,
and the pages where travellers write up their research. Phase 0 designs it: the requirements and
specifications for the planner and its components, before any of it is built. Phase 1 builds it,
one component at a time, starting from the components that depend on no other.

This roadmap also plans `shared/trip-time`, the component that holds the local dates and times of
the planner's itinerary. The planner is the first system that needs that component.

## Completed

### Phase 1 — Build

#### Milestone Planner-1.1 — Dates and times

- The npm workspace, in `package.json` at the repository root, holds the product's packages under
  `packages/`. The workflow `test-packages` runs their tests in continuous integration, beside the
  documentation check.
- `shared/trip-time` is built as `@itinero/trip-time`, in `packages/trip-time/`, as its
  specification gives it, in TypeScript with no runtime dependencies (ADR-0007, trip-time is
  written in TypeScript).
- Its rules file, `rules/2026f.json`, holds release 2026f of the IANA time zone database, read from
  the TZif files macOS ships for that release (ADR-0008, trip-time carries its own copy of the
  time-zone rules). The build script, `npm run build-rules`, makes the rules file from an unpacked
  IANA release with that release's own zic.
- Its test suite proves each requirement of `shared/trip-time` by the verification it carries,
  except the checks of `SHR:TRIP-TIME-NFR1` that need a phone.

### Phase 0 — Design

#### Milestone Planner-0.3 — The home page, and the trip held online

- A trip opens on a home page for each traveller, with their own dates, their bookings and the
  country the phone is in (ADR-0014, a trip opens on a home page for each traveller).
- A trip's calendar holds stretches and unbooked firm items, and is seen only by the travellers an
  admin chooses. Bookings have a page of their own (ADR-0013, a trip's bookings have a page of their
  own, and its calendar is seen only by the travellers an admin chooses).
- The planner system's requirements promise a trip's dates, each traveller's dates within them, and
  the home page.
- `planner/trip-host` holds the copy of each trip online, in a Cloudflare Durable Object of its own
  (ADR-0015, Itinero's online side runs on Cloudflare's free plan). It applies every change once
  `access/permissions` allows it, one at a time, and tells each open device of each change.
- A traveller's save of a page another traveller changed meanwhile is refused, with both texts kept.
- `planner/trip-host` holds a trip's bookings beside its calendar and pages, and gives each device
  only the bookings its traveller may see (ADR-0016, a trip's bookings are entered by hand, as one
  of four kinds, and kept with the trip online).

#### Milestone Planner-0.2 — Pages

- A trip's pages form a tree, with links between any two, and hold Markdown text. A trip's chosen
  countries each get a page, and the calendar links to pages. A deleted page goes to the trip's
  graveyard. Only an admin, a traveller who may manage the trip, reads or restores a page there
  (ADR-0011, a trip's pages form a tree).
- A deleted page is restored only to its old place. The graveyard lists only the highest deleted
  page of each branch. A page deleted with it returns with it, and one deleted earlier is listed
  once it is restored (ADR-0021, a deleted page is restored only to its old place).
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
  day, firm items and firm travel in local time, changes shared between travellers, and pages.
- `planner/itinerary` has its requirements and its specification. Each change to a trip is applied
  by one function, the same on a phone and on the copy held online.

## Pending

### Phase 1 — Build

#### Milestone Planner-1.2 — The itinerary

- Build `planner/itinerary` as `@itinero/itinerary`, in `packages/itinerary/`, as its specification
  gives it.
- Prove each requirement of `planner/itinerary` by the verification it carries.

#### Milestone Planner-1.3 — Pages

- Build `planner/pages` as `@itinero/pages`, in `packages/pages/`, as its specification gives it.
- Prove each requirement of `planner/pages` by the verification it carries.

#### Milestone Planner-1.4 — The trip held online

**Waits on:** Milestone Access-1.3, Milestone Bookings-1.1, Milestone Web-0.2

- Rebuild `packages/trip-time/rules/2026f.json` with the build script, from IANA's own release,
  and confirm the test suite still passes. Milestone Planner-1.1 moved this here, since the release
  could not be downloaded when it was built.
- Build `planner/trip-host` in the Worker of the online side, in `services/online/`, with a Durable
  Object for each trip, as its specification gives it.
- Prove each requirement of `planner/trip-host` by the verification it carries.
- Prove the planner system's own requirements that need only the online side, such as changes
  shared between travellers. Those that need a phone wait for the web app.
