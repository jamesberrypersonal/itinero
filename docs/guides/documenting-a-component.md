# Documenting a new component

**Assumes** [setting-up-the-repository.md](setting-up-the-repository.md) — a working copy of the repository, where `just check-docs` prints `doc-check: clean`.

How to write the documents for a new part of the workspace, from registering it to landing its
documents in a pull request. The guide follows one example the whole way: the documents of
doc-check, the documentation checker, in a shortened form. You run the same commands with your own
component's names, and doc-check tells you at each stage what is still missing.

The rules this guide follows are stated in full in
[documentation-system.md](../documentation-system.md), and how sentences are written is in
[style.md](../style.md). This guide is the order to apply them in, not a replacement for them.

## How the documentation is arranged

A component is the unit the documentation describes: the smallest thing that makes promises of its
own to someone outside it. doc-check is one, and so would be a trip planner's API. A system is a
set of components that together make promises, such as the planner. A component that several
systems use, or that none owns, belongs to `shared`.

Every system, component and concern has an address, which is how every document names it, and a
prefix, which every one of its requirement identifiers starts with.

| Thing | Address | Prefix | Its requirements, for example |
|---|---|---|---|
| A system | its slug, such as `planner` | two to four capitals, such as PLN | the planner's first functional requirement |
| A component of a system | `planner/itinerary` | the system's prefix, a colon and a name, such as PLN:ITINERARY | the itinerary model's |
| A shared component | `shared/doc-check` | SHR, a colon and a name: `SHR:DOC-CHECK` | `SHR:DOC-CHECK-F1` |

Each kind of document answers one kind of question, and lives in its own folder of `docs/`:

| Folder | Answers | Written as |
|---|---|---|
| `requirements/` | What does it promise? Never how it does it | Numbered promises, each with the checks that prove it |
| `spec/` | How is it built? | Eight numbered sections, the same for every component |
| `decisions/` | Why was it built this way? | Short records, one per choice, never edited once acted on |
| `guides/` | How does a person do one task? | Numbered steps, each showing what success looks like |

`components.md`, the component registry, is the one place a system, component or concern is
declared. It is added there before any document names it.

## Reading what doc-check prints

doc-check prints one line for each place a document breaks a rule:

```
docs/requirements/shared/doc-check.md:8: claims: no specification's claim table cites SHR:DOC-CHECK-F1. Claim it in section 7 of the specification that contributes to it. (documentation-system.md, "Requirements this satisfies")
```

Read it left to right:

- `docs/requirements/shared/doc-check.md:8` is the file and line
- `claims` is the rule broken
- the first sentence is what was found
- the second sentence, when there is one, is what would pass
- the part in brackets is the heading of `documentation-system.md` that explains the rule

A finding is not a mistake to be embarrassed by. During this guide, most stages end with findings
that the next stage clears.

## The steps

### 1. Start a branch

A branch keeps your work apart from everyone else's until it is reviewed. Name it for the
component:

```
git switch -c docs/doc-check
```

It prints:

```
Switched to a new branch 'docs/doc-check'
```

### 2. Choose the address and the prefix

Decide which system the component belongs to, or whether it is shared, and choose its slug and
prefix:

- **The slug** is lower-case words joined by hyphens, and names what the component does, never the
  package that holds it today. `doc-check` names a checker of documents.
- **The prefix** is the system's prefix, or `SHR` for a shared component, then a colon, then three
  to twelve capitals, digits and hyphens. A reader who has never seen it should be able to guess
  what it belongs to.

doc-check is used by the whole vault and owned by no system, so its address is `shared/doc-check`,
and its prefix is `SHR:DOC-CHECK`. If your component's system is not yet in the registry, register
the system first, in the same way, in the registry's Systems table.

### 3. Register the component

Add a row to the Components table in `docs/components.md`:

```markdown
| doc-check | shared | SHR:DOC-CHECK | | | The checker that holds every document in this vault to the documentation system |
```

The columns are the slug, the system, the prefix, the packages that implement it today, the folder
that holds its documentation outside the vault, if any, and one line saying what it is. Leave a
column empty when it has nothing to hold. Then run:

```
just check-docs
```

It prints:

```
docs/TODO.md:5: tags: registered address shared/doc-check has no row in the Tags table. Add a row for shared/doc-check. (documentation-system.md, "The live work list and the changelog")
doc-check: 1 finding in 1 file
error: recipe `check-docs` failed on line 5 with exit code 1
```

`docs/TODO.md` is the live work list, and every registered address is one of its tags. Add a row
to its Tags table:

```markdown
| shared/doc-check | The documentation checker |
```

Run `just check-docs` again. It prints `doc-check: clean`.

### 4. Write the requirements

Create `docs/requirements/<system>/<slug>.md`, which for doc-check is
`docs/requirements/shared/doc-check.md`. A requirements document says what the component promises,
in terms a release manager could check, and never how it is built. Each promise is a short section
in three parts, with no subheadings inside it:

- **The heading** holds the identifier, a long dash, and a title that states the promise.
- **The body** states the promise in one or two sentences, and ends with its block ID: the
  identifier in lower case, with the colon written as a hyphen.
- **The verification** is a list of checks that prove the promise is kept.
- **The commentary**, in quoted blocks, answers questions a reader would ask. The first is always
  "What does this buy?"

The shortened doc-check document reads:

```markdown
# The documentation checker

What `shared/doc-check` promises to the people who write the vault. doc-check reads every document
in the vault, and reports each place where a document breaks a rule.

## Functional requirements

### SHR:DOC-CHECK-F1 — doc-check checks every document in the vault, and nothing outside it

One run of doc-check checks every markdown file in the vault, `docs/`, and no other file in the
repository. ^shr-doc-check-f1

- **Verification:** on a copy of the vault, run `just check-docs`, then
    - break one rule in a document inside `docs/`, and confirm it is reported
    - break the same rule in a markdown file outside `docs/`, and confirm nothing is reported

> **What does this buy?** A document can break a rule without being edited. Moving a document
> breaks every link to it, in files the move never opened. Only a run over the whole vault finds
> those.

### SHR:DOC-CHECK-F2 — A run says whether the vault is clean, has findings, or could not be checked

A run ends in one of three outcomes, and its exit status tells them apart: clean, findings, or
could not run. ^shr-doc-check-f2

- **Verification:** run doc-check against
    - a vault that breaks no rule, and confirm the exit status is zero
    - a vault that breaks one rule, and confirm the exit status is one
    - a directory that holds no vault, and confirm the exit status is two

> **What does this buy?** Whatever calls doc-check must fail when doc-check cannot run, never pass.

## Non-requirements

| Identifier | doc-check does not | Because |
|---|---|---|
| **SHR:DOC-CHECK-NR1** | Rewrite a document to fix a finding | The author chooses the fix |

^shr-doc-check-nr
```

Non-requirements are what the component deliberately does not do, numbered so a requirement can
say it depends on one. Their table carries one block ID for the whole table, on its own line after
one blank line. The full document, [doc-check.md](../requirements/shared/doc-check.md), shows the
same shape at its real length.

Run `just check-docs`. It prints:

```
docs/requirements/shared/doc-check.md:1: indexes: its directory has no index, docs/requirements/shared/README.md. (documentation-system.md, "The layout")
docs/requirements/shared/doc-check.md:8: claims: no specification's claim table cites SHR:DOC-CHECK-F1. Claim it in section 7 of the specification that contributes to it. (documentation-system.md, "Requirements this satisfies")
docs/requirements/shared/doc-check.md:21: claims: no specification's claim table cites SHR:DOC-CHECK-F2. Claim it in section 7 of the specification that contributes to it. (documentation-system.md, "Requirements this satisfies")
doc-check: 3 findings in 1 file
error: recipe `check-docs` failed on line 5 with exit code 1
```

The `claims` findings stay until step 6, when the specification claims each promise. The
`indexes` finding is cleared next.

### 5. Add the document to its indexes

Every folder holds a `README.md` listing its documents, and every folder's `README.md` is listed by
the one above it. A reader browsing the vault finds the document that way. Create
`docs/requirements/shared/README.md`, if the folder has none yet:

```markdown
# Shared requirements

What each shared component promises.

| Document | Promises about | Verified |
|---|---|---|
| [doc-check.md](doc-check.md) | The checker that holds every document in the vault to the documentation system | Against copies of the vault built to break one rule at a time |
```

If the folder already has one, add the row to its table instead. Run `just check-docs`. Where the
tree's own index is missing too, it prints:

```
docs/requirements/shared/README.md:1: indexes: its parent directory has no index, docs/requirements/README.md. (documentation-system.md, "The layout")
```

So each new folder is linked from the index above it, up to `docs/README.md`. Here that means a
row for `shared/` in `docs/requirements/README.md`, and a row for `requirements/` in
`docs/README.md`. Once every index links the one below it, only the `claims` findings remain:

```
docs/requirements/shared/doc-check.md:8: claims: no specification's claim table cites SHR:DOC-CHECK-F1. Claim it in section 7 of the specification that contributes to it. (documentation-system.md, "Requirements this satisfies")
docs/requirements/shared/doc-check.md:21: claims: no specification's claim table cites SHR:DOC-CHECK-F2. Claim it in section 7 of the specification that contributes to it. (documentation-system.md, "Requirements this satisfies")
doc-check: 2 findings in 1 file
error: recipe `check-docs` failed on line 5 with exit code 1
```

### 6. Write the specification

Create `docs/spec/<system>/<slug>.md`. A specification says how the component is built, in enough
detail that someone who has not read the code could build it. Every specification has the same
eight sections, numbered in their headings, so a reader knows where to look before opening it:

| Section | Holds |
|---|---|
| 1. Purpose | What it is for |
| 2. Scope | What it covers, what acts on it, and what is deliberately left out |
| 3. Interface | How it is used, in four parts: 3.1 user interface, 3.2 application interface, 3.3 programming interface, 3.4 the systems it drives |
| 4. Behaviour | What it does: the section a reader builds from |
| 5. Resources | What it creates or stores, and who owns it |
| 6. Quality attributes | How fast, how safe and how reliable it is |
| 7. Requirements this satisfies | The claim table |
| 8. Open | What is still undecided |

A section with nothing to say keeps its heading, and says where the reader should go instead, such
as "None. Callers reach doc-check through its command." The claim table is what ties the two
documents together. Each row names a requirement, and says what this component contributes to it.
In the shortened doc-check specification, it reads:

```markdown
## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [SHR:DOC-CHECK-F1](../../requirements/shared/doc-check.md#^shr-doc-check-f1) | The walk of §4, over every document under `docs/`. |
```

Add the specification to `docs/spec/shared/README.md`, `docs/spec/README.md` and `docs/README.md`,
as in step 5. Then run `just check-docs`. The table above forgot one requirement, so it prints:

```
docs/requirements/shared/doc-check.md:21: claims: no specification's claim table cites SHR:DOC-CHECK-F2. Claim it in section 7 of the specification that contributes to it. (documentation-system.md, "Requirements this satisfies")
doc-check: 1 finding in 1 file
error: recipe `check-docs` failed on line 5 with exit code 1
```

Add the missing row:

```markdown
| [SHR:DOC-CHECK-F2](../../requirements/shared/doc-check.md#^shr-doc-check-f2) | The three exit statuses of §3.1. |
```

Run `just check-docs` again. It prints `doc-check: clean`. The full specification,
[doc-check.md](../spec/shared/doc-check.md), shows every section at its real length.

### 7. Record each decision you made

Whenever you chose between real alternatives, record the choice, so a reader a year from now knows
why. A decision record is a file in `docs/decisions/` named by the next free four-digit number and
a slug that says what was decided:

```markdown
# ADR-0001 — The documentation checker reads each document line by line

- **Status:** Proposed
- **Date:** 2026-11-10
- **Scope:** shared/doc-check

## Problem

The documentation checker, `shared/doc-check`, has to find each document's headings, links and
tables. Markdown has no single grammar that both of the vault's renderers agree on.

## Decision

The checker reads each document one line at a time, and recognises a small set of line forms.

## Consequences

- `spec/shared/doc-check.md` describes the line forms the checker reads.

## Alternatives considered

- **A full Markdown parser.** Its size would dwarf every rule it serves.
```

The scope names every address the decision binds, or `workspace` for a decision that binds
everything. Write the record so it reads cold: a reader arrives at it from a link, having read
nothing else. The real record, [ADR-0001](../decisions/0001-the-checker-reads-documents-line-by-line.md),
shows the full form.

`docs/decisions/README.md` lists every record twice: once in its Ledger table, in number order,
and once in its By subject section, under each address the record's scope names. Run
`just check-docs` with only the Ledger row added, and it prints:

```
docs/decisions/0001-the-checker-reads-documents-line-by-line.md:1: decision-index: the decision index does not list this record under shared/doc-check. Add a row for it under ### shared/doc-check in docs/decisions/README.md. (documentation-system.md, "The index")
doc-check: 1 finding in 1 file
error: recipe `check-docs` failed on line 5 with exit code 1
```

A record starts as Proposed, and can be edited freely while it is. Once the pull request's reviewer
agrees, it becomes Accepted, and from then on its reasoning is never edited: a changed decision is
a new record that supersedes it. Accepting it means changing the Status line in the record and in
both index rows. An accepted record whose Consequences name a specification also needs that
specification to cite it back. Change only the record's Status line, and `just check-docs` prints:

```
docs/decisions/0001-the-checker-reads-documents-line-by-line.md:18: back-citations: docs/spec/shared/doc-check.md does not cite ADR-0001 back. Cite ADR-0001 in docs/spec/shared/doc-check.md. (documentation-system.md, "The shape of a record")
docs/decisions/README.md:9: decision-index: the row for docs/decisions/0001-the-checker-reads-documents-line-by-line.md has status Proposed (the record says Accepted). Make the row match the record. (documentation-system.md, "The index")
docs/decisions/README.md:17: decision-index: the row for docs/decisions/0001-the-checker-reads-documents-line-by-line.md has status Proposed (the record says Accepted). Make the row match the record. (documentation-system.md, "The index")
doc-check: 3 findings in 2 files
error: recipe `check-docs` failed on line 5 with exit code 1
```

Update both index rows to Accepted, and cite the record where the specification relies on it, such
as "reads each document line by line (ADR-0001)". Run `just check-docs` again. It prints
`doc-check: clean`.

### 8. Read it through as a newcomer

doc-check checks the structure, but not whether the documents are clear. Before committing, run
the final pass at the end of [style.md](../style.md) by hand: delete every link and check each
sentence still makes its point, count the joints in each sentence, and read the first sentence of
every paragraph in order. Then read the documents as someone who has read only what they declare
they assume.

### 9. Commit, and open a pull request

Add your changes, and check that the list holds what you expect:

```
git add docs
git status --short
```

It prints one line for each file, `A` for added and `M` for modified:

```
M  docs/README.md
M  docs/TODO.md
M  docs/components.md
A  docs/decisions/0001-the-checker-reads-documents-line-by-line.md
A  docs/decisions/README.md
A  docs/requirements/README.md
A  docs/requirements/shared/README.md
A  docs/requirements/shared/doc-check.md
A  docs/spec/README.md
A  docs/spec/shared/README.md
A  docs/spec/shared/doc-check.md
```

Commit them, with a message that says what the change does:

```
git commit -m "Document doc-check, the documentation checker"
```

With the pre-commit hook installed, doc-check runs first. The output opens with these lines, with
a different seven-character code, which identifies your commit:

```
doc-check: clean
[docs/doc-check 884bd33] Document doc-check, the documentation checker
 11 files changed, 173 insertions(+)
```

Send the branch to GitHub:

```
git push -u origin docs/doc-check
```

Among the lines it prints is:

```
 * [new branch]      docs/doc-check -> docs/doc-check
```

Open a pull request, which asks for your branch to be reviewed and merged:

```
gh pr create
```

It asks for a title and a description, then prints the address of the new pull request. Open that
address in your browser.

## Confirming the work

On the pull request's page on GitHub, the check named check-docs runs on its own. It runs doc-check's
tests and then doc-check itself, and the pull request can merge only once it passes. When it fails,
open its summary, which lists every finding in the form you read in this guide. Fix them on your
branch, commit, and push again.

## Findings you will meet most

| Rule | Usual cause | What to do |
|---|---|---|
| `indexes` | A new document, or a new folder, that its index does not list | Add a row to the `README.md` beside it, and link a new folder's `README.md` from the one above |
| `claims` | A requirement no specification claims yet | Add a row for it to the claim table, in section 7 of the specification |
| `identifiers` | A requirement identifier that is mistyped, or names a requirement that does not exist | Correct the identifier, or write the requirement |
| `block-ids` | A requirement's body paragraph without its block ID at the end | End the paragraph with a space and the block ID the finding gives |
| `links` | A link to a file that moved, or a link to a heading | Correct the path. To link to a requirement, link to its block ID |
| `tags` | A newly registered address with no row in the live list's Tags table | Add the row to `docs/TODO.md` |
| `code-spans` | A code span wrapped across two lines | Rewrap the paragraph so each code span stays on one line |
