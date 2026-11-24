# The library

**Assumes** [library.md](../../requirements/planner/library.md) — what the library promises, and the templates and devices it works with.

## 1. Purpose

The library is the part of Itinero's online side that holds each traveller's checklist templates,
outside any trip. It adds, changes and deletes a traveller's templates as they ask, and catches each
of their devices up on what changed. Every template it holds belongs to one traveller, and reaches
no one else (ADR-0024, a traveller's checklists are their own).

## 2. Scope

The library covers each traveller's templates, the changes to them, deleting one, and catching a
device up.

Three things act on it:

- **The web app**, the system travellers use on a computer or a phone, sends each request of §3.2.
  Its component `web/trip-store` keeps the copy of the library on each device.
- **`access/accounts`**, the component that holds each traveller's account, names the account
  behind every request, with `whoSent`.
- **`planner/checklists`**, the component that holds checklists and templates, makes each template,
  applies each change, copies a checklist, and places a template among the others.

Deliberately absent:

- checking what a template holds, which `planner/checklists` does
- copying a template into a trip, which `planner/trip-host`, the component holding each trip online,
  does with the template the device sends it
- telling a device with the library open of a change at once
- sharing a template with another traveller (ADR-0024)
- keeping a deleted template for restoring (ADR-0024)
- accepting a change from a device with no connection (ADR-0004, a trip is read-only offline)

The library is part of the same Cloudflare Worker as `access/accounts`, a program Cloudflare runs
on its servers for each request that arrives. It holds its records in the same D1 database,
Cloudflare's hosted SQLite database (ADR-0015, Itinero's online side runs on Cloudflare's free plan,
and travellers sign in with Google alone).

## 3. Interface

### 3.1 User interface

None. The web app shows each traveller's library, in the section of its own that holds their
checklists.

### 3.2 Application interface

The library answers four requests over HTTPS, each with a JSON body, from a device signed in through
`access/accounts`. A request with no session is refused by `access/accounts` with `no-session`, as
`spec/access/accounts.md` §4.3 gives. A refusal gives a status of 400, 403, 404 or 409, and a JSON
body `{ "code": ..., "message": ..., "details": ... }`. The `message` is one English sentence the
web app may show.

| Request | Body | Gives |
|---|---|---|
| `POST /api/library/sync` | `{ "since": ... }` | The library's sequence, and each template, with the text of each changed since (§4.4) |
| `POST /api/library/templates` | `{ "id": ..., "title": ... }`, or `{ "id": ..., "from": ... }` | `{ "sequence": ... }`, with status 201 (§4.2) |
| `POST /api/library/changes` | `{ "change": ... }` | `{ "sequence": ... }` (§4.3) |
| `DELETE /api/library/templates/{id}` | None | `{ "sequence": ... }` (§4.5) |

`from` is a checklist, and `change` a change, each in the checklists' text form, which
`spec/planner/checklists.md` §5.1 gives.

| Refusal code | Status | When |
|---|---|---|
| `unknown-template` | 404 | A change or a delete naming a template the traveller's library does not hold, whether or not another traveller's holds one of that identifier |
| `not-yours` | 403 | A `from` whose owner is not the account that sent it |
| `duplicate-template` | 409 | A new template whose identifier the traveller's library already holds |
| `library-full` | 409 | A new template for a library that holds 100 |
| `busy` | 409 | A request whose write found the library changed by another request three times running (§4) |
| `malformed` | 400 | A body not in the forms above |

Every refusal from `planner/checklists` is returned with its own code unchanged, with status 409,
such as `bad-title` or `template-tick`.

### 3.3 Programming interface

None. Nothing else in the online side calls the library. A device reaches it through its requests
(§3.2).

### 3.4 Systems this drives

The library drives D1, Cloudflare's hosted SQLite database, which the Worker reaches through a
binding, a name in its Wrangler configuration. A Worker sends D1 one statement at a time, or a
batch: a list of statements D1 runs in order as one transaction, all or none. D1 runs one batch at a
time, so no batch sees another half done. A statement and a batch report how many rows each
statement changed. Two requests to the Worker may still run at once, and each may read the library
before the other writes. §4 gives how the library keeps them apart.

Cloudflare's free plan limits each day's use of D1 by the rows read, the rows written and the data
stored. Cloudflare's documents for D1 give the limits and the full interface.

## 4. Behaviour

Behaviour crossing every operation:

- **Every request names its account.** The library calls `access/accounts`' `whoSent`, and works
  only on the library of the account it gives. Nothing in a request names any other library.
- **The sequence.** Each traveller's library has a `sequence`, which starts at 0. Every request
  that changes the library raises it by one, and marks each template it writes with the new
  sequence, as that template's `changed`.
- **Each write is checked against what was read.** A request first reads the library's `sequence`,
  and what else it needs. It then writes in one batch, whose every statement holds only where the
  `sequence` is still the one read. The batch raises the `sequence` last, so either every statement
  holds or none does. Where none holds, another request changed the library in between, and the
  request reads again and retries. A third failure is refused with `busy`, and nothing is written.
- **A library is made by the first request that uses it.** The first catch-up or change of an
  account with no row of `libraries` makes its library, holding the default templates, with a
  `sequence` of 1 (§4.6). The request then goes on as for a library already made.

### 4.1 What the library stores

*Plumbing:* the library keeps two tables of the online side's D1 database:

| Table | Holds |
|---|---|
| `libraries` | One row for each account that has used its library: the account, and its `sequence` |
| `templates` | One row for each template: the account, its identifier, its `changed`, its `order` in the column `ord`, and its text form |

The pair of the account and the identifier is unique among templates, so two travellers' templates
may share an identifier. Each template's `order` is also held in its text form. The column lets the
library place a new template among the others, and order the catch-up, without reading any template's
text.

### 4.2 Adding a template

*Porcelain:* `POST /api/library/templates` adds a template to the traveller's library, at the end
(`PLN:LIBRARY-F1`). The library reads the `sequence`, and the identifier and `order` of every
template the traveller holds. It refuses with `library-full` a library that holds 100
(`PLN:LIBRARY-F5`), and with `duplicate-template` an identifier it already holds. It then makes the
template with `planner/checklists`:

- **With a title**, with `newChecklist`, owned by the account, with no trip.
- **With `from`**, with `copyChecklist`, with no trip, once `checklistFromText` has read `from`. A
  `from` whose `owner` is not the account is refused with `not-yours`. The copy keeps the owner of
  `from`, so a template never passes from one traveller to another.

Each is given the templates read as its list, so the new template sorts after every one. Any refusal
from `planner/checklists` is returned unchanged. The batch inserts the template and raises the
`sequence`.

A device copies a trip's checklist into its library by sending that checklist as `from`, from its
own copy of the trip. The library never asks the trip host for it. The checklist is the traveller's
own, so a device that sends altered text alters only its own traveller's library.

### 4.3 Changing a template

*Porcelain:* `POST /api/library/changes` reads the change with `changeFromText`, and reads the
template its `checklist` names from the traveller's library (`PLN:LIBRARY-F2`). A template the
library does not hold is refused with `unknown-template`. The change is applied with
`planner/checklists`' `apply`, and any refusal is returned unchanged, such as `template-tick`. The
batch writes the template's text form and its `order`, and raises the `sequence`.

A move of a template is a `place` change, which the device works out with `placeAfter` from its own
copy of the library. Two changes to the same template stand in the order they arrive, so the later
one's field stands.

### 4.4 Catching a device up

*Porcelain:* `POST /api/library/sync` gives the device this body (`PLN:LIBRARY-F4`):

| Field | Holds |
|---|---|
| `sequence` | The library's sequence now. The device keeps it, and gives it as `since` next time |
| `templates` | For each template of the traveller's library, in the order `ordered` gives, its identifier and its `changed`. A template whose `changed` is after `since` also holds its text form, as `template` |

A `since` that is absent counts as 0, so every template holds its text form. The device keeps each
template given with its text, and drops each template it holds that `templates` does not list,
since it was deleted. The library reads every template's identifier, `changed` and `order`, and the
text of only those changed since, in one statement.

The library is caught up when `web/trip-store` catches the device's trips up: when Itinero opens,
when the device comes back online, and when a window of Itinero comes to the front. No socket tells
a device of a change (`PLN:LIBRARY-NR1`).

### 4.5 Deleting a template

*Porcelain:* `DELETE /api/library/templates/{id}` deletes the template from the traveller's library
for good, and raises the `sequence` (`PLN:LIBRARY-F3`). A template the library does not hold is
refused with `unknown-template`, so a second delete of the same template is refused. Each device
drops the template at its next catch-up. A checklist on a trip copied from the template holds no
reference to it, and is unchanged.

### 4.6 The default templates

*Plumbing:* a library is made holding two default templates, Before leaving, then Packing
(`PLN:LIBRARY-F6`). `services/online/src/defaults.ts` holds each one's
identifier, title and items, and makes each with `planner/checklists`, owned by the account, with
no trip and no item ticked. Each identifier starts with `default-`, and each item's is `item-` and
its place, so none meets an identifier a device makes, which is a random UUID.

One batch makes the library. It inserts each default with a `changed` of 1, each only where the
account still has no row of `libraries`, then makes that row, with a `sequence` of 1. Two requests
making the same library at once are run one batch at a time, so the second finds the row and
inserts nothing. A library already made is never given the defaults again, so a default the
traveller deletes stays deleted, and a library made before the defaults existed is unchanged.

A catch-up that finds no library makes it, then reads it again, so the device is given the
defaults with their text. Only an account's first request does this, so it adds nothing to the
day of `PLN:LIBRARY-NFR2`.

### 4.7 The test suite

The suite runs with the online side's, through `just test-online`, in Vitest with Cloudflare's
integration, which runs each test file in the Workers runtime with a local D1 database of its own.

- **Request tests** cover each request and each refusal of §3.2, and every check in the verification
  of each requirement the library claims.
- **Isolation tests** send each request as one traveller, naming another's template, and confirm
  each is refused as for a template nobody holds, and that the other library is unchanged
  (`PLN:LIBRARY-NFR1`).
- **Race tests** send two changes to the same library at once, and confirm both are applied, each
  with a sequence of its own, and that no write is lost.
- **Cost tests** count the rows each request reads and writes, through what D1 reports for each
  statement, and confirm the day of `PLN:LIBRARY-NFR2`'s verification stays within the free plan
  (§6).
- **Default tests** make a library by a catch-up, by a change, and by two catch-ups at once, and
  confirm it holds each default once (`PLN:LIBRARY-F6`). Every other test starts from a library
  emptied of its defaults.

## 5. Resources

The library stores two kinds of record, each a table of the online side's D1 database.

| Record | Holds | Kept |
|---|---|---|
| Library | The account, and its `sequence` | For as long as the account is kept. Deleting an account is future work |
| Template | The account, its identifier, its `changed`, its `order`, and its text form | Until the traveller deletes it |

| Resource | Path | Owned by |
|---|---|---|
| The tables `libraries` and `templates` | The online side's D1 database, made by a migration in `services/online/migrations/` | Whoever keeps the planner's roadmap |
| The library's logic | `services/online/src/library.ts` | Whoever keeps the planner's roadmap |
| The requests of §3.2 | `services/online/src/library-routes.ts` | Whoever keeps the planner's roadmap |
| The default templates | `services/online/src/defaults.ts` | Whoever keeps the planner's roadmap |

The Worker gains `@itinero/checklists` as a runtime dependency.

## 6. Quality attributes

- **Nothing leaks** (`PLN:LIBRARY-NFR1`). Every statement names the account `whoSent` gives. A
  template another traveller holds is refused as one nobody holds, so no refusal says that it
  exists.
- **Fails closed** (`PLN:LIBRARY-NFR1`). A request with no session reaches no data.
- **No write is lost.** Every batch holds only where the library is as it was read (§4). A request
  that loses a race reads again, rather than writing over the other.
- **Costs nothing at this scale** (`PLN:LIBRARY-NFR2`). A catch-up reads one row of `libraries` and
  one row for each template, so a library of 50 templates caught up 30 times a day from each of three
  devices reads about 4,600 rows a day. A change reads and writes the library's row and one
  template's. Ten such travellers read under 50,000 rows a day, and write a few hundred, against a
  free allowance of 5 million rows read and 100,000 written.
- **Bounded** (`PLN:LIBRARY-F5`). A library holds at most 100 templates, and each template at most
  200 items of 500 characters, as `planner/checklists` limits them.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [PLN:LIBRARY-F1](../../requirements/planner/library.md#^pln-library-f1) | `POST /api/library/templates`, with a title or `from`, and the `not-yours` refusal (§4.2). |
| [PLN:LIBRARY-F2](../../requirements/planner/library.md#^pln-library-f2) | `POST /api/library/changes`, and `unknown-template` for every template the traveller does not hold (§4.3). |
| [PLN:LIBRARY-F3](../../requirements/planner/library.md#^pln-library-f3) | `DELETE /api/library/templates/{id}` (§4.5). Asking the traveller first is `web/screens`. |
| [PLN:LIBRARY-F4](../../requirements/planner/library.md#^pln-library-f4) | `POST /api/library/sync`, and the `sequence` and `changed` of §4 (§4.4). Keeping the copy on the device is `web/trip-store`. |
| [PLN:LIBRARY-F5](../../requirements/planner/library.md#^pln-library-f5) | The `library-full` refusal (§4.2). |
| [PLN:LIBRARY-F6](../../requirements/planner/library.md#^pln-library-f6) | A library made holding the default templates, once, by its first catch-up or change (§4, §4.6). |
| [PLN:LIBRARY-NFR1](../../requirements/planner/library.md#^pln-library-nfr1) | Every request working on the account `whoSent` gives alone, and one refusal for any template the traveller does not hold (§4, §6). |
| [PLN:LIBRARY-NFR2](../../requirements/planner/library.md#^pln-library-nfr2) | The `order` column, and a catch-up that reads the text of only the templates changed (§4.1, §4.4, §6). |
| [ACC-F14](../../requirements/access/access.md#^acc-f14) | Each library worked on only for the account `whoSent` gives, so no traveller, an admin included, is given another's templates (§4). A trip's checklists are `planner/trip-host`. |
| [ACC-NFR1](../../requirements/access/access.md#^acc-nfr1) | One refusal for any template the traveller does not hold, whatever the device sends (§4.3, §4.5). |
| [PLN-F17](../../requirements/planner/planner.md#^pln-f17) | Each traveller's templates, kept online outside any trip, and given to their devices alone (§4). The templates themselves are `planner/checklists`. |

## 8. Open

None. `web/trip-store` keeps the copy of the library on each device, and `web/screens` shows it.
