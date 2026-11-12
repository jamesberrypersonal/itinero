# ADR-0007 — trip-time is written in TypeScript

- **Status:** Accepted
- **Date:** 2026-11-12
- **Scope:** shared/trip-time

## Problem

trip-time, the shared component that holds a trip's dates and times, is the first part of Itinero,
the trip planner, to be specified. No language had been chosen for the product. trip-time has to run
in the web app on a phone with no connection (ADR-0004, a trip is read-only offline). It also has to
run on whatever server holds trips, so that a value sorts and reads the same in both places.

## Decision

trip-time is written in TypeScript, as one package, `@itinero/trip-time`, in
`packages/trip-time/`. The same code runs unchanged in the browser and on a Node server. The
package has no runtime dependencies.

## Consequences

- `spec/shared/trip-time.md` describes trip-time's interface as TypeScript functions and types.
- The repository gains a second toolchain, Node.js and npm, beside the Rust toolchain the
  documentation tools use. npm workspaces hold the product's packages under `packages/`.
- The web app and the server are likely to be written in TypeScript too, so they can use trip-time
  directly. This record does not bind them. Their own records choose their languages.
- The documentation tools stay in Rust (ADR-0003, the checker is built in Rust and run through
  just). Someone who works on both the product and
  the documentation tools needs both toolchains.

## Alternatives considered

- **Rust, compiled to WebAssembly.** It matches the documentation tools, but the web app would
  reach every call through a JavaScript wrapper, and the build would need a second compile step.
- **Choosing the language later, with the web app.** The specification could not then name its
  interface or its file formats, and would have to be rewritten once the language was chosen.
