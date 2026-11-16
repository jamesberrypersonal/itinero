# The bookings system's roadmap

**Kept by:** James Berry

The bookings system holds a trip's bookings, such as flights, stays and tours, each for the
travellers it names, and the page that lists them. Phase 0 designs it: its requirements, its
components and their specifications, before any of it is built. Phase 1 builds it, one component
at a time: what every booking has first, then each kind.

A booking's visibility follows the access system, which promises that each booking is seen only by
the travellers it names and the admins (ADR-0013, a trip's bookings have a page of their own).

## Completed

### Phase 1 — Build

#### Milestone Bookings-1.2 — Flights

- `bookings/flight` is in `@itinero/bookings`, as its specification gives it.
- Its test suite proves each requirement of `bookings/flight` by the verification it carries, and
  `BKG:LIST-F2`, `BKG:LIST-F3` and `BKG:LIST-F6` by theirs.

#### Milestone Bookings-1.1 — What every booking has

- `bookings/list` is built as `@itinero/bookings`, in `packages/bookings/`, as its specification
  gives it, with one table that reaches each kind of booking. A booking of a kind not yet built is
  refused with `unknown-kind`.
- Its test suite proves the checks of `bookings/list` that need no kind of booking: the form of a
  change and of its text, `touches`, and the refusals of `apply` made before a booking's own checks.

### Phase 0 — Design

#### Milestone Bookings-0.1 — The bookings page

- The bookings system is registered.
- A trip's bookings have a page of their own, apart from its calendar, and each names the travellers
  it is for (ADR-0013, a trip's bookings have a page of their own).
- Bookings are entered by hand, as one of four kinds, and kept with the rest of the trip in its
  Durable Object online. A booking holds text only (ADR-0016, a trip's bookings are entered by hand,
  as one of four kinds, and kept with the trip online).
- The bookings system has its requirements: adding a booking for the travellers it names, its
  times in local time, the bookings page in the order bookings happen, changing and removing a
  booking, and reading bookings with no connection.
- The bookings system is divided into `bookings/list`, which holds what every booking has, and four
  kinds of booking: `bookings/flight`, `bookings/stay`, `bookings/journey` and `bookings/activity`.
  Each has its requirements and its specification, and all five are built as one package,
  `@itinero/bookings`.

## Pending

### Phase 1 — Build

#### Milestone Bookings-1.3 — Stays

- Add `bookings/stay` to `@itinero/bookings`, as its specification gives it.
- Prove each requirement of `bookings/stay` by the verification it carries.
- Prove `BKG:LIST-F1`, whose verification uses a flight and a stay. Milestone Bookings-1.1 moved it
  here, for the same reason.

#### Milestone Bookings-1.4 — Journeys

- Add `bookings/journey` to `@itinero/bookings`, as its specification gives it.
- Prove each requirement of `bookings/journey` by the verification it carries.
- Prove `BKG:LIST-F5`, whose verification uses a stay and a bus. Milestone Bookings-1.1 moved it
  here, for the same reason.

#### Milestone Bookings-1.5 — Activities

- Add `bookings/activity` to `@itinero/bookings`, as its specification gives it.
- Prove each requirement of `bookings/activity` by the verification it carries.
- Prove `BKG:LIST-F4`, `BKG:LIST-F7`, `BKG:LIST-NFR1` and `BKG:LIST-NFR2`, whose verification
  uses bookings of several kinds. Milestone Bookings-1.1 moved them here, for the same reason.
