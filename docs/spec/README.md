# Specifications

What each thing built in this workspace does, written so that someone who has not read the code
could build it. The folders follow the same systems as `requirements/`.

| Folder | Its documents specify |
|---|---|
| [planner/](planner/README.md) | The trip planner: each trip, the calendar it is pencilled in on, its firm dates, and its research pages |
| [access/](access/README.md) | Accounts, invitations to a trip, and who may see and change each of its pages |
| [web/](web/README.md) | The app travellers use on a computer or a phone, including reading a trip with no connection |
| [bookings/](bookings/README.md) | A trip's bookings, such as flights, stays and tours, each for the travellers it names, and the page that lists them |
| [shared/](shared/README.md) | Components that several systems use, or that no system owns, and the artefacts they write |

## Words

The words below are used across the specifications without being defined in each document
(ADR-0022, each tree's index defines the words its documents share).

| Word | Means |
|---|---|
| Porcelain, Plumbing | The labels that open the subsections of a specification's section 4. Porcelain is what callers use. Plumbing is the machinery beneath it, for those who change it |
| Identifier | The name a requirement's heading opens with, such as `ACC-F2`. `components.md` gives each prefix and the document it belongs to |
| Package | One unit npm builds and installs, such as `@itinero/pages`. A component's code is one package, or part of one |
| Text form | The JSON a package writes one of its values as, to store or send it, and reads back unchanged |
| Refusal | A package's or a request's answer when it will not do what it was asked: a `code`, a `message` in one English sentence, and `details` where its table names them |
| Device | A phone or a computer a traveller signs in on |
| Online side | The part of Itinero that runs on Cloudflare's servers, not on a device. It holds the copy of each trip that every change is applied to, the accounts, and who is on each trip |
| Worker | A program Cloudflare runs on its servers for each request that arrives. Itinero's online side is one Worker |
| Durable Object | A program Cloudflare runs in one place, with its own SQLite database, which handles one request at a time. Each trip held online is one Durable Object |
| D1 | Cloudflare's hosted SQLite database, which holds the accounts and who is on each trip |
| Wrangler | Cloudflare's tool that runs a Worker, its Durable Objects and D1 on a developer's machine, and deploys them |
| just | The command runner the repository uses. A recipe such as `just test-pages` runs from anywhere in the repository |
| Copy | A trip as one place holds it: the copy held online, or a device's copy, which its traveller reads with no connection |
| Catch up | To bring a device's copy of a trip up to date with the copy held online |
| Sequence | The count of changes applied to a trip. A device whose copy holds an older count catches up |
| Grant | The access a traveller has been given to a trip, its calendar or a page: edit, view, or none. A trip's grants are the access of every traveller on it |
| Graveyard | The pages travellers have deleted from a trip, kept so that an admin can restore them. A deleted page is buried |
