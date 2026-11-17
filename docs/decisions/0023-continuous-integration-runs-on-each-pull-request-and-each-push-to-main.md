# ADR-0023 — Continuous integration runs on each pull request and each push to main

- **Status:** Accepted
- **Date:** 2026-11-17
- **Scope:** workspace

## Problem

Continuous integration is the set of checks GitHub runs on the repository's code each time it
changes. Two workflows hold them. `check-docs` runs `shared/doc-check`, the documentation checker,
and the tests of the tools beside it. `test-packages` runs the test suite of every package of the
npm workspace, among them the web app's tests in three browsers.

Both workflows ran on every push to any branch, and on every pull request. A push to a branch with
an open pull request therefore started each workflow twice, on the same commit. One run tested the
branch as pushed, and the other tested the branch merged into `main`. Where `main` had not moved
since the branch began, both runs tested the same code. `test-packages` takes several minutes, most
of it the web app's browser tests, so each push to a pull request cost that time twice.

## Decision

Both workflows run on each pull request, and on each push to `main`. A push to any other branch
starts no run by itself. Its pull request starts the run.

## Consequences

- Each change to a pull request is checked once, merged into `main` as it stands. That catches a
  clash with work merged to `main` meanwhile, which a run on the branch alone would miss.
- `main` is checked once more after each merge, so a fault from two pull requests merged one after
  the other shows at once.
- A branch with no pull request is not checked by continuous integration. An author who wants it
  checked opens a pull request, as a draft where it is not ready for review, or runs the checks on
  their own machine.
- `documentation-system.md` says continuous integration runs the checker on each pull request and
  each push to `main`. The specifications of the components whose tests the workflows run say the
  same.

## Alternatives considered

- **Running on every push and every pull request, as before.** Each push to a pull request starts
  each workflow twice, and the second run adds nothing while `main` has not moved.
- **Running on every push alone.** A run on the branch alone misses a clash with work merged to
  `main` since the branch began.
- **Running on each pull request alone.** `main` is then never checked after a merge, so a fault
  from two pull requests that pass apart and fail together is found only by the next pull request.
