# Bookings specifications

How the bookings system's components are built.

| Document | Is | Runs |
|---|---|---|
| [activity.md](activity.md) | A tour, a ticket or a table, at one place, on a date and perhaps at a time | `@itinero/bookings`, a TypeScript package, on the server and in the browser |
| [flight.md](flight.md) | A flight, in one or more legs, each leaving and arriving in its own airport's local time | `@itinero/bookings`, a TypeScript package, on the server and in the browser |
| [journey.md](journey.md) | A train, a bus, a ferry or a hired car, from one place to another, with a time at each end | `@itinero/bookings`, a TypeScript package, on the server and in the browser |
| [list.md](list.md) | A trip's bookings: adding, changing and removing each one, the travellers it names, and the order they happen in | `@itinero/bookings`, a TypeScript package, on the server and in the browser |
| [stay.md](stay.md) | One or more nights' stay, such as a hotel or a flat, from check-in to check-out | `@itinero/bookings`, a TypeScript package, on the server and in the browser |

All five are parts of one program, the package `@itinero/bookings`, which other components call.
`list.md` holds what every booking has, and the other four each hold one kind of booking.
