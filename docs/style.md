# House style

How documents in this repository are written. Every document serves two readers: a person
getting up to speed, and a model reconstructing project context in a fresh session. Where each
kind of document lives, and what shape it takes on disk, is
[documentation-system.md](documentation-system.md).

Rules are sorted by what they apply to, and each rule belongs to exactly one part.

| Part | Applies to | Branches on document kind? |
|---|---|---|
| **Voice** | Every sentence and block, in every document | Never |
| **Lexicon** | Every word choice | Never |
| **Shape** | What parts a document has, and in what order | Yes — the only part that branches |
| **Rationale** | Nothing, while writing. Read it when a rule is challenged | — |

**Voice is capped at twelve rules.** A thirteenth is admitted only by showing that one of the
twelve is subsumed, dead, or wrong. The cap is what forces consolidation; without it the list
grows monotonically and each rule dilutes the others.

**A rule is admitted only on two conditions.** A document in this repository has violated it,
and it is not derivable from a rule already present. Observations from a review are raw
material: they accumulate in a companion file, `style-observations.md`, beside this one, and
enter this file only at a distillation pass, which is allowed to delete. The companion is a
table of date, document and what went wrong, with nothing edited on the way in. Distil when a
document is migrated, or when the list reaches a dozen entries: read the whole list at once and
ask what rules it implies. Several observations often collapse into one rule, or show that a
standing rule is mis-stated.

Settled for **requirements**, **specifications**, **guides** and **orientation documents**.
Decision records and whitepapers have no Shape section yet; Voice and Lexicon still bind them.

---

## Voice

### STY-V1 — A sentence carries one claim

- **Test:** count the sentence's joints — its semicolons, colons, em-dash breaks, and
  conjunctions joining two independent clauses. More than one joint is a second claim, and a
  second claim is a second sentence. Two constructions are not joints:
    - a parallel enumeration in which no item is a clause of its own, wherever in the sentence
      it sits — the commands to start a service are `init`, `fetch`, then `up`
    - a parenthetical carrying no joint of its own, in brackets or between matched em-dashes

A nested claim costs the reader what a joint costs. Keep a parenthetical simple, and let
`STY-V11` take an enumeration whose items have outgrown the sentence.

```
Before:  The writer always holds the whole system; the reader never does — and a document
         written from that vantage uses concepts no reading order has supplied.

After:   The writer always holds the whole system. The reader never does. A document written
         from that vantage uses concepts no reading order has supplied.
```

### STY-V2 — A paragraph opens with its takeaway

- **Test:** read the first sentence alone. If it does not state the paragraph's point, the
  paragraph is ordered wrong.

### STY-V3 — Everything else in the paragraph serves that takeaway

- **Test:** take each clause in turn and remove it. If nothing is lost, it stays removed. If
  something is lost but it does not serve this paragraph's takeaway, it moves to the section it
  does serve. An aside, a digression, or a closing aphorism fails one test or the other.

```
Delete:  a record is a promise, and a promise is a kind of record
Delete:  there is more to say about this, and it is said elsewhere
```

### STY-V4 — Every normative sentence names its actor

- **Test:** ask who does this. If the answer is not in the sentence, name it. A restriction
  names who cannot, and a section with two actors divides where the actor changes.

Actor and audience can differ. Where they do, the text says who it is written for.

### STY-V5 — An implied subject is named earlier in the same paragraph

- **Test:** for every pronoun, and every subject or object left out, find where it was last
  named outright. It must be in the same paragraph, or in the sentence introducing the list or
  table that follows, with no other candidate standing between. A heading is read cold and out
  of order, so it names its own subject and object.

### STY-V6 — A citation adds a source, never a claim

- **Test:** delete the citation and any identifier gloss. If the sentence stops making its
  point, the citation was carrying the claim. State the claim in full, cite trailing with a
  short gloss, and give an identifier's meaning inline at its first use in the document.

```
Before:  > Per ADR-0005. Independent settings multiply into combinations nobody tests.

After:   > **Why a single axis rather than independent settings?** Independent settings
         > multiply into combinations nobody tests. An untested combination is not a supported
         > one (ADR-0005 records the choice).

Before:  SEC-F3 governs issuance.
After:   SEC-F3 (a credential is issued to a person exactly once) governs issuance.
```

### STY-V7 — An abstraction is accompanied by an exemplar

- **Test:** name the concrete thing the reader will meet — the MAC address behind "hardware
  address", the vendor's product behind "the platform", the operating-system image behind
  "an update". The exemplar is a noun phrase in the sentence, never a worked example. Without
  one, an abstraction reads as vagueness; with one it reads as scope.

### STY-V8 — A specialist term is replaced by the action or thing it names

- **Test:** substitute what the term stands for. If the replacement is still vague, the
  substitution has not been done. A term that is ordinary in one tree may be unreadable in
  another.

```
Wrote:     proven by a walk
Repaired:  proven by hand                            — still vague; the repair failed
Correct:   proven by following the installation guide
```

### STY-V9 — Bold marks structure, never emphasis

- **Test:** bold marks question labels and table row-heads. Nothing else is bold.

### STY-V10 — A worked example is included only where the text cannot state its own boundary

- **Test:** try to state the boundary in one sentence. If it states cleanly, keep the sentence
  and add no example. If it does not, the reader is being asked to recognise a quality rather
  than check a property, and one example shows what the sentence could not. A worked example
  goes in a `[!TIP]` callout, so a reader can take or skip it whole.

This bounds worked examples alone. The inline exemplar `STY-V7` requires is not one, and is
never dropped under this rule.

### STY-V11 — An enumeration whose items need more than a clause becomes a list

- **Test:** write the enumeration as one sentence. If an item needs a parenthetical, a citation,
  or a clause of its own to be understood, the enumeration is a list instead. Items that are not
  clauses of their own stay in the sentence.

---

## Lexicon

**Mint no term where an ordinary phrase serves.** Every new term costs the reader, and the cost
is paid on every later reading.

The table grows as terms are settled. A row is added when a review finds two words for one
thing, or one word for two things, and records which to write.

| Write | Never write | Because |
|---|---|---|
| a person's role by name | operator, in a sentence about who may do what | "operator" conflates roles with different access |
| operator, for any human | — | "without operator intervention" is correct |
| `docs/spec/planner/api.md`, `packages/planner/` | a bare filename | a path relative to nowhere makes the reader guess |
| porcelain, plumbing | surface, internals | the keyword appears in specification section titles |
| item, for one entry of `TODO.md` | task, card, ticket, issue | the documentation system's word; a ticket lives in another tracker |
| component, for the unit documented | module, subsystem, node, part | a component is what makes promises of its own, and `docs/components.md` registers each one |
| package, for the unit the package manager builds | crate, module, library | a package and a component need not line up, so the two words are never swapped |
| system, for a set of components with promises of their own | platform, suite, product | the planner, the bookings system and the web app are systems |
| address, for the name a document uses for a system, component or concern | path, key | `planner/api` is an address, and it is also where the documents live |
| outside the vault, for documentation in a package's own folder | legacy | the vault describes where documentation is, not how old it is |

**A word is defined by what is done at its level**, not by its position in a taxonomy. Nobody
builds a category. A package is what the package manager builds. A component is what makes promises of its own. An
artefact is what a hash attests.

Where vocabulary carries a system, show how the terms vary. Put the one-of-a-kind case beside
the bundle, and give the discriminating test the reader applies to the next new thing.

**A comparison teaches a new concept, or it is deleted.** Having defined something, a comparison
to what the reader already knows will settle it — a template and the documents made from it are
a class and its instances. Everywhere else the plain word serves: a keyword appears in a section
title, it does not ride in one. The test is to delete the comparison. Keep it if the definition it
follows becomes harder to grasp, and drop it if only the prose reads flatter.

---

## Shape

### Every document

**STY-S1 — A document assumes at most its own tree's README.** Anything more is declared in one
line at the top: `**Assumes** [document](path.md)`. The declaration is a budget, not a
substitute for teaching.

**STY-S2 — Concepts are introduced before first use**, in dependency order, at one altitude. A
short overview beats definitions scattered through the sections that need them. A process the
document depends on is established as a subject in its own sentences before anything refers to
it in passing.

**STY-S3 — Normative text above, rationale below.** Rationale goes in question-labelled
blockquote blocks: a bold question label, one question per block, narrative prose. A
discovered-the-hard-way consequence stays a callout, because a question would soften it.

**STY-S4 — A citation names a stable address.** A document, a numbered section (`§4`) and an
identifier (`SHR:DOC-CHECK-F3`, `ADR-0001`) are stable addresses. A paragraph, a sentence and a point
partway through a section are not. Cite the smallest stable address that contains what you mean,
and reiterate in place whatever the current section needs. The checker resolves every `§4`
against the sections its target defines.

**STY-S5 — No document cites the live work list, except to say what waits on an item.** The list
is live, and an item cited from elsewhere leaves it as soon as it is done. A document that needs to
say work is owed says so itself. A statement that holds only until an item is done cites it as
`until TODO-NN is done`. That stays true once the item leaves the list, because an identifier the
list no longer holds names an item that is done. The file that defines the list's rules and the
changelog cite it freely, because one defines its terms and the other receives its finished items.
The checker enforces this.

### Requirements

Each requirement is three parts, in this order, typographic — no subheadings.

| Part | What it is | Written for |
|---|---|---|
| Body | The promise, in observable behaviour, never mechanism | The release manager deciding what was contracted |
| Verification | The proof | Whoever builds the gate |
| Blockquote | Disambiguation: corner cases, boundaries, see-also | The reader who arrived confused or curious |

**The body stays at the abstraction; the disambiguation may penetrate it.** A concrete case in
the body narrows the promise. The body also may not absorb mechanism. Where a body cannot be
both generic and plain, the missing piece is usually a name.

**Cross-references live in the disambiguation.** The body stays citation-light.

**The verification is a bulleted list of short checks.** Each item is one short description of
how to establish that the requirement is met. A single check is still a list. Setup shared by
every check sits on the label line.

**The first question is always "what does this buy?"** If it has no answer, the requirement is
misstated or should not exist.

The disambiguation is optional and never filler. A requirement with none is the shape working,
not a gap.

### Specifications

**A requirements document says what must be true and how to check it. A specification says how it
is built.** It is the design of one submodule, written so that someone who has not read the code
could implement it. That is the test: if a capable reader could not build the thing from the
document, it is not a specification yet.

**Every specification has the same eight sections, in this order.** A reader who knows the shape
knows where to look before opening the file, which is the whole point of fixing it.

| | Section | Holds |
|---|---|---|
| 1 | Purpose | What this is for |
| 2 | Scope | What it covers, what acts on it, and what is deliberately absent |
| 3 | Interface | The surface, in the five parts below |
| 4 | Behaviour | What it does — the section a reader implements from |
| 5 | Resources | What it creates or stores, how that is named, who owns it, what protects it |
| 6 | Quality attributes | Performance, security, availability, robustness |
| 7 | Requirements this satisfies | The claim table |
| 8 | Open | What is undecided |

**A part with nothing in it routes rather than disappearing.** "None. A developer reaches this
through the command-line tool" tells a reader where to go; an absent heading leaves them
wondering whether the question was ever put. An empty section is a question nobody asked, not a
question with no answer.

**Section 3 has four parts. The fourth is the outbound half.**

| | Part | Answers |
|---|---|---|
| 3.1 | User interface | Who calls this |
| 3.2 | Application interface | Who calls this |
| 3.3 | Programming interface | Who calls this |
| 3.4 | Systems this drives | What this calls, and what it creates there |

**Where 3.4 names a borrowed system, it teaches that system's vocabulary first.** `STY-S2` binds a
borrowed vocabulary exactly as it binds the project's own, and a reader who has never written
against the thing being driven is the ordinary case rather than the exception. Depth belongs to
that system's own documentation, named rather than linked.

**Section 4's granularity is set by section 3.**

| Where the surface is | Section 4 is one subsection per |
|---|---|
| 3.1 | Command or use case |
| 3.2, 3.3 | Operation: inputs, effect, output, what it refuses, what a second call does |
| 3.4 | Operation of the interface this implements, and how it is realised here |

**Section 4 states only what this implementation adds.** Where the abstract contract is the whole
story, the operations go in a table and nothing more is said, so the section never restates the
document it implements. Behaviour crossing every operation, such as a guard, is stated once at the
top rather than in each.

**Section 4 is verified against the source, never inferred from the interface.** Behaviour read
off a method signature is a guess, and a guess reads exactly like a fact. The claim most worth
checking is that an operation has nothing of its own to add: a first draft that made it for six
operations was wrong about four, one of them a capability the component did not implement at all.

**Section 6 cites requirements; it never declares them.** Requirements, at system and component
level, live in their own tree. Section 6 says what this component's security or availability
properties are, naming the promise each one serves. The claim table in section 7 stays the
complete record, and section 6 is its reader-facing view.

**Where a specification has both halves, `Porcelain:` and `Plumbing:` still mark section 4's
subsections** — the surface consumers use, then the machinery for those who change it. Porcelain
never depends on plumbing having been read.

**Where section 4 is organised by use case, each opens with `Invoked from:`**, naming the literal
commands or triggers and saying what is automatic. What follows the label is a complete sentence
that stands without it.

**A specification never argues against the alternative.** State what is, and cite the record that
chose it.

**A specification's porcelain is complete when writing the runbook from it is mechanical.** A
section that leaves a runbook question unanswerable is missing semantics.

**A format read by many documents gets its own specification**, rather than a section inside the
specification of whichever program writes it.

Mechanisms belong at class level: sequence diagrams, named services, the shape of an exchange.
Code-level detail does not.

### Guides

**A guide is numbered acts; a specification is standing truths.** A specification sentence stays
true while nobody acts. A guide line is an act.

Each step names the exact file by repository-relative path or the exact command, and says what
successful output looks like. The list ends with how to verify the change took effect.

**Expected output is captured from a real run, never invented.** A runbook for verbs that do not
run yet is not written yet.

Where a specification finds itself saying "then run…", that sentence belongs in a guide.

### Orientation documents

**The system design decomposes by role, then use case.** Use cases own the path documents, and
roles are how a reader finds theirs. The design routes rather than teaches: one line per use
case saying what its path covers. A sparse path is a visible register of documentation debt.

**A path is a reading order, not a retelling.** It takes the reader through its use case's
requirements, decisions and specifications in the order that teaches, and then into the trees. It
defines nothing and cites everything.

**A path opens by answering "am I in the right place?"** The answer is bullets a reader triages
in seconds: the concrete tasks this path serves, then one short list per near-miss destination.
The system follows in one paragraph of simple promises, with no mechanism names.

**A path's bullet carries the claim, the scenario that makes it real, and the reader's working
implication.**

**A path names no audience.** It is written to the intersection of the roles routed to it.
Role-specific material sits in a marked aside.

---

## Final pass

Run these against the document before committing.

1. Delete every link. Does every sentence still make its point? (`STY-V6`)
2. Count the joints in each sentence. (`STY-V1`)
3. Read the first sentence of every paragraph, in order. Do they carry the argument? (`STY-V2`)
4. Read as someone who has read only the declared prerequisites. Can every sentence be parsed?
   (`STY-S1`, `STY-S2`)
5. Validate every Mermaid diagram with mermaid-cli, never by eye.
6. Run the documentation checker.

---

## Rationale

Read when a rule is challenged. Nothing here is normative.

**STY-V1 — why the test counts joints when the rule is about claims.** The two arrive
together. Claims are joined artificially, and the joining is what overloads the reader.
Counting joints therefore counts claims. A sentence carrying many claims across few joints was never
observed during the markup exercise that settled the register, and the rule needs no second
test for it. A count is also the only form the rule survives in, because a judgement about
density returns one defensible aside at a time.

**STY-V3 — where the rule came from.** The two deleted examples are the two ways an aside fails.
The first decorated a point two plain sentences had already made; the second said nothing at
all.

**STY-V6 — what a carried citation costs.** A bare "Per ADR-0001." forces the reader to click
out of confusion rather than curiosity, and hides how many claims the sentence makes. A human
cannot resolve an identifier from memory, and cannot see from a reference that its target was
superseded.

**STY-V8 — why the first repair failed.** "Proven by hand" traded one vagueness for another.
The plain phrase is usually the more precise one, and where it is not, the sentence was hiding
a claim it should state.

**Requirements — why the FAQ shape.** Requirements are read by random access, so each one is
self-contained. Deliberate redundancy is correct there. During a first migration to this shape,
two requirements carried commentary that answered only a peripheral question while the
requirement's purpose was written nowhere. The mandatory first question is what made the hole
visible.

**Requirements — why the body stays generic.** One requirement names the MAC address only in its
disambiguation. Another once carried a whole second program's shape in its body as if it were the
promise. Two more circumlocuted until the two kinds of change they described were named.

**STY-V11 — where the rule came from, and what it measures.** The failure is losing the
opening of the sentence before reaching the next item. A list of items survives a sentence; a
list of phrases does not. One requirement's "two things" was two items in prose, the first running
three lines through a parenthetical and a citation, so the count was lost before the second
arrived and the sentence had to open with "And" to reconnect them. Another's "two other promises"
is the same construction with short items, and reads correctly, which is what the clause bound
separates. The rule is also why a verification bullet is one confirmation per item.

**Requirements — why a single check is still a list.** The verification is read by whoever
builds the gate, one check at a time, and a list is what makes each of them separately
actionable. Holding the form constant means a requirement that grows a second check does not
change shape, and a reader never has to notice which form they are looking at.

**STY-S4 — why stability rather than wholeness.** The rule began as a specifications rule,
where the section is the addressable unit and a reference partway through one rots. Generalised
to every document it forbade citing a requirement, which is the unit requirements are read and
cited by. Identifiers exist so that a citation resolves anywhere, and a rule banning their use
defeats them.

**Voice — why twelve.** An earlier style guide grew from under a thousand words to nearly four
thousand in twenty-seven commits, and not one commit reduced it. Every observation was appended;
none was ever absorbed. A cap is the only mechanism that makes a distillation pass do work.

**Lexicon — why it may grow freely.** A table is read by random access, so an extra row costs
nothing to the rows around it. Only Voice is read in bulk and applied per sentence.
