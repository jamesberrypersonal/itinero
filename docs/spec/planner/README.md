# Planner specifications

How the planner system's components are built.

| Document | Is | Runs |
|---|---|---|
| [itinerary.md](itinerary.md) | The package that holds a trip's pencilled stretches and firm items, applies each change, and lays out its days | In the web app, and on the server that holds each trip online |
| [pages.md](pages.md) | The package that holds a trip's pages, their tree, links and graveyard, and searches them | In the web app, and on the server that holds each trip online |
| [trip-host.md](trip-host.md) | The copy of each trip held online, in a Durable Object of its own, which applies every change and keeps each traveller's devices up to date | A Durable Object of the online side, on Cloudflare Workers |

`itinerary.md` and `pages.md` specify packages, which run in the web app and on the online side.
`trip-host.md` specifies a program: the part of the online side that holds each trip.
