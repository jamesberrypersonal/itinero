# Roadmaps

The order each system's work happens in. Each roadmap opens with what has been done, milestone by
milestone and newest first, then lists the work still owed, in order. `documentation-system.md`
sets the rules every roadmap keeps.

A system's roadmap also plans the work on its components. Work on a shared component is planned in
the roadmap of the first system that needs it.

| Roadmap | Plans | Kept by |
|---|---|---|
| [planner.md](planner.md) | The trip planner, its itinerary and pages, and the dates and times they hold | James Berry |
| [access.md](access.md) | Accounts, invitations, and who may see and change each page of a trip | James Berry |
| [web.md](web.md) | The app travellers use on a computer or a phone, including reading a trip offline | James Berry |
| [bookings.md](bookings.md) | A trip's bookings, such as flights, stays and tours, each for the travellers it names, and the page that lists them | James Berry |

## Words

The words below are used across the roadmaps without being defined in each one (ADR-0022, each
tree's index defines the words its documents share).

| Word | Means |
|---|---|
| Phase | A stage of a system's work with one aim, numbered from 0. Phase 0 designs a system, and Phase 1 builds it |
| Milestone | A stable point within a phase, reached in order, named such as Milestone Planner-1.2 |
| Registered | Added to `components.md`, the component registry, which every system and component is listed in before any document names it |
| Verification | The list under each requirement of the checks that prove it is met. A milestone is complete once those checks pass |
| Online side | The part of Itinero that runs on Cloudflare's servers, as one Worker, a program Cloudflare runs for each request |
| Admin | A traveller who may manage a trip |
