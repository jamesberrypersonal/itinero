# The bookings system's roadmap

**Kept by:** James Berry

The bookings system holds a trip's bookings, such as flights, stays and tours, each for the
travellers it names, and the page that lists them. Phase 0 designs it: its requirements, its
components and their specifications, before any of it is built.

A booking's visibility follows the access system, which promises that each booking is seen only by
the travellers it names and the admins (ADR-0013, a trip's bookings have a page of their own).

## Completed

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

Nothing is pending. Milestone Bookings-0.1 is complete in design, and building it is not yet
planned.
