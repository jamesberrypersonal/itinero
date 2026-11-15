# ADR-0020 — A milestone names the milestones of other systems it waits on

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** workspace

## Problem

`documentation-system.md`, the rules every document keeps, gives each system one roadmap, and no
other roadmaps. A roadmap orders its own system's work into milestones, and its keeper reorders it.
One list ordering every system's work was rejected, because it would be edited by everyone and kept
by no one. The rule also said that the web app's milestones are not the bookings system's, and that
neither waits on the other.

That held while each system was designed. It does not hold once they are built. The web app cannot
read a trip until `planner/trip-host` holds one online, and `planner/trip-host` cannot apply a
change until `access/permissions` allows it. The rules had no way to say that a milestone of one
system waits on a milestone of another. A roadmap could say it in its opening prose, as the web
app's roadmap says its design follows the planner's, but nothing tied that prose to a milestone, or
checked that the milestone it named exists.

## Decision

**A milestone in a roadmap's pending half may open with a line that names what it waits on**,
written `**Waits on:**`. The line names the milestones of other systems that must be complete
before the milestone starts. It sits directly below the milestone's heading, and names each
milestone by its full name, such as Milestone Planner-0.1. It names only other systems'
milestones, because a system's own milestones are already reached in order.

**The line belongs to the waiting roadmap alone.** The roadmap waited on is not changed, and its
keeper reorders it as before. When the waiting milestone is complete, it leaves the pending half,
and its line with it.

**There is still one roadmap per system, and no roadmap above them.** The order between systems is
the sum of these lines.

**Every milestone citation resolves.** A milestone cited anywhere in the vault, as
`Milestone <System>-<Phase>.<Milestone>`, names a milestone heading in that system's roadmap.
doc-check reports each one that does not, in a new rule, `milestones`.

## Consequences

- `documentation-system.md` adds the line to its rules for roadmaps, adds milestones to its table of
  citations, and adds the rule `milestones` to its table of mechanical checks. The sentence saying
  that no system's milestones wait on another's is removed.
- [spec/shared/doc-check.md](../spec/shared/doc-check.md) specifies the rule `milestones` in §4.3,
  and `SHR:DOC-CHECK-F4` promises that a milestone citation resolves.
- A vault with no `roadmap/` directory has no roadmaps, and the rule then has nothing to check, as
  a vault with no live list has no list to check.
- A milestone is now cited at a stable address that is checked, so renaming a system, or
  renumbering a milestone, is caught wherever the old name was cited.
- Nothing shows, in one place, what waits on a milestone. A keeper finds it by searching the
  roadmaps for the milestone's name.
- doc-check does not report a `**Waits on:**` line that names its own system's milestone, or one
  that sits outside a pending milestone. Those are left to review, like the rest of a roadmap's
  shape.
- No roadmap holds the line yet, so nothing written under the old rule moves.

## Alternatives considered

- **One roadmap above every system's, ordering their milestones.** It is the list the rules already
  rejected: edited by everyone, kept by no one, and a second copy of every milestone that drifts
  from the first.
- **Both roadmaps record the dependency**, the waiting one and the one waited on. Each change then
  needs both keepers, and the two lines disagree as soon as one is edited.
- **The dependency in each roadmap's opening prose**, as the web app's roadmap says its design
  follows the planner's. It names no milestone of its own, and nothing checks it.
- **A milestone shared by several systems**, such as a first release, in a roadmap of its own. It
  is a roadmap above the systems' again, for one milestone. The milestone of the system that
  finishes the release can wait on the others instead.
