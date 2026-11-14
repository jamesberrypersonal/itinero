# ADR-0019 — A place's time zone is filled in from a list of places, kept on the phone one country at a time

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** web

## Problem

Every time Itinero holds is in the local time of the place it happens, with that place's time zone,
such as `America/Santiago` for a flight leaving Santiago. `shared/trip-time`, the component that
holds dates and times, takes each value's zone from its caller, and finds no zone itself
(`SHR:TRIP-TIME-NR1`). The web app, which travellers use on a phone or a computer, therefore asked
the traveller to choose a zone by hand for every booking and every firm item with a time. A flight
of two legs needed four.

Finding a zone from a place needs a list of places, each with its time zone. The list must be on
the phone, because a traveller enters and reads times with no connection (ADR-0004, a trip can be
read without a connection, but changed only with one). A list of the world's towns large enough to
hold a village or a trailhead is several megabytes, while the web app's first download is held to
3 megabytes (`WEB-NFR2`).

## Decision

**The web app fills in a place's time zone from a list of places it keeps on the device.** When a
traveller enters an airport code or a town the list holds, the zone is filled in beside the time.
The traveller can still choose another zone, and chooses one by hand for a place the list does not
hold.

**The list is in two parts, and a device fetches only what its trips need:**

- **every airport with a three-letter code**, in one file for the world, since a flight leaves from
  outside a trip's countries as often as inside them
- **the towns of 1,000 people or more, one file for each country.** A device fetches the file of
  each country its trips visit. Online, a traveller can fetch another country's file by choosing it

**The files are fetched in the background, after sign-in**, never as part of the app's first
download. A device keeps them, and fetches them again only when Itinero publishes a newer list.

**The towns come from GeoNames**, a public database of the world's places, each with its country,
population and time zone, published under the Creative Commons Attribution 4.0 licence. **The
airports come from OurAirports**, a public-domain list of the world's airports with their codes and
positions. OurAirports gives no time zone, so each airport takes the zone of the nearest GeoNames
town in its own country.

## Consequences

- `web/places`, a new component of the web app, holds the list on the device, fetches each
  country's file, and finds a place's zone. Its specification gives the build that makes the files.
- A traveller enters a flight from its airport codes, and a bus from its towns, without choosing a
  zone, with or without a connection.
- A trip through Chile and Argentina fetches the airports and two countries, well under a megabyte.
  The United States is the largest country, at about half a megabyte.
- A traveller who adds a booking in a country none of their trips visit, while offline, chooses the
  zone by hand until the device next connects.
- Itinero shows that its place data comes from GeoNames, as its licence requires.
- An airport near a time-zone border within its country, such as in the United States or
  Australia, can take a neighbouring zone. The traveller sees the zone filled in, and corrects it.
- `shared/trip-time`, `planner/itinerary` and the bookings system still take each zone from their
  caller. Only the web app finds it.

> [!NOTE]
> **History.** Until this record, the web app asked a traveller to choose every zone by hand.

## Alternatives considered

- **Every town of the world on every device.** Several megabytes, most of it for countries no trip
  of the traveller visits.
- **Towns of 15,000 people or more, for the whole world.** About a megabyte, and it still misses the
  small towns a bus or a trek starts from.
- **Asking the online side for each place's zone.** It fails with no connection, where a traveller
  enters a booking at a bus station, and it tells the online side every place a traveller types.
- **Airports' zones from a map of time-zone borders.** Exact near borders, but the best such map is
  under a licence whose terms would reach the list built from it. A traveller corrects the rare
  airport the nearest town gets wrong.
