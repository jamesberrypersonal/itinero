# The planner's roadmap

**Kept by:** James Berry

The planner holds each trip, the stops it visits, the days spent at each, the travel between them,
and the pages where travellers write up their research. Phase 0 designs it: the requirements and
specifications for the planner and its components, before any of it is built.

The planner also plans `shared/trip-time`, the local dates and times its itinerary holds. The
planner is the first system that needs them.

## Completed

### Phase 0 — Design

#### Milestone Planner-0.1 — The itinerary model

- The planner system is registered, with its itinerary and pages components and the shared
  trip-time component.
- A trip can be read on a phone with no connection, and changed only with one (ADR-0004, a trip
  is read-only offline).
- `shared/trip-time` has its requirements and its specification. A date or time is held in the
  local time of the place it happens, such as a train leaving Lyon at 09:10 Paris time.

## Pending

### Phase 0 — Design

#### Milestone Planner-0.1 — The itinerary model

- Write the planner system's requirements: what the planner does for a traveller, end to end.
- Write the requirements for `planner/itinerary`: trips, stops, the days at each stop, and the
  travel between stops.
- Write the specification for `planner/itinerary`.

#### Milestone Planner-0.2 — Pages

- Do TODO-2. Decide whether a trip's pages form a tree.
- Write the requirements for `planner/pages`.
- Write the specification for `planner/pages`.
