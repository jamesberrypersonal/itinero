# The places

What the component `web/places` promises to `web/screens`, the component that shows a trip, and
through it to travellers. The places component holds, on a device, the places whose time zone it
knows: every airport with a three-letter code, and the towns of each country the device's trips
visit. It finds a place a traveller types, with its time zone, with or without a connection. The
component registry, `components.md`, gives it the prefix `WEB:PLACES`.

A trip's countries are those of its pages made for a country, and of the stretches pencilled on its
calendar where the traveller may see the calendar. A device is a phone or a computer a traveller
signs in on. A time zone is named as `shared/trip-time`, the component that holds dates and times,
names it, such as `America/Santiago`.

---

## Functional requirements

### WEB:PLACES-F1 — An airport's code, or a town's name, gives the place and its time zone, with no connection

Given an airport's three-letter code, the places component gives the airport, its town, its country
and its time zone. Given part of a town's name, it gives the towns of the countries it holds that
match, most people first, each with its country and time zone. It does both with no connection, for
every airport, and for the towns of each country it holds. ^web-places-f1

- **Verification:** on a device holding the places of Chile, with no connection,
    - give `SCL`, and confirm it gives Santiago's airport, in Chile, in `America/Santiago`
    - give `MAD`, and confirm it gives Madrid's airport, in `Europe/Madrid`
    - give `Puerto Nat`, and confirm Puerto Natales comes first, in `America/Punta_Arenas`
    - give `Santiago`, and confirm Santiago, the capital, comes before smaller towns of that name
    - give a town of Peru, which the device does not hold, and confirm nothing is given

> **What does this buy?** A traveller enters a flight from its codes, and a bus from its towns,
> without choosing a time zone, even at a bus station with no signal (`WEB-F9`).

> **What about accents and capitals?** They are ignored when matching, so `puerto natales` and
> `Puerto Natales` find the same town, and `Valparaiso` finds Valparaíso.

### WEB:PLACES-F2 — A device holds the towns of every country its trips visit, fetched in the background

While a device is online, the places component fetches the towns of each country its trips visit,
and the airports, in the background, and keeps them. It fetches a country's towns again only when
Itinero publishes a newer list. Online, a traveller can also fetch the towns of any other country. ^web-places-f2

- **Verification:** with a traveller signed in on a new device, on a trip visiting Chile,
    - wait a minute online, take the device offline, and confirm Chile's towns and every airport are
      held
    - add a stretch in Argentina, connect the device, and confirm Argentina's towns are then held
    - online, fetch Peru by choosing it, and confirm Peru's towns are held

> **What does this buy?** A traveller has the places of their trip before they are on the road,
> and the app's first download stays small (`WEB-NFR2`, ADR-0019, a place's time zone is filled in
> from a list of places, kept on the phone one country at a time).

> **Are the places deleted on sign-out?** No. They hold nothing of any traveller, and the next
> traveller to sign in on the device may use them.

---

## Non-functional requirements

### WEB:PLACES-NFR1 — A place is found as the traveller types

The places component gives the matching towns within 50 milliseconds of each letter typed, on a
phone holding the towns of the United States. ^web-places-nfr1

- **Verification:** on such a phone, holding the towns of the United States,
    - type `Springfield` one letter at a time, and confirm each answer is given within 50
      milliseconds

> **What does this buy?** Suggestions keep up with the traveller's typing, with the largest country
> held.

### WEB:PLACES-NFR2 — The airports, and each country's towns, are small

The airports are at most 200 kilobytes, and each country's towns at most 600 kilobytes, compressed
as they are sent. ^web-places-nfr2

- **Verification:**
    - measure each file as the web app serves it, and confirm each is within its limit

> **What does this buy?** A trip's places download in moments on a roaming connection, and take
> little of the phone's storage.

---

## Non-requirements

| Identifier | The places component does not | Because |
|---|---|---|
| **WEB:PLACES-NR1** | Hold towns of fewer than 1,000 people | Every country's file would grow many times over. A traveller chooses the zone of a smaller place by hand |
| **WEB:PLACES-NR2** | Find the town the phone is in | A trip's pages do not record the place they are about, so there is nothing to link to (`WEB-NR7`) |
| **WEB:PLACES-NR3** | Send a place a traveller types to the online side | A place a traveller types says where they are going |

^web-places-nr
