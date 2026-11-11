# ADR-0005 — Itinero records no telemetry, so the documents reserve no place for it

- **Status:** Accepted
- **Date:** 2026-11-11
- **Scope:** workspace

## Problem

Telemetry is the traces, metrics and logs a running program sends to an operator. Itinero will not
send any. It is a trip planner for a small group of travellers, and nobody operates it in a way
that needs those signals.

Two rules of the documentation system still assumed telemetry would come. Every specification
reserved a numbered subsection of its interface section for the signals the component emits. The
component registry gave each system a column for the name its telemetry would be recorded under.
Each specification then carried a subsection saying "none", and each system a column left empty.
Both cost every new document a little, and protect nothing.

## Decision

Itinero records no telemetry. The documentation system reserves no place for it.

- A specification's interface section, section 3, has four parts: the user interface, the
  application interface, the programming interface, and the systems the component drives.
- The registry's Systems table has no column for a telemetry name.
- A cross-cutting concern, which is a subject every component must address the same way, is
  covered in a numbered subsection the registry names when the concern is registered. No concern
  has a subsection reserved for it in advance.
- The documentation system's exemplar concern is personal data. It is an exemplar only.
  Registering a personal-data concern, and choosing its subsection, is a decision of its own.

> [!NOTE]
> **History.** The first version of the documentation system made telemetry its first concern,
> covered at section 3.5 of every specification, with a telemetry name column in the registry.

## Consequences

- Every document written under the old rule moves in the same change. The documentation
  checker's specification drops its section 3.5, and the registry drops the column.
- The documentation checker's code is unchanged. It reads the registry's columns by name, and it
  requires a specification subsection only where a registered concern names one. Its test cases
  drop the column and use a personal-data concern in place of a telemetry one.
- A program built later that does need telemetry brings a new decision record. That record
  registers telemetry as a concern, which gives it a subsection in every specification.

## Alternatives considered

- **Keep the subsection and the column, empty.** Every specification would say "none" in a
  subsection, and every system would carry an empty column, for signals nothing will ever send.
- **Keep telemetry as the exemplar concern, while recording none.** A reader would take the
  exemplar as a sign that telemetry is planned.
