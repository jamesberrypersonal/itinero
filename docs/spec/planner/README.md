# Planner specifications

How the planner system's components are built.

| Document | Is | Runs |
|---|---|---|
| [checklists.md](checklists.md) | The package that holds each traveller's checklists and templates, applies each change, and copies one into another | In the web app, and on the online side |
| [itinerary.md](itinerary.md) | The package that holds a trip's pencilled stretches and firm items, applies each change, and lays out its days | In the web app, and on the server that holds each trip online |
| [library.md](library.md) | Each traveller's library of checklist templates, kept online outside any trip, in a table of the online side's D1 database | Two tables of the online side's D1 database, on Cloudflare Workers |
| [pages.md](pages.md) | The package that holds a trip's pages, their tree, links and graveyard, and searches them | In the web app, and on the server that holds each trip online |
| [trip-host.md](trip-host.md) | The copy of each trip held online, in a Durable Object of its own, which applies every change and keeps each traveller's devices up to date | A Durable Object of the online side, on Cloudflare Workers |

`checklists.md`, `itinerary.md` and `pages.md` specify packages, which run in the web app and on
the online side. `library.md` and `trip-host.md` specify programs: the parts of the online side
that hold each traveller's templates and each trip.
