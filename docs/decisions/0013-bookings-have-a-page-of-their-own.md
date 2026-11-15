# ADR-0013 — A trip's bookings have a page of their own, and its calendar is seen only by the travellers an admin chooses

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** planner, bookings, access

## Problem

The planner, the system that holds each trip, gives every trip a calendar. Itinero's travellers
plan loosely. They know roughly where they will be and when, such as about two weeks in Chile in
early December, and fix only a few things in advance. The calendar therefore holds a rough plan,
pencilled in, beside the few things that are fixed.

Several travellers can share a trip, and not all of them share all of it. A companion may join for
one week of a month, or a traveller may be planning a surprise for another. The calendar shows
where the travellers expect to be on every day, which is the trip's itinerary, and an admin may
not want every traveller on the trip to see it. An admin is a traveller who may manage the trip:
the traveller who created it, and anyone another admin makes one.

Every traveller still needs the bookings that are theirs, such as the flight they are on or the
tour they have a ticket for. A booking held only on the calendar would be hidden with it.

## Decision

A trip holds two things with dates: its calendar, and its bookings. Each has its own place and its
own access.

**The calendar is the plan.** It holds pencilled stretches and unbooked firm items:

- A stretch is a place and the dates a traveller expects to be there, such as Chile from 6 to 20
  December. A place is a country, or somewhere in one, such as Santiago in Chile. A stretch's dates
  are whole calendar dates, marked as pencilled, and a traveller moves and resizes a stretch
  freely. The calendar shows, for each day, the country of every stretch covering it. A country is
  a name on a stretch, and holds nothing of its own.
- An unbooked firm item is something decided but not booked, fixed to a date, such as a day to move
  on from Lyon, or a bus to Mendoza on 9 December not yet booked. It has a date, and it can have a
  time, in the local time of the place it happens. Travel has a time at each end, in the local time
  of that end.

The planner never requires the stretches to be complete or consistent. A gap between stretches, two
stretches that overlap, and two stretches in a row with no travel between them are all accepted.

**The calendar is hidden until an admin grants it.** The access system, the system that handles
accounts, invitations and who may see each part of a trip, gives each traveller no access to the
calendar at first. An admin grants a traveller view or edit access to the whole calendar. Admins
always have edit access.

**Bookings have a page of their own.** A booking is something booked, fixed to a date, such as a
flight, a train, a stay, a tour or a table. It has a date, and it can have a time, in the local
time of the place it happens. Each booking names the travellers it is for. The bookings page lists
a traveller's bookings in the order they happen. It is where a traveller adds a booking, changes
it, and reads it.

**Each booking is seen only by the travellers it is for, and the admins.** A traveller sees a
booking whether or not they may see the calendar.

**The calendar also shows bookings.** A traveller who may see the calendar sees on it each booking
they may see, standing out from the pencilled stretches. The bookings page stays the booking's
home. A booking becomes a booking only once it is booked: until then it is an unbooked firm item on
the calendar.

## Consequences

- `bookings`, a new system, holds a trip's bookings and the page that lists them. Each kind of
  booking, such as a flight or a stay, becomes a component of it once its form is designed.
- `planner/itinerary`, the component that holds a trip's calendar, holds stretches and unbooked
  firm items only. `spec/planner/itinerary.md` changes to say so. Showing bookings on the calendar
  is the web app's, the system travellers use on a computer or a phone.
- The access system promises the calendar's own access, granted by an admin, and that each booking
  is seen only by the travellers it names and the admins.
- A traveller without access to the calendar never sees the pencilled plan, and sees no booking
  they are not on. A trip shared with a companion for one flight shows them that flight.
- A traveller who books a planned bus adds a booking, and removes the unbooked firm item from the
  calendar by hand. Nothing turns one into the other.
- The planner has no rules for gaps, overlaps or missing travel. A trip with nothing pencilled in
  and no bookings is a valid trip.
- A booking and a stretch can disagree, such as a flight out of Santiago on 10 December while
  Santiago is pencilled in until 8 December. The calendar shows both as they stand, and moves
  neither.
- A stretch's dates are whole dates, so `shared/trip-time`, the component that holds a trip's dates
  and times, needs no new kind of value for them.
- A country holds no facts of its own, such as its entry rules or emergency numbers. Holding them
  is a decision for later.

> [!NOTE]
> **History.** ADR-0010 (a trip's calendar is pencilled in, and only its firm items are fixed) put
> every fixed item, booked or not, on the calendar, and every traveller on a trip saw the calendar.

## Alternatives considered

- **Every firm item on its own page, booked or not.** A decided day to move on tells a traveller
  where the others will be, which is the itinerary an admin may want to keep from them.
- **Every booking seen by every traveller on the trip.** A traveller on one flight would see every
  other flight, and so the trip's route.
- **The calendar seen by every traveller, with stretches hidden one by one.** An admin would have
  to hide each stretch from each traveller, and a stretch left visible by mistake shows the plan.
