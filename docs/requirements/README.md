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
