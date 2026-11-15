# Requirements

What each system, component and concern promises. Every requirement is numbered and testable, and
none names a mechanism. Each document owns the prefix that the component registry, `components.md`,
gives it.

## Folders

| Folder | Its documents promise about |
|---|---|
| [planner/](planner/README.md) | The trip planner: each trip, its pencilled calendar, its firm items, and its pages |
| [access/](access/README.md) | Accounts, invitations to a trip, and who may see and change each of its pages |
| [bookings/](bookings/README.md) | A trip's bookings, such as flights, stays and tours, each for the travellers it names, and the page that lists them |
| [web/](web/README.md) | The app travellers use on a computer or a phone, including reading a trip with no connection |
| [shared/](shared/README.md) | Components that several systems use, or that no system owns |

## People

| Role | Who |
|---|---|
| Author | Anyone who adds a document to the vault or changes one |
| Traveller | Anyone who plans a trip in Itinero, or follows one on the way |
| Admin | A traveller who may manage a trip: the traveller who created it, and anyone another admin makes one |
| Rules keeper | Whoever changes `documentation-system.md`, and the checker that enforces it, through a decision record scoped `workspace` |

## Words

The words below are used across the requirements without being defined in each document
(ADR-0022, each tree's index defines the words its documents share).

| Word | Means |
|---|---|
| Identifier | The name a requirement's heading opens with: its document's prefix, then `F` for a function, `NFR` for a quality, or `NR` for something not promised, and a number. `components.md` gives each prefix, such as `ACC` for `access/access.md` and `ACC:MEMBERSHIP` for `access/membership.md` |
| Verification | The list under a requirement of the checks that prove it is met |
| Device | A phone or a computer a traveller signs in on |
| Online side | The part of Itinero that runs on Cloudflare's servers, not on a device. It holds the copy of each trip that every change is applied to, the accounts, and who is on each trip |
| Copy | A trip as one place holds it: the copy held online, or a device's copy, which its traveller reads with no connection |
| Catch up | To bring a device's copy of a trip up to date with the copy held online |
| Stretch | A place and the dates a traveller expects to be there, pencilled in on a trip's calendar |
| Firm item | Something decided but not booked, fixed to a date, such as a day to move on or a bus not yet booked |
| Booking | Something booked, such as a flight, a stay or a tour, for the travellers it names. A trip's bookings have a page of their own, and the calendar shows them too |
| Page | A page of research a traveller writes for a trip. A trip's pages form a tree: each sits under one other page, its parent, or at the top of the trip. A branch is a page and every page beneath it |
| Graveyard | The pages travellers have deleted from a trip, kept so that an admin can restore them |
| Access | What a traveller may do with a trip, its calendar or a page: edit, view, or none |
| Grant | The access a traveller has been given. A trip's grants are the access of every traveller on it |
