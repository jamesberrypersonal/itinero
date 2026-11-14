# ADR-0010 — A trip's calendar is pencilled in, and only its firm items are fixed

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** planner

## Problem

The planner, the system that holds each trip, needs a shape for a trip's dates. A trip planner
built as a firm schedule gives every stop on the route, such as each city, fixed dates. It joins
every pair of stops with a journey. It lists each day as a timetable, and reports a night with
nowhere to stay as a mistake. That suits a
traveller who plans each day ahead.

Itinero's travellers plan loosely. They know roughly where they will be and when, such as about two
weeks in Chile in early December. They fix only a few things in advance: a booked flight, a booked
tour, or a day they have decided to move on. A firm schedule asks them for dates they do not have,
and reports the gaps they leave on purpose as errors.

## Decision

A trip's calendar holds two kinds of thing.

**Pencilled stretches.** A stretch is a place and the dates a traveller expects to be there, such as
Chile from 6 to 20 December. A place is a country, or somewhere in one, such as Santiago in Chile,
so every stretch names a country. A stretch's dates are whole calendar dates, marked as pencilled,
and a traveller moves and resizes a stretch freely. The calendar shows, for each day, the country of
every stretch covering it. A country is a name on a stretch, and holds nothing of its own.

**Firm items.** A firm item is something fixed to a date, such as a booked tour, a booked flight
or bus, or a day the traveller has decided to travel from one place to the next. It has a date, and
it can have a time, in the local time of the place it happens. Travel has a time at each end, in
the local time of that end. The calendar shows firm items so
that they stand out from the pencilled stretches.

The planner never requires the stretches to be complete or consistent. A gap between stretches,
two stretches that overlap, and two stretches in a row with no travel between them are all
accepted. Travel appears on the calendar only as a firm item.

The calendar is one view of a trip, and need not be the first thing a traveller sees on opening
it. What a traveller sees first is not decided until TODO-10 is done.

## Consequences

- `spec/planner/itinerary.md` gives the form of stretches and firm items, and the difference
  between them.
- The planner has no rules for gaps, overlaps or missing travel. A trip with nothing pencilled in
  is a valid trip.
- Nothing warns a traveller of a night with nowhere to stay. A traveller who wants to know whether
  every night is covered reads the calendar for themselves.
- A firm item and a stretch can disagree, such as a flight out of Santiago on 10 December while
  Santiago is pencilled in until 8 December. The planner shows both as they stand, and moves
  neither.
- `shared/trip-time`, the component that holds a trip's dates and times, holds a few kinds of
  value, such as an exact time, a whole date and the morning of a date. A stretch's dates are whole
  dates, so trip-time needs no new kind of value for them. A firm item's time can be any of
  trip-time's kinds that hold a time, including imprecise ones such as the morning of a date.
- A country holds no facts of its own, such as its entry rules or emergency numbers. Holding them
  is a decision for later.

## Alternatives considered

- **A firm schedule, with fixed dates for every stop and a journey between each pair.** It asks
  travellers for dates they do not have, and treats loose plans as mistakes.
- **Vague dates, such as about ten days in early December.** Each of trip-time's imprecise kinds
  covers part of one day, so a vague span of days would need new kinds of value. A vague date also
  cannot be drawn on a calendar.
- **No calendar at all.** The firm items and the stretches need one view where they are seen
  against each other.
