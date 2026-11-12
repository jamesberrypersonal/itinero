# The live work list

What needs active work, and what waits on a decision. `documentation-system.md` gives the list's
rules. When an item is done, it leaves this list for `CHANGELOG.md` in the commit that finishes it.

*Next free:* TODO-9

## Tags

| Tag | Means |
|---|---|
| access | Accounts, invitations and permissions |
| planner | The trip planner |
| planner/itinerary | The itinerary model: trips, stops, days and the travel between them |
| planner/pages | The pages of a trip |
| shared/doc-check | The documentation checker |
| shared/doc-scaffold | The scaffolder that starts new documents |
| shared/trip-time | Local dates and times, and time zones |
| web | The web app, on a computer and on a phone |
| docs | The documentation system, and the tools authors use with it |

## Items

### TODO-2 — Decide whether a trip's pages form a tree

*Tags:* planner/pages
*Written:* 2026-11-11

*Problem:* Nothing says whether a page of a trip can hold other pages, such as a country's page
holding a page for each city.

*Reason:* Travellers write their research by hand, and a tree is one way to organise it. The idea
is liked but not decided.

*Proposal:* Decide between a flat set of pages and a tree, and record the choice in a decision
record scoped `planner/pages`.

*Releases:* Milestone Planner-0.2.

### TODO-3 — Decide whether access to a page passes to the pages below it

*Tags:* access, planner/pages
*Written:* 2026-11-11
*Blocked:* TODO-2

*Problem:* If pages form a tree, nothing says whether a traveller who may see a page may also see
the pages below it.

*Reason:* An admin sets each traveller's access page by page. Whether that access passes down a
tree was left for later, and it matters only if there is a tree.

*Proposal:* Once the pages are decided, decide whether access passes down. Record the choice in a
decision record scoped `access` and `planner/pages`.

*Releases:* Milestone Access-0.1.

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

### TODO-8 — Start the documents of a component that is already registered

*Tags:* shared/doc-scaffold
*Written:* 2026-11-12

*Problem:* doc-scaffold cannot start the documents of a component that is registered but has none,
such as `shared/trip-time`, `planner/itinerary` or `planner/pages`.

*Reason:* `just new-component` registers a component and writes its documents in one step, so it
refuses an address that is already registered (`SHR:DOC-SCAFFOLD-F3`, a refused command writes
nothing, and says why). Those three components were
registered before doc-scaffold existed.

*Proposal:* Add a command, such as `just new-docs`, that writes the skeleton requirements and
specification for a registered component with neither, and their index rows. Change doc-scaffold's
requirements and specification to promise it.

*Releases:* Nothing is planned for it yet.
