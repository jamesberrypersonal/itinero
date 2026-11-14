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

## Pending

### Phase 0 — Design

#### Milestone Bookings-0.1 — The bookings page

- Write the bookings system's requirements: adding, changing and reading a booking, the travellers
  it names, and the bookings page in the order bookings happen.
- Decide the first kinds of booking, such as flights and stays, and register each as a component
  in the registry's table of booking kinds.
- Write the requirements and specification for each of those kinds.
