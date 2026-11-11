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

## By subject

### workspace

| ADR | Title | Status |
|---|---|---|
| [0002](0002-claims-code-spans-raw-html-and-list-labels-are-checked.md) | Requirement claims, one-line code spans, no raw HTML and the live list's labels are checked | Accepted |
| [0003](0003-the-checker-is-built-in-rust-and-run-through-just.md) | The documentation checker is built in Rust and run through just | Accepted |
| [0005](0005-itinero-records-no-telemetry.md) | Itinero records no telemetry, so the documents reserve no place for it | Accepted |

### planner

| ADR | Title | Status |
|---|---|---|
| [0004](0004-a-trip-is-read-only-offline.md) | A trip can be read without a connection, but changed only with one | Accepted |

### web

| ADR | Title | Status |
|---|---|---|
| [0004](0004-a-trip-is-read-only-offline.md) | A trip can be read without a connection, but changed only with one | Accepted |

### shared/doc-check

| ADR | Title | Status |
|---|---|---|
| [0001](0001-the-checker-reads-documents-line-by-line.md) | The documentation checker reads each document line by line | Accepted |
