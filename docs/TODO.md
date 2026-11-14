# The live work list

What needs active work, and what waits on a decision. `documentation-system.md` gives the list's
rules. When an item is done, it leaves this list for `CHANGELOG.md` in the commit that finishes it.

*Next free:* TODO-11

## Tags

| Tag | Means |
|---|---|
| access | Accounts, invitations and permissions |
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

### TODO-10 — Decide what a trip opens on

*Tags:* planner, web
*Written:* 2026-11-14

*Problem:* Nothing says what a traveller sees first on opening a trip, since the calendar is not
its centre (ADR-0010, a trip's calendar is pencilled in).

*Reason:* A first idea is a home page for the trip. Before the trip, it would count down to the
first day. During the trip, it would say which day of the trip today is. It would also list the
next firm items, such as a booked flight, and link to the pages about the place the traveller is
in. The idea was left for later, because nothing in Milestone Planner-0.1 depends on it.

*Proposal:* Decide what a trip opens on, and add its requirements to the planner and the web app.

*Releases:* Nothing is planned for it yet.
