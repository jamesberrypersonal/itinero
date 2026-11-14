# ADR-0014 — A trip opens on a home page for each traveller, with their own dates and the country they are in

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** planner, web

## Problem

The planner, the system that holds each trip, gives a trip a calendar, bookings and pages of
research. Nothing said what a traveller sees first on opening a trip. The calendar cannot be it.
It shows where the travellers expect to be on every day, and a traveller sees it only once an admin
grants it (ADR-0013, a trip's bookings have a page of their own, and its calendar is seen only by
the travellers an admin chooses). An admin is a traveller who may manage the trip.

What a traveller wants first changes as the trip goes on. Before it, they want to know how long is
left. During it, they want to know which day of the trip it is, what is booked for today, and the
research for where they are. Travellers do not all travel for the whole trip. A companion may join
for one week of a month.

## Decision

A trip opens on a home page, which each traveller sees for themselves.

**A trip has dates, and so does each traveller.** The traveller who creates a trip sets its first
and last dates. Each traveller, on joining the trip, sets their own first and last dates, which
fall within the trip's. A traveller who sets none takes the trip's dates. A traveller can change
their own dates at any time, and the creator can change the trip's.

**The home page follows the traveller's own dates.** Before their first date, it says how many days
are left until it. During their dates, it says which day of their trip today is, such as day 5 of
12. After their last date, it says their trip is over.

**It lists the traveller's bookings for today, and the next ones.** A booking is something booked
and fixed to a date, such as a flight or a tour, and each booking names the travellers it is for.
The home page lists only the bookings for the traveller who is looking.

**It links to the page of the country the traveller is in.** The phone works out which country it is
in from its own location, on the phone, with or without a connection. The location never leaves the
phone, and no other traveller sees it. The home page links to the trip's page for that country, the
page the planner made for it when the trip was created, if the traveller may see it. A traveller who
does not let the app read the phone's location sees no country.

## Consequences

- The planner holds a trip's first and last dates, and each traveller's own. It refuses a
  traveller's dates outside the trip's, and refuses to change the trip's dates where a traveller's
  would then fall outside them, naming each such traveller.
- `planner/pages`, the component that holds a trip's pages, remembers the country of each page it
  makes for a country, even after the page is renamed or moved. `spec/planner/pages.md` changes to
  hold it.
- The web app, the system travellers use on a computer or a phone, shows the home page. It works
  out the phone's country on the phone, and needs a map of the world's country borders held there.
- Nothing on the home page comes from the calendar. A traveller who may not see the calendar sees
  no part of the plan on it.
- The home page knows the country, not the city, so it cannot yet link to a city's page. Finding
  the city is future work.

## Alternatives considered

- **The trip's span worked out from its calendar.** A traveller who may not see the calendar would
  learn its first and last dates from it.
- **The trip's span worked out from its bookings.** A trip whose first days hold no booking would
  seem to start later than it does.
- **One set of dates for every traveller.** A companion joining for one week would be told the day
  of a trip they are not on.
- **The traveller's location sent to Itinero, to find the city.** Every traveller's location would
  leave their phone, for a link they can find themselves.
