# The pages component

What the component `planner/pages` promises to the components that use it, and through them to
travellers. The pages component holds a trip's pages, where travellers write up their research by
hand. It holds the tree the pages form, the text of each, the links between them, and the pages
travellers have deleted. It applies each edit travellers make to them, and searches them. The
component registry, `components.md`, gives it the prefix `PLN:PAGES`.

Three roles appear below. A caller is a component that uses the pages component, such as the web
app. The traveller and the admin are the roles `requirements/README.md` defines.

A trip's pages form a tree, with links between any two (ADR-0011, a trip's pages form a tree, with
links between any two):

- **A page** has a title, and text written in Markdown, the plain-text format for headings, lists,
  tables, checklists and links. Every page belongs to one trip.
- **The tree.** Each page sits under at most one other page, its parent, or at the top of the trip.
  The pages under one parent are in an order the traveller gives.
- **The graveyard** holds the pages a traveller has deleted. A page is in the tree or in the
  graveyard, never both.
- **A link** to a page names the page by its identifier, which the pages component gives each page
  and never changes. It holds neither the page's title nor its place in the tree.

A change is one edit to a trip's pages, such as moving a page or rewriting its text.

---

## Functional requirements

### PLN:PAGES-F1 — The pages of a trip form a tree, which a caller rearranges freely

The pages component adds a page under any page in the tree, or at the top, at any place among the
pages already there. It renames a page, and moves a page, with every page beneath it, under any
other page in the tree or to the top. It refuses to move a page under itself or under a page beneath
it, and says why. The pages under one parent keep the order the changes gave them. ^pln-pages-f1

- **Verification:** on a trip with the pages Chile, Santiago under Chile, and Eating in Santiago
  under Santiago,
    - move Santiago to the top, and confirm Eating in Santiago is still under it
    - move Chile under Eating in Santiago, and confirm it is refused, with the reason
    - add W trek under Chile, then move Santiago under Chile, before W trek, and confirm the pages
      under Chile read Santiago, W trek
    - rename Santiago to Santiago de Chile, and confirm the tree is otherwise unchanged

> **What does this buy?** A long trip's research stays grouped, such as a country's cities under
> the country, in whatever groups the traveller chooses (`PLN-F8`).

### PLN:PAGES-F2 — A page's text is kept exactly as written, up to a limit on its length

The pages component keeps a page's title and text exactly as the caller gives them, character for
character, and imposes no structure on the text. It refuses a title that is empty, or longer than
200 characters. It refuses text longer than 100,000 characters. Each refusal says why. ^pln-pages-f2

- **Verification:** on a trip with one page,
    - write text holding a heading, a checklist, a table, a link to a website and a line in Chilean
      Spanish, and confirm it reads back unchanged
    - write text of exactly 100,000 characters, and confirm it is accepted
    - write text of 100,001 characters, and a title of 201 characters, and confirm each is refused,
      with the reason, and the page is unchanged

> **What does this buy?** A traveller writes research however suits them (`PLN-F7`). The limit
> keeps the copy of a trip each phone holds to a size a phone can carry (ADR-0004, a trip is
> read-only offline).

> **How long is 100,000 characters?** About 15,000 words, or some thirty printed pages. A
> traveller who needs more splits the page in two.

### PLN:PAGES-F3 — Deleting a page moves it, with the pages beneath it, to the graveyard

The pages component gives the number of pages beneath a page in the tree, for the caller to show
before a delete. Deleting a page moves it, with every page beneath it, from the tree to the trip's
graveyard. The pages component refuses to change, move or delete a page in the graveyard, or to put
a page under one, and says why. ^pln-pages-f3

- **Verification:** on the trip that `PLN:PAGES-F1`'s verification sets up,
    - confirm Santiago has one page beneath it
    - delete Santiago, and confirm that neither Santiago nor Eating in Santiago is in the tree, and
      that both are in the graveyard
    - rename Eating in Santiago, and add a page under it, and confirm each is refused, with the
      reason

> **What does this buy?** A traveller is told how much a delete takes before they confirm it
> (`PLN-F8`). The research deleted is kept, so it can be restored.

### PLN:PAGES-F4 — The graveyard is listed with each page's title, and a page restored returns to its old parent

The pages component lists the pages deleted, most recently deleted first. Each page listed gives its
title, and the number of pages that went to the graveyard with it. It gives the title and the text
of any page in the graveyard. Restoring a page in the graveyard returns it to the tree, with every
page that went to the graveyard with it, under its old parent, in its old place among the pages
there. It returns at the top of the trip, after the pages there, when its old parent is not in the
tree. ^pln-pages-f4

- **Verification:** on the trip that `PLN:PAGES-F1`'s verification sets up, with Santiago deleted,
    - confirm the graveyard lists Santiago, with one page that went with it
    - read Eating in Santiago, and confirm its text reads as it was written
    - restore Santiago, and confirm it returns under Chile, in its old place, with Eating in
      Santiago beneath it
    - delete Santiago, then Chile, and confirm the graveyard lists Chile first, then Santiago
    - restore Santiago, and confirm it returns at the top of the trip, after every page there

> **What does this buy?** A traveller sees, by title, what has been deleted, and an admin restores
> a branch deleted by mistake (`PLN-F13`).

> **Who sees the list, and who may read or restore a page in it?** Each traveller sees only the
> deleted pages they could see before the delete. Only an admin reads or restores one. The caller
> decides both, with the access system, which handles accounts and invitations
> (`PLN:PAGES-NR2`).

> **Can a page be deleted for good?** No. The graveyard only grows (`PLN:PAGES-NR5`).

### PLN:PAGES-F5 — A link names its page, and says whether the page is in the tree or the graveyard

The pages component writes a link to a page, given the page and the words to show, as a link in
Markdown that any Markdown reader shows as a link. It reads a link back as the page it names. For
any page named, it says whether the trip holds the page in its tree, holds it in its graveyard, or
does not hold it. A link still names its page after the page is renamed, moved, deleted or
restored. ^pln-pages-f5

- **Verification:** on the trip that `PLN:PAGES-F1`'s verification sets up,
    - write a link to Santiago with the words "the city", and confirm it reads back as naming
      Santiago
    - confirm the link shows as a link in a Markdown reader, such as GitHub's
    - rename Santiago and move it to the top, and confirm the link still names it, in the tree
    - delete Santiago, and confirm the link names a page in the graveyard
    - read a link naming a page the trip never held, and confirm the trip does not hold it

> **What does this buy?** Research cuts across the tree, and a link still finds its page after the
> tree is rearranged (`PLN-F9`). The trip's calendar names a page the same way, from a stretch,
> which is a place and the dates a traveller expects to be there, or from a firm item, which is
> something fixed to a date (`PLN-F11`).

### PLN:PAGES-F6 — A new trip's pages can start with a page for each of its countries

The pages component starts a new trip's pages empty, or with one page at the top of the trip for
each country the caller gives, titled with the name the caller gives, in the order given. Each is
then an ordinary page. ^pln-pages-f6

- **Verification:**
    - start a trip's pages with Chile, then Argentina, and confirm the tree holds those two pages at
      the top, in that order
    - rename, move and delete the page Argentina, and confirm each is accepted
    - start a trip's pages with no countries, and confirm the tree holds no page

> **What does this buy?** Research for a trip across several countries starts country by country
> (`PLN-F10`).

### PLN:PAGES-F7 — A search lists every page in the tree whose title or text holds the words searched for

Given words to search for, the pages component lists every page in the tree whose title or text
holds them, in the order of the tree. Capitals and accents are ignored. Each page listed gives the
words around its first three matches, as written. A search never lists a page in the graveyard. It
refuses a search for no words, and says why. ^pln-pages-f7

- **Verification:** on the trip that `PLN:PAGES-F1`'s verification sets up, with "Try the empanadas
  in Valparaíso" in the text of Eating in Santiago,
    - search for "empanadas in", and confirm Eating in Santiago is listed, with "Try the empanadas
      in Valparaíso" around the match
    - search for "VALPARAISO", and confirm the same page is listed
    - search for "santiago", and confirm Santiago and then Eating in Santiago are listed
    - delete Santiago, search for "empanadas", and confirm no page is listed
    - search for nothing but spaces, and confirm it is refused, with the reason

> **What does this buy?** A traveller finds research by a word they remember, with or without a
> connection (`PLN-F12`).

### PLN:PAGES-F8 — Each page is written in a stored form of its own, and read back unchanged

The pages component writes each page in a stored form of its own, with its place in the tree, and
reads that form back as the same page. It refuses a stored form it did not write, and says why. It
also gives the pages that a phone keeps, for reading a trip with no connection: every page in the
tree, and no page in the graveyard. ^pln-pages-f8

- **Verification:**
    - write every page of the trip that `PLN:PAGES-F1`'s verification sets up, in its stored form,
      read each back, and confirm the pages read back are equal to the pages written
    - delete Santiago, take the pages for a phone, and confirm they hold Chile only
    - read back a stored form that is not a page's, and confirm it is refused, with the reason

> **What does this buy?** Each page is stored on its own, so the access system can give a traveller
> only the pages they may see. The copy on each phone holds the tree and nothing more (ADR-0004, a
> trip is read-only offline).

### PLN:PAGES-F9 — A change gives the same pages wherever it is applied, and a refused change leaves them as they were

Two copies of a trip's pages that apply the same changes in the same order hold the same pages,
wherever each is held. A change the pages component refuses, such as one naming a page the trip
does not hold, leaves every page as it was. The refusal says what was refused and why. ^pln-pages-f9

- **Verification:** on two copies of the same trip's pages,
    - apply the same ten changes, in the same order, to each, and confirm the two are equal
    - rename one page twice, and confirm the second name stands
    - move a page the trip does not hold, and confirm it is refused, with the reason, and that
      every page is unchanged

> **What does this buy?** A change a traveller makes is applied to the one copy held online, and
> every other traveller sees the same result (`PLN-F6`). No change is ever half applied.

---

## Non-functional requirements

### PLN:PAGES-NFR1 — The pages component works without a connection, and the same on every device

Everything the pages component promises works on a device with no connection. Its results do not
depend on the language or the time zone the device is set to. ^pln-pages-nfr1

- **Verification:**
    - on a phone with no connection, confirm `PLN:PAGES-F5`, `PLN:PAGES-F7` and `PLN:PAGES-F8` still
      hold
    - on two devices, one set to English and London time and one to Turkish and Tokyo time, search
      the same pages for "İstanbul" and for "istanbul", and confirm the results are the same

> **What does this buy?** A traveller reads and searches a trip on a phone with no connection
> (`PLN-F12`). Two travellers whose phones are set differently find the same pages.

> **Can a page then be changed with no connection?** No. The planner accepts a change only from a
> device with a connection (ADR-0004, a trip is read-only offline). The pages component runs on the
> phone to read and search the pages it holds.

> **Why Turkish?** Turkish has a dotted and a dotless capital I. Changing capitals the way a
> Turkish device does would find different pages than an English device.

---

## Non-requirements

| Identifier | The pages component does not | Because |
|---|---|---|
| **PLN:PAGES-NR1** | Store a trip's pages, or send a change from one device to another | The component that holds the copy online does that. It is not yet registered |
| **PLN:PAGES-NR2** | Decide who may see or change a page, or read or restore a page in the graveyard | The access system, which handles accounts and invitations, decides |
| **PLN:PAGES-NR3** | Show a page's Markdown as formatted text | The web app shows it |
| **PLN:PAGES-NR4** | Hold images or attached files | A page holds a title and text (ADR-0011, a trip's pages form a tree, with links between any two) |
| **PLN:PAGES-NR5** | Delete a page from the graveyard | The graveyard only grows, so a delete made by mistake can always be undone (ADR-0011) |
| **PLN:PAGES-NR6** | List the pages that link to a page | Finding the links back to a page is future work |
| **PLN:PAGES-NR7** | Merge changes made on two devices while apart | A trip changes only while the traveller is online (ADR-0004, a trip is read-only offline) |

^pln-pages-nr
