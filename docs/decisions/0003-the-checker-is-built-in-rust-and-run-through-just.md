# ADR-0003 — The documentation checker is built in Rust and run through just

- **Status:** Accepted
- **Date:** 2026-11-10
- **Scope:** workspace

## Problem

`documentation-system.md` named the documentation checker, `shared/doc-check`, as a package an
author runs with `npm run check-docs`. That command needs Node.js and its package manager, npm.
The checker's requirements say a fresh checkout must build it with nothing installed but the Rust
toolchain the repository pins (`SHR:DOC-CHECK-NFR5`). A checker that needs a second language's
toolchain is one more thing a new machine, and every continuous integration image, must install
before any document can be checked.

## Decision

The checker is a Rust package at `tools/doc-check`. It uses the Rust standard library and no
third-party package. A `rust-toolchain.toml` file at the repository root pins the Rust toolchain.

Authors and continuous integration run it with `just check-docs`. just is a command runner: a
`justfile` at the repository root names each command, and just runs it from that directory,
whichever directory it is called from. Continuous integration runs the checker on every push and
every pull request, and a pull request whose run has findings, or could not run, fails its check.

## Consequences

- Building the checker needs the pinned Rust toolchain alone, and fetches nothing from the network.
- Running it needs just as well. Each author installs just once, and so does the continuous
  integration image.
- No outside release can change what the checker does, because it depends on no third-party
  package. Anything it needs, such as reading a table row, it implements itself.
- `spec/shared/doc-check.md` describes the package, the recipe and the workflow that runs it.

## Alternatives considered

- **A Node.js package run through npm.** It needs Node.js beside the Rust toolchain on every
  machine that checks documents.
- **A cargo alias, `cargo check-docs`.** It needs nothing beyond the toolchain to run. It lost
  because just gives every command in the repository one short form, where an alias serves only
  cargo's commands.
