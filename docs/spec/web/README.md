# Web specifications

How the web system's components are built.

| Document | Is | Runs |
|---|---|---|
| [screens.md](screens.md) | What travellers see and use: the home page, the calendar, the bookings page, the pages of research and the trip's members | `@itinero/web`, in the traveller's browser |
| [shell.md](shell.md) | The installable app itself: launching with no connection, adding it to a phone's home screen, and keeping the time-zone rules up to date | `@itinero/web`, in the traveller's browser |
| [trip-store.md](trip-store.md) | Each trip's copy on a device: catching it up, telling it of changes as they happen, sending changes, and deleting it on sign-out | `@itinero/web`, in the traveller's browser |

All three are parts of one program, the web app, built as the package `@itinero/web`. The shell
starts it and keeps it offline, the trip store keeps each trip's copy, and the screens draw it.
