# ADR-0025 — A firm item may hold an address, kept as written, and takes its time zone from the stretch

- **Status:** Accepted
- **Date:** 2026-11-27
- **Scope:** planner, web

## Problem

A firm item, something fixed to a date such as a hike at three or a dinner booked for eight, cannot
say where it happens. It holds a title, a time, whether it is travel, and the page it names. Only a
firm item of travel holds a place, one at each end. A traveller who wants the trailhead or the
restaurant at hand must write a page for it and name the page. A beta tester asked for an address
on a firm item, in [issue 33](https://github.com/jamesberrypersonal/itinero/issues/33).

A firm item at a time also needs a time zone. The web app fills a zone in from a place the
traveller enters, from a list of towns and airports kept on the phone (ADR-0019, a place's time
zone is filled in from a list of places, kept on the phone one country at a time). A firm item that
is not travel asks for no place, so its zone starts empty, and the traveller chooses one by hand
for every item.

An address could fill the zone in, but only through a service that finds where an address is. That
service needs a connection, and the list of ADR-0019 holds towns and airports, never streets.

## Decision

**A firm item may hold an address.** The address is optional, and a firm item without one is the
same as before. Any firm item may hold one, travel or not, such as the pier a ferry leaves from.

**An address is one line of text, kept as written.** Nothing looks it up, checks it against a map,
or finds a time zone from it. It holds anything a traveller would give a taxi driver, such as
"Hotel Las Torres, Torres del Paine", or "Av. Libertador 1234, Buenos Aires".

**The web app shows the address on the item's card and its form**, and a tap on it opens the
device's maps app, searching for the address as written. The maps app needs a connection, as any
map does. With none, the address still shows, and a traveller can copy it.

**A firm item that is not travel takes its time zone from the stretch the day falls in.** The
stretches covering the item's date are taken in the day's order. The zone is the first that the
list of places gives for one of their places: the town its name matches, or its country, where the
country has one zone. Where none gives a zone, the zone starts empty, as today. The traveller is
always free to choose another zone, and the address never changes it.

## Consequences

- `planner/itinerary` holds the address with the firm item, in its text form, and refuses one that
  is empty or longer than a line. `spec/planner/itinerary.md` gives how.
- An older version of the web app cannot read a firm item holding an address. The online side
  stops answering any version older than the one that can, from the deploy that accepts one.
- The web app's screens show the address, and fill in the zone, in Milestone Web-2.4.
- The address is text a traveller wrote, like a page's text. The maps app sees it only when the
  traveller taps it.
- A hike on a day with no stretch, or on a day in a country with several zones and no town matched,
  still starts with its zone empty.

## Alternatives considered

- **An address that fills in the zone.** Finding where an address is needs a connection and a
  service to look it up, and the planner works with no connection.
- **An address and a town, the town from the list of places.** The town would fill in the zone,
  but every firm item's form would carry two fields where one says where it happens.
- **A place, as travel holds, with a country and a name.** A place's name is checked against no
  list either, and a country chosen for each hike or dinner adds a field the stretch already
  gives.
- **The address as a page of its own.** A page for every restaurant is the work the beta tester
  asked to be spared.
- **A link to a map, with no address stored.** A link written by hand is harder to type than an
  address, and shows no address on the card.
