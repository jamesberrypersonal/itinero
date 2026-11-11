# ADR-0004 — A trip can be read without a connection, but changed only with one

- **Status:** Accepted
- **Date:** 2026-11-11
- **Scope:** planner, web

## Problem

Travellers check their trip on a phone, and a phone on a trip is often offline. Examples are a
long bus ride, a multi-day trek, or a country where the traveller has no local SIM card yet. A
trip that can be read only with a connection fails exactly when it is needed. Itinero therefore has
to show a trip on a phone that has no connection.

Letting a phone also change a trip while offline is a much larger promise. Two travellers could
change the same day of the same trip while apart. When the phones reconnect, something has to
decide which change stands. Every kind of change then needs a rule for that decision. Examples are
moving a stop, editing a page, and changing who may see a page.

## Decision

A traveller can read a trip on a phone that has no connection. The phone shows every page of the
trip that the traveller may see, as it stood the last time the phone was online.

A trip changes only while the traveller's device is online. Each change is made directly to the
one copy of the trip that Itinero holds online. While offline, the app shows no way to change the
trip. It says the trip is offline, and when its copy was last brought up to date.

## Consequences

- The trip held online is the only copy anyone changes. Two changes never need reconciling, so
  the planner's design needs no rules for conflicting changes.
- A phone keeps a copy of each trip, for reading. The copy can be out of date. The app has to say
  when it was last brought up to date, so a traveller knows how far to trust it.
- The copy holds only the pages the traveller may see. Which pages those are is decided by the
  access system, which holds accounts, invitations and permissions.
- The copy holds personal details, such as emergency contacts, on the phone itself. A lost phone
  exposes whatever the copy holds. How that copy is protected has to be decided before personal
  details are stored in a trip.
- If an admin removes a traveller's access while the traveller's phone is offline, the phone
  keeps its copy until it next connects.
- A traveller who finds a mistake while offline cannot fix it until they reconnect.
- Changing a trip offline later is a new decision record that supersedes this one. It brings the
  rules for conflicting changes with it.

## Alternatives considered

- **Changes made offline, merged when the phone reconnects.** Every kind of change would need a
  rule for which of two conflicting changes stands. It lost because a change on the road can wait
  for a connection. Trips are planned at home, where there is one.
- **A phone queues its own changes and sends them when it reconnects.** The trip can change
  online in the meantime, so a queued change can still conflict. It lost for the same reason as
  merging.
- **A trip can be read only with a connection.** It fails on the bus, on the trek and in the
  country with no SIM card, where a traveller most needs the trip.
