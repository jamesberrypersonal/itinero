# The planner's roadmap

**Kept by:** James Berry

The planner holds each trip: the calendar a traveller pencils it in on, the dates that are fixed,
and the pages where travellers write up their research. Phase 0 designs it: the requirements and
specifications for the planner and its components, before any of it is built.

The planner also plans `shared/trip-time`, the local dates and times its itinerary holds. The
planner is the first system that needs them.

## Completed

### Phase 0 — Design

#### Milestone Planner-0.2 — Pages

- A trip's pages form a tree, with links between any two, and hold Markdown text. A trip's chosen
  countries each get a page, and the calendar links to pages (ADR-0011, a trip's pages form a
  tree).
- The planner system's requirements promise the tree, the links between pages, a page for each
  chosen country, and links from the calendar to pages.
- Each stretch and firm item of `planner/itinerary` can name a page.

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
  by one function, the same on a phone and online.

## Pending

### Phase 0 — Design

#### Milestone Planner-0.2 — Pages

- Write the requirements for `planner/pages`.
- Write the specification for `planner/pages`.

#### Milestone Planner-0.3 — The trip held online

- Register the component that holds the copy of each trip online, and write its requirements and
  specification. It moved here from Milestone Planner-0.1, so that the pages could start.
