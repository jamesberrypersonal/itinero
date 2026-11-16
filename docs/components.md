# The component registry

Every system, component and concern in this workspace, with the requirement prefix each one owns
and the packages that implement it. `documentation-system.md` says what each column holds. A
system, component or concern is added here before any document names it.

## Systems

| System | Prefix | Outside the vault | Is |
|---|---|---|---|
| planner | PLN | | The trip planner: each trip, the calendar it is pencilled in on, its firm dates, and its research pages |
| access | ACC | | Accounts, invitations to a trip, and who may see and change each of its pages |
| web | WEB | | The app travellers use on a computer or a phone, including reading a trip with no connection |
| bookings | BKG | | A trip's bookings, such as flights, stays and tours, each for the travellers it names, and the page that lists them |

## Components

| Component | System | Prefix | Packages | Outside the vault | Is |
|---|---|---|---|---|---|
| [itinerary](spec/planner/itinerary.md) | planner | PLN:ITINERARY | `@itinero/itinerary` | | How a trip's pencilled stretches and firm items are stored and changed |
| [pages](spec/planner/pages.md) | planner | PLN:PAGES | `@itinero/pages` | | The pages of a trip, where travellers write up their research by hand |
| [trip-host](spec/planner/trip-host.md) | planner | PLN:HOST | | | The copy of each trip held online, in a Durable Object of its own, which applies every change and keeps each traveller's devices up to date |
| [accounts](spec/access/accounts.md) | access | ACC:ACCOUNTS | | | Travellers' accounts, and signing in with a Google account |
| [membership](spec/access/membership.md) | access | ACC:MEMBERSHIP | | | Who is on each trip: its admins, the invitations that bring travellers in, and removing them |
| [permissions](spec/access/permissions.md) | access | ACC:PERMISSIONS | | | What each traveller may see and change of a trip's pages, calendar and bookings |
| [places](spec/web/places.md) | web | WEB:PLACES | | | The places a device knows the time zone of: every airport, and the towns of each country its trips visit |
| [screens](spec/web/screens.md) | web | WEB:SCREENS | | | What travellers see and use: the home page, the calendar, the bookings page, the pages of research and the trip's members |
| [shell](spec/web/shell.md) | web | WEB:SHELL | | | The installable app itself: launching with no connection, adding it to a phone's home screen, and keeping the time-zone rules up to date |
| [trip-store](spec/web/trip-store.md) | web | WEB:STORE | | | Each trip's copy on a device: catching it up, telling it of changes as they happen, sending changes, and deleting it on sign-out |
| [list](spec/bookings/list.md) | bookings | BKG:LIST | `@itinero/bookings` | | A trip's bookings: adding, changing and removing each one, the travellers it names, and the order they happen in |
| [doc-check](spec/shared/doc-check.md) | shared | SHR:DOC-CHECK | | | The checker that holds every document in this vault to the documentation system |
| [doc-scaffold](spec/shared/doc-scaffold.md) | shared | SHR:DOC-SCAFFOLD | `doc-scaffold` | | The scaffolder that starts a new component, system, decision record or guide, with every row that names it |
| [trip-time](spec/shared/trip-time.md) | shared | SHR:TRIP-TIME | `@itinero/trip-time` | | Dates and times in the local time of the place they happen, and the time zones between places |

## Booking kinds

| Kind | Prefix | Imported | Manual | In `@itinero/bookings` | Is |
|---|---|---|---|---|---|
| flight | BKG:FLIGHT | no | yes | `FlightBooking` | A flight, in one or more legs, each leaving and arriving in its own airport's local time |
| stay | BKG:STAY | no | yes | `StayBooking` | One or more nights' stay, such as a hotel or a flat, from check-in to check-out |
| journey | BKG:JOURNEY | no | yes | `JourneyBooking`, not built yet | A train, a bus, a ferry or a hired car, from one place to another, with a time at each end |
| activity | BKG:ACTIVITY | no | yes | `ActivityBooking`, not built yet | A tour, a ticket or a table, at one place, on a date and perhaps at a time |

## Cross-cutting concerns

| Concern | Prefix | Covered in each specification at | Is |
|---|---|---|---|
