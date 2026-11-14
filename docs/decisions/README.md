# Decision records

What was chosen, and why. Each record states a problem, the decision taken, what follows from it,
and the alternatives that were rejected. `documentation-system.md` sets the rules every record
keeps:

- a record is numbered in order, and named `NNNN-short-slug.md`
- its `Scope` line names every registered address the decision binds, or `workspace`
- once accepted and acted on, a record is never edited. A changed decision is a new record that
  supersedes it
- the status and scope lines may change at any time, and this index changes in the same commit

| Status | Means |
|---|---|
| Proposed | Open. Editable, and settles nothing |
| Proposed until an item is done | Open, and held until the named items of the live work list are done |
| Accepted | In force |
| Rejected | Considered and not adopted |
| Superseded by another record | Was in force, and the named record now governs |
| Rescinded | Withdrawn, with nothing replacing it |

## Ledger

| ADR | Title | Scope | Status |
|---|---|---|---|
| [0001](0001-the-checker-reads-documents-line-by-line.md) | The documentation checker reads each document line by line | shared/doc-check | Accepted |
| [0002](0002-claims-code-spans-raw-html-and-list-labels-are-checked.md) | Requirement claims, one-line code spans, no raw HTML and the live list's labels are checked | workspace | Accepted |
| [0003](0003-the-checker-is-built-in-rust-and-run-through-just.md) | The documentation checker is built in Rust and run through just | workspace | Accepted |
| [0004](0004-a-trip-is-read-only-offline.md) | A trip can be read without a connection, but changed only with one | planner, web | Accepted |
| [0005](0005-itinero-records-no-telemetry.md) | Itinero records no telemetry, so the documents reserve no place for it | workspace | Accepted |
| [0006](0006-new-documents-start-from-skeletons.md) | New documents start from skeletons that a second program writes | shared/doc-check, shared/doc-scaffold | Accepted |
| [0007](0007-trip-time-is-written-in-typescript.md) | trip-time is written in TypeScript | shared/trip-time | Accepted |
| [0008](0008-trip-time-carries-its-own-time-zone-rules.md) | trip-time carries its own copy of the time-zone rules | shared/trip-time, web | Accepted |
| [0009](0009-a-finished-item-leaves-the-list-when-finished.md) | A finished item leaves the live list in the commit that finishes it | workspace | Accepted |
| [0010](0010-a-trips-calendar-is-pencilled-in.md) | A trip's calendar is pencilled in, and only its firm items are fixed | planner | Superseded by ADR-0013 |
| [0011](0011-a-trips-pages-form-a-tree.md) | A trip's pages form a tree, with links between any two | planner, access | Accepted |
| [0012](0012-access-passes-down-the-tree.md) | Access to a page passes down to the pages beneath it | access, planner/pages | Accepted |
| [0013](0013-bookings-have-a-page-of-their-own.md) | A trip's bookings have a page of their own, and its calendar is seen only by the travellers an admin chooses | planner, bookings, access | Accepted |
| [0014](0014-a-trip-opens-on-a-home-page.md) | A trip opens on a home page for each traveller, with their own dates and the country they are in | planner, web | Accepted |
| [0015](0015-the-online-side-runs-on-cloudflare.md) | Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google alone | access, planner | Accepted |
| [0016](0016-bookings-are-entered-by-hand.md) | A trip's bookings are entered by hand, as one of four kinds, and kept with the trip online | bookings, planner/trip-host | Accepted |

## By subject

### workspace

| ADR | Title | Status |
|---|---|---|
| [0002](0002-claims-code-spans-raw-html-and-list-labels-are-checked.md) | Requirement claims, one-line code spans, no raw HTML and the live list's labels are checked | Accepted |
| [0003](0003-the-checker-is-built-in-rust-and-run-through-just.md) | The documentation checker is built in Rust and run through just | Accepted |
| [0005](0005-itinero-records-no-telemetry.md) | Itinero records no telemetry, so the documents reserve no place for it | Accepted |
| [0009](0009-a-finished-item-leaves-the-list-when-finished.md) | A finished item leaves the live list in the commit that finishes it | Accepted |

### planner

| ADR | Title | Status |
|---|---|---|
| [0004](0004-a-trip-is-read-only-offline.md) | A trip can be read without a connection, but changed only with one | Accepted |
| [0010](0010-a-trips-calendar-is-pencilled-in.md) | A trip's calendar is pencilled in, and only its firm items are fixed | Superseded by ADR-0013 |
| [0011](0011-a-trips-pages-form-a-tree.md) | A trip's pages form a tree, with links between any two | Accepted |
| [0013](0013-bookings-have-a-page-of-their-own.md) | A trip's bookings have a page of their own, and its calendar is seen only by the travellers an admin chooses | Accepted |
| [0014](0014-a-trip-opens-on-a-home-page.md) | A trip opens on a home page for each traveller, with their own dates and the country they are in | Accepted |
| [0015](0015-the-online-side-runs-on-cloudflare.md) | Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google alone | Accepted |

### access

| ADR | Title | Status |
|---|---|---|
| [0011](0011-a-trips-pages-form-a-tree.md) | A trip's pages form a tree, with links between any two | Accepted |
| [0012](0012-access-passes-down-the-tree.md) | Access to a page passes down to the pages beneath it | Accepted |
| [0013](0013-bookings-have-a-page-of-their-own.md) | A trip's bookings have a page of their own, and its calendar is seen only by the travellers an admin chooses | Accepted |
| [0015](0015-the-online-side-runs-on-cloudflare.md) | Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google alone | Accepted |

### web

| ADR | Title | Status |
|---|---|---|
| [0004](0004-a-trip-is-read-only-offline.md) | A trip can be read without a connection, but changed only with one | Accepted |
| [0008](0008-trip-time-carries-its-own-time-zone-rules.md) | trip-time carries its own copy of the time-zone rules | Accepted |
| [0014](0014-a-trip-opens-on-a-home-page.md) | A trip opens on a home page for each traveller, with their own dates and the country they are in | Accepted |

### bookings

| ADR | Title | Status |
|---|---|---|
| [0013](0013-bookings-have-a-page-of-their-own.md) | A trip's bookings have a page of their own, and its calendar is seen only by the travellers an admin chooses | Accepted |
| [0016](0016-bookings-are-entered-by-hand.md) | A trip's bookings are entered by hand, as one of four kinds, and kept with the trip online | Accepted |

### planner/pages

| ADR | Title | Status |
|---|---|---|
| [0012](0012-access-passes-down-the-tree.md) | Access to a page passes down to the pages beneath it | Accepted |

### planner/trip-host

| ADR | Title | Status |
|---|---|---|
| [0016](0016-bookings-are-entered-by-hand.md) | A trip's bookings are entered by hand, as one of four kinds, and kept with the trip online | Accepted |

### shared/doc-check

| ADR | Title | Status |
|---|---|---|
| [0001](0001-the-checker-reads-documents-line-by-line.md) | The documentation checker reads each document line by line | Accepted |
| [0006](0006-new-documents-start-from-skeletons.md) | New documents start from skeletons that a second program writes | Accepted |

### shared/doc-scaffold

| ADR | Title | Status |
|---|---|---|
| [0006](0006-new-documents-start-from-skeletons.md) | New documents start from skeletons that a second program writes | Accepted |

### shared/trip-time

| ADR | Title | Status |
|---|---|---|
| [0007](0007-trip-time-is-written-in-typescript.md) | trip-time is written in TypeScript | Accepted |
| [0008](0008-trip-time-carries-its-own-time-zone-rules.md) | trip-time carries its own copy of the time-zone rules | Accepted |
