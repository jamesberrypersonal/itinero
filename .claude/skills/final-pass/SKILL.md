---
name: final-pass
description: Run the final pass at the end of docs/style.md over the documents the current branch changes, fix what it finds, then run the documentation checker and the test suites. Use before committing or opening a pull request that changes anything under docs/, or when asked to run the final pass, check the style, or read the documents as a newcomer.
---

# The final pass

`docs/style.md` ends with a final pass that every document gets before it is committed. This
skill runs that pass over the documents the current branch changes. Steps 1 to 3 you do yourself.
Step 4, reading as a newcomer, goes to a fresh subagent, because you have seen the work and cannot
read as someone who has not. Then you apply the fixes and run the checker and the tests.

Read `docs/style.md` and `docs/documentation-system.md` in full before starting. They are the
rules. This skill says only how to run the pass over them.

## 1. Find the documents

List the Markdown files under `docs/` that differ from `main`, both committed and not:

```
git diff --name-only main...HEAD -- docs
git diff --name-only HEAD -- docs
git ls-files --others --exclude-standard -- docs
```

Take the union, and keep only `.md` files that still exist. Drop anything under `graveyard/` or
`.obsidian/`, and any `*-draft.md` file, because doc-check skips them too. If an argument names
files or a different base branch, use that instead.

If the list is empty, say so and stop.

For each document, get its diff (`git diff main -- <file>`, or the whole file if it is new). The
pass checks the whole of every paragraph the diff touches. It also reads the rest of the document
for one thing: sentences that the change has made untrue, such as a count, a list of commands, or
a claim about a section that the change rewrote. Those are fixed too. Other defects in paragraphs
the branch did not touch are reported, not fixed, so the pull request stays about its own change.

## 2. Run steps 1 to 3 yourself

Run each step over every touched paragraph, including list items, table cells holding prose, and
blockquote blocks. Skip fenced code blocks, which are exempt from every rule. Note each finding
with its file, line and rule.

1. **Delete every link (`STY-V6`).** Read each sentence with every link, citation and identifier
   gloss removed. If it no longer makes its point, the citation was carrying the claim. State the
   claim in full, and keep the citation trailing with a short gloss. Check also that each
   identifier is glossed at its first use in the document.
2. **Count the joints (`STY-V1`).** For each sentence, count semicolons, colons, em-dash breaks,
   and conjunctions joining two independent clauses. Apply the two exemptions in `STY-V1`
   exactly. More than one joint becomes two sentences. Where an enumeration's items need clauses
   of their own, `STY-V11` makes it a list.
3. **Read the first sentences (`STY-V2`).** Read the first sentence of every paragraph in each
   section, in order and alone. They should carry the section's argument. A paragraph whose first
   sentence is not its point is reordered.

While doing these, check the touched paragraphs against the rest of Voice and the Lexicon too,
because the same reading finds them. Bold used for emphasis (`STY-V9`), an actor left unnamed
(`STY-V4`), a pronoun whose referent is in another paragraph (`STY-V5`), and a word from the
"Never write" column of the Lexicon table are the usual ones.

Also check that the change agrees with itself. A requirement that contradicts its own
specification, or a specification section that the claim table no longer matches, is a finding.
Read the requirement's specification, or the specification's requirements, where the diff touches
either.

## 3. Hand step 4 to a fresh subagent

Step 4 reads each document as someone who has read only its declared prerequisites (`STY-S1`,
`STY-S2`). For each document, work out those prerequisites:

- the `README.md` of the document's own tree, such as `docs/spec/README.md` for a specification
- every document named on an `**Assumes**` line at the top of the document

Then launch one `general-purpose` subagent per document, all in the same message so they run in
parallel. Do not fork, because a fork inherits this conversation. Give each the prompt below, with
the paths filled in, and nothing else. In particular, give it no diff, no summary of the change,
and no findings from steps 1 to 3.

```
You are reading a document from the Itinero repository at <absolute repository path>, as a
newcomer would. Read only these files, in this order, and no others:

1. <prerequisite 1>
2. <prerequisite 2, and so on>
3. <the document>

Do not open any other file, run git, or search the repository. A newcomer has only these.

Report every place in the last document where you, having read only these files, cannot be sure
what a sentence means. For each place, give the line number, quote the words, and say in one
sentence what stops you: a term used before it is defined or never defined, a pronoun or omitted
subject whose referent is unclear, a process referred to before it is described, a sentence that
needs re-reading to parse, or a claim that contradicts another sentence in these files.

Report only what blocks understanding. Do not suggest style changes or rewrites, and do not
report what is merely long. If nothing blocks you, say so. Reply with the list and nothing else.
```

The subagent's findings in paragraphs the branch did not touch are reported, not fixed, like the
others in section 1.

## 4. Apply the fixes

Fix every finding in the touched paragraphs, and every sentence the change made untrue elsewhere.
Keep to the style while fixing. A fix that adds a joint, an unglossed identifier or a new term
is a new finding.

- **An accepted decision record is append-only.** Before editing a record whose `**Status:**` is
  Accepted or Superseded, ask the user with `AskUserQuestion`, naming the record and showing the
  change. A typo is a reason they may accept. A change to what the record decided is a new record,
  started with `just new-decision`, and not an edit.
- **Rewrap only the paragraphs you changed.** Prose wraps at 100 columns. A paragraph you did not
  change keeps its line breaks, even where it would wrap differently, so the diff shows only the
  fix. Never wrap a code span across two lines, and never break a line so that it starts with a
  character Markdown would read as a list marker or a heading, such as `- `, `1. ` or `#`.
- **Keep the mechanical rules.** Links stay relative, with no wikilinks, heading anchors or raw
  HTML. A requirement keeps its block ID, its verification list and its "What does this buy?"
  block. `CLAUDE.md` lists the rules doc-check reports.

## 5. Validate diagrams, then run the checker and the tests

If a changed document holds a ```` ```mermaid ```` fence, validate each one with mermaid-cli. Copy
the fence's contents to a file in the scratchpad directory and run:

```
npx --yes @mermaid-js/mermaid-cli -i <diagram>.mmd -o <diagram>.svg
```

A diagram that fails is fixed. If mermaid-cli cannot run, such as with no network, say so in the
report. Never validate a diagram by eye.

Then run both, from the repository root:

```
just check-docs
just test-docs
```

`just check-docs` must print `doc-check: clean`. `just test-docs` must pass too, because
doc-scaffold's tests run on a copy of the real vault, and an edit to a document can break them. If
either fails, fix the cause and run both again. Do not report the pass as finished while either
fails.

## 6. Report

Do not commit. Give the user:

- a table of the fixes applied: file and line, the step or rule, and what changed
- the findings left alone, because they sit in paragraphs the branch did not touch, each with its
  file, line and rule, so the user can decide whether to fix them here or later
- any decision record you were asked about, and the answer
- the result of each diagram validation, and the last lines of `just check-docs` and
  `just test-docs`
