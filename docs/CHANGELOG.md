# Changelog

What has been done, newest first. An entry that finishes an item of the live work list names the
item, so a reader can find what became of its number. `documentation-system.md` sets the rules.

## 2026-11-12 — TODO-8, the documents of a registered component from one command

*By:* James Berry, with Claude

`just new-docs <system> <slug>` starts the documents of a component that was registered before
anyone wrote them, such as `planner/itinerary`. It writes whichever of the requirements and the
specification is missing, with their index rows, and takes the prefix and description from the
registry. Where it writes the specification, it links the component's slug in the registry to it,
the one existing line doc-scaffold changes. A new specification also cites back each accepted
decision record whose Consequences name it, for `just new-component` as well.

## 2026-11-11 — TODO-1, a new component's documents from one command

*By:* James Berry, with Claude

The scaffolder doc-scaffold starts a new component with `just new-component`. It writes the
component's requirements and specification as skeletons, and adds its rows to the registry, the
live list's Tags table and every index. It also starts a system with `just new-system`, a decision
record with `just new-decision`, and a guide with `just new-guide`. What it writes passes the
checker, and it marks each part the author still writes with "To be written". It is a component of
its own, `shared/doc-scaffold`, built as doc-check is (ADR-0006, new documents start from
skeletons that a second program writes).
