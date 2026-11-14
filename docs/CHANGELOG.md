# Changelog

What has been done, newest first. An entry that finishes an item of the live work list names the
item, so a reader can find what became of its number. `documentation-system.md` sets the rules.

## 2026-11-14 — TODO-9, the style guide's final pass from a Claude skill

*By:* James Berry, with Claude

The project skill `final-pass`, in `.claude/skills/final-pass/SKILL.md`, runs the final pass over
the documents a branch changes. The final pass is the list of checks at the end of `style.md` that
every document gets before it is committed. An author starts the skill by typing `/final-pass` in
Claude Code. The skill runs the first three checks itself. It gives the fourth, reading each
document as a newcomer would, to a fresh subagent. That subagent reads only the document and the
documents it declares it assumes. Whoever wrote the documents has seen the work, and cannot read
them as a newcomer. The skill then applies its fixes, and rewraps at 100 columns only the
paragraphs it changed. Last, it runs `just check-docs` and `just test-docs`. It asks before it
edits a decision record that has been accepted, because an accepted record is never changed.

## 2026-11-12 — TODO-8, the documents of a registered component from one command

*By:* James Berry, with Claude

`just new-docs <system> <slug>` starts the documents of a component that was registered before
anyone wrote them, such as `planner/itinerary`. It writes whichever of the requirements and the
specification is missing, with their index rows, and takes the prefix and description from the
registry. Where it writes the specification, it also links the component's slug in the registry to
it. That is the one existing line doc-scaffold changes. Every other edit it makes only adds lines.

A new specification from either `just new-docs` or `just new-component` now cites each accepted
decision record whose Consequences name it. The checker requires that citation, so a new
specification adds no finding.

## 2026-11-11 — TODO-1, a new component's documents from one command

*By:* James Berry, with Claude

The scaffolder doc-scaffold starts a new component with `just new-component`. It writes the
component's requirements and specification as skeletons, and adds its rows to the registry, the
live list's Tags table and every index. It also starts a system with `just new-system`, a decision
record with `just new-decision`, and a guide with `just new-guide`. What it writes passes the
checker, and it marks each part the author still writes with "To be written". It is a component of
its own, `shared/doc-scaffold`, built as doc-check is (ADR-0006, new documents start from
skeletons that a second program writes).
