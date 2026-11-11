# The live work list

What needs active work, and what waits on a decision. `documentation-system.md` gives the list's
rules. When an item is done, it leaves this list for `CHANGELOG.md` in the commit that finishes it.

*Next free:* TODO-2

## Tags

| Tag | Means |
|---|---|
| shared/doc-check | The documentation checker |
| docs | The documentation system, and the tools authors use with it |

## Items

### TODO-1 — Create a new component's documents with one command

*Tags:* docs
*Written:* 2026-11-10

*Problem:* An author starts a new component's requirements and specification from blank files, and
adds its registry row and every index row by hand.

*Reason:* No tool creates them. doc-check cannot, because it never changes a file
(`SHR:DOC-CHECK-NFR3`).

*Proposal:* Build a scaffolder, run as `just new-component <system> <slug> <PREFIX>`, that writes
skeletons doc-check passes. Decide first whether it is a documented component of its own, and
whether it also creates systems, decision records and guides.

*Releases:* Nothing is planned for it yet.
