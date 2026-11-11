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

## By subject

### shared/doc-check

| ADR | Title | Status |
|---|---|---|
| [0001](0001-the-checker-reads-documents-line-by-line.md) | The documentation checker reads each document line by line | Accepted |
