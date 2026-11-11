# The component registry

Every system, component and concern in this workspace, with the requirement prefix each one owns
and the packages that implement it. `documentation-system.md` says what each column holds. A
system, component or concern is added here before any document names it.

## Systems

| System | Prefix | Telemetry namespace | Outside the vault | Is |
|---|---|---|---|---|
| planner | PLN | | | The trip planner: each trip, the stops it visits, the days spent at each, and the travel between them |
| access | ACC | | | Accounts, invitations to a trip, and who may see and change each of its pages |
| web | WEB | | | The app travellers use on a computer or a phone, including reading a trip with no connection |

## Components

| Component | System | Prefix | Packages | Outside the vault | Is |
|---|---|---|---|---|---|
| itinerary | planner | PLN:ITINERARY | | | How a trip, its stops, its days and the travel between stops are stored and changed |
| pages | planner | PLN:PAGES | | | The pages of a trip, where travellers write up their research by hand |
| [doc-check](spec/shared/doc-check.md) | shared | SHR:DOC-CHECK | | | The checker that holds every document in this vault to the documentation system |
| trip-time | shared | SHR:TRIP-TIME | | | Dates and times in the local time of the place they happen, and the time zones between places |

## Booking kinds

| Kind | Prefix | Imported | Manual | In `@itinero/bookings` | Is |
|---|---|---|---|---|---|

## Cross-cutting concerns

| Concern | Prefix | Covered in each specification at | Is |
|---|---|---|---|
