# The live work list

What needs active work, and what waits on a decision. `documentation-system.md` gives the list's
rules. When an item is done, it leaves this list for `CHANGELOG.md` in the commit that finishes it.

*Next free:* TODO-12

## Tags

| Tag | Means |
|---|---|
| access | Accounts, invitations and permissions |
| bookings | A trip's bookings, such as flights, stays and tours, each for the travellers it names, and the page that lists them |
| planner | The trip planner |
| planner/itinerary | The itinerary: a trip's pencilled stretches and firm items |
| planner/pages | The pages of a trip |
| shared/doc-check | The documentation checker |
| shared/doc-scaffold | The scaffolder that starts new documents |
| shared/trip-time | Local dates and times, and time zones |
| web | The web app, on a computer and on a phone |
| docs | The documentation system, and the tools authors use with it |

## Items

### TODO-4 — Let a traveller change a trip while offline

*Tags:* web, planner/itinerary
*Written:* 2026-11-11

*Problem:* A traveller with no connection can read a trip but cannot change it.

*Reason:* ADR-0004 (a trip can be read without a connection, but changed only with one) kept the
trip held online as the only copy anyone changes. That way, two changes never need reconciling.

*Proposal:* Decide how changes made on two phones while apart are reconciled. Record it in a
decision record that supersedes ADR-0004.

*Releases:* Nothing is planned for it yet.

### TODO-5 — Find a place's time zone from the place itself

*Tags:* shared/trip-time
*Written:* 2026-11-12

*Problem:* trip-time takes the time zone of each date and time from the component that gives it
the date or time. It cannot find the time zone of a place such as Lyon or Narita airport.

*Reason:* The first requirements for trip-time leave the lookup to the caller
(`SHR:TRIP-TIME-NR1`). A lookup that works offline needs a list of places held on the phone.

*Proposal:* Decide where a place's time zone comes from, and which component finds it. Then write
its requirements.

*Releases:* Nothing is planned for it yet.

### TODO-6 — Show a time in another time zone

*Tags:* shared/trip-time
*Written:* 2026-11-12

*Problem:* A traveller sees each time only in the local time of its place, and cannot see it in
another time zone, such as their home's.

*Reason:* Converting imprecise values, such as an afternoon in Paris seen in Tokyo time, raised
questions that were left for later (`SHR:TRIP-TIME-NR2`).

*Proposal:* Decide which time zones a traveller can pick, and how each kind of value converts.
Then add the requirements to trip-time.

*Releases:* Nothing is planned for it yet.

### TODO-7 — Write dates and times in languages other than English

*Tags:* shared/trip-time
*Written:* 2026-11-12

*Problem:* trip-time writes dates and times only in English.

*Reason:* The first requirements for trip-time keep to English (`SHR:TRIP-TIME-NR3`). Which
other languages travellers need is not known yet.

*Proposal:* Decide which languages to support first, and add the requirements to trip-time.

*Releases:* Nothing is planned for it yet.

### TODO-11 — Find the city a traveller is in, for the home page

*Tags:* planner, web
*Written:* 2026-11-14

*Problem:* A trip's home page links to the page for the country the traveller is in, but not to the
page for their city.

*Reason:* The phone works out its country from its own location, with a small map of country
borders held on it (ADR-0014, a trip opens on a home page for each traveller). Finding the city
needs a far larger list of places on the phone, and pages that remember the place they are about.
The country was enough to start with (`PLN-NR7`).

*Proposal:* Decide where the list of places comes from, and how a page records its place. Then
add the requirements to the planner and the web app.

*Releases:* Nothing is planned for it yet.
