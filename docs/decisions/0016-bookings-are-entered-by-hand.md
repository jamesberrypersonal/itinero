# ADR-0016 — A trip's bookings are entered by hand, as one of four kinds, and kept with the trip online

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** bookings, planner/trip-host

## Problem

A booking is something booked and fixed to a date, such as a flight, a stay or a tour. Each
booking names the travellers it is for, and only they and the trip's admins see it (ADR-0013, a
trip's bookings have a page of their own, and its calendar is seen only by the travellers an admin
chooses). An admin is a traveller who may manage the trip. The bookings system, which holds a
trip's bookings and the page that lists them, had no design. Four questions had to be settled
before it could be specified:

- how a booking gets into Itinero
- what a booking holds, and whether one form serves every booking
- whether a booking can carry a file, such as a PDF ticket
- where a trip's bookings are kept online, and how a traveller's phone is given its own

Itinero is personal software for a few travellers, and its online side runs on Cloudflare's free
plan (ADR-0015, Itinero's online side runs on Cloudflare's free plan, and travellers sign in with
Google alone). Each trip is held online in a Durable Object of its own: a small program with its
own database, which handles one request at a time. `planner/trip-host`, the component that holds
each trip online, applies every change to it there. A traveller's phone holds a copy of what they
may see, which they read with no connection (ADR-0004, a trip is read-only offline).

## Decision

**A traveller enters each booking by hand.** Importing a booking from a confirmation email is
planned, first for flights and stays, and designed later.

**Each booking is one of four kinds, and each kind has a form of its own.** The kinds are:

- **a flight**, in one or more legs, each leaving one airport and arriving at another, at exact
  times in each airport's local time
- **a stay**, such as a hotel or a flat, from check-in to check-out, one or more nights apart
- **a journey** by train, bus, ferry or hired car, from one place to another, with a time at each
  end in each place's local time
- **an activity**, such as a tour, a ticket or a table at a restaurant, at one place. An activity
  is also the form for a booking that fits no other kind

Every booking also holds the same few details, whatever its kind: the travellers it names, a
booking reference, who it is booked with, a link, notes, and perhaps a page of the trip.

**A booking holds text only.** A file, such as a PDF ticket or a boarding pass, is not held.
Holding files is designed later.

**A trip's bookings are kept in its Durable Object, beside its calendar, pages and grants.** Each
booking is a record of its own. The trip host applies each change to a booking once
`access/permissions`, the component that decides what each traveller may do, allows it. It then
gives each device only the bookings its traveller may see. A change made from an older copy of a
booking is refused, and the traveller is shown the booking as it stands.

## Consequences

- The bookings system has five components. `bookings/list` holds a trip's bookings, the changes
  to them, and the order they happen in. `bookings/flight`, `bookings/stay`, `bookings/journey`
  and `bookings/activity` each hold one kind. All five are built as one package,
  `@itinero/bookings`.
- `spec/planner/trip-host.md` changes to hold a trip's bookings, check each change to one, and
  give each device its own in its catch-up.
- A booking costs nothing to store: it is a few hundred bytes in the trip's own database.
- The registry's table of booking kinds marks flights and stays as planned for importing, and
  journeys and activities as not.
- A traveller copies each time from their confirmation, and chooses each place's time zone, because
  nothing in Itinero finds the time zone of a place yet.
- A traveller who needs a ticket's file at a gate opens it from their email, or from the link a
  booking holds. A link needs a connection.
- A booking an importer reads in later is held in the same four forms, so importing adds no new
  form.
- Two travellers changing one booking at once never lose a change silently. The second is told,
  and changes the booking again.

## Alternatives considered

- **Import from email in the first design.** Reading confirmations from many airlines and hotels
  is the largest part of the system, and travellers need their bookings before it is built.
- **One form for every booking.** A flight's legs and a stay's nights would be free text, so
  nothing could order a day by them or say how long a flight takes.
- **Files held with each booking, and copied to each phone.** Files would fill the free plan's
  storage, and every phone's copy, faster than every other part of a trip together.
- **Bookings kept in a database of their own, apart from the trip.** A change to a booking and a
  change to a traveller's access could then be applied in either order, and a phone could be given
  a booking its traveller had just lost.
- **The later of two changes to a booking standing.** The first traveller's change, such as a
  corrected seat, would be lost without either traveller knowing.
