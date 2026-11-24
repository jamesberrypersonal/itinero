# The checklists component

What the component `planner/checklists` promises to the components that use it, and through them to
travellers. The checklists component holds each traveller's checklists, on a trip or kept as
templates. It applies each change a traveller makes to one, and copies one into another. The
component registry, `components.md`, gives it the prefix `PLN:CHECKLISTS`.

A caller is a component that uses the checklists component, such as the web app. The traveller is
the role `requirements/README.md` defines.

A traveller's checklists are their own, and start from templates they keep outside any trip
(ADR-0024, a traveller's checklists are their own):

- **A checklist** has a title, and a list of items in the order the traveller gives. It belongs to
  one traveller, and either to one trip or to none.
- **A template** is a checklist that belongs to no trip. A traveller keeps their templates to start
  each trip's checklists from.
- **An item** has text, and on a trip's checklist it is ticked or not. An item of a template is
  never ticked.

A change is one edit to one checklist, such as adding an item or ticking one.

---

## Functional requirements

### PLN:CHECKLISTS-F1 — A checklist holds items in the order a caller gives, which it rearranges freely

The checklists component adds an item to a checklist at any place among its items. It rewrites an
item's text, moves an item to any other place, and removes an item. It renames a checklist. The
items keep the order the changes gave them. ^pln-checklists-f1

- **Verification:** on a template titled Before leaving, with the items Passport valid for six
  months, Copies of documents and Travel insurance,
    - add Order pesos after Copies of documents, and confirm the items read Passport valid for six
      months, Copies of documents, Order pesos, Travel insurance
    - move Travel insurance to the start, and confirm it is the first item
    - rewrite Copies of documents as Copies of passport and insurance, remove Order pesos, and
      confirm the items read Travel insurance, Passport valid for six months, Copies of passport and
      insurance
    - rename the template Before any trip, and confirm its items are unchanged

> **What does this buy?** A traveller keeps a list in the order they work through it (`PLN-F17`,
> `PLN-F18`).

### PLN:CHECKLISTS-F2 — A title and an item's text are kept as written, up to a limit on each

The checklists component keeps a checklist's title and each item's text as the caller gives them,
trimmed of spaces at each end. It refuses a title or an item's text that is empty, or that holds a
line break. It refuses a title longer than 200 characters, an item's text longer than 500, and a
checklist of more than 200 items. Each refusal says why. ^pln-checklists-f2

- **Verification:** on a checklist with one item,
    - rewrite the item as "Pesos — about 50 000 CLP", and confirm it reads back unchanged
    - rewrite it with text of exactly 500 characters, and confirm it is accepted
    - rewrite it with text of 501 characters, with text holding a line break, and with nothing but
      spaces, and confirm each is refused, with the reason, and the item is unchanged
    - add items until the checklist holds 200, add one more, and confirm it is refused, with the
      reason

> **What does this buy?** An item reads as one line on a phone's screen. The limits keep each
> checklist to a size a phone carries easily.

> **Can an item hold a link, or formatting?** No. An item is plain text. Research with links goes on
> a page (`PLN-F7`).

### PLN:CHECKLISTS-F3 — An item of a trip's checklist is ticked and unticked, and an item of a template never is

The checklists component ticks and unticks any item of a checklist on a trip. It gives how many of
a checklist's items are ticked, out of how many. It refuses to tick an item of a template, and says
why. ^pln-checklists-f3

- **Verification:** on a checklist on a trip, with the three items of Before leaving,
    - tick Passport valid for six months, and confirm one of the three items is ticked
    - tick it again, and confirm it stays ticked, and one item is ticked
    - untick it, and confirm none is ticked
    - on the template Before leaving, tick an item, and confirm it is refused, with the reason

> **What does this buy?** A traveller sees what is done and what is left, on each checklist
> (`PLN-F18`).

> **Why is an item of a template never ticked?** A template is what each trip starts from. A tick
> on it would start each trip with that item done.

### PLN:CHECKLISTS-F4 — A copy starts a checklist on a trip from a template, or a template from a checklist, with no item ticked

The checklists component copies a checklist into a new one, for the same traveller, on a trip or as
a template. The copy holds the title and every item of the checklist copied, in the same order, with
no item ticked. A change to either never changes the other. ^pln-checklists-f4

- **Verification:** with the template Before leaving,
    - copy it to a trip, and confirm the copy holds its title and three items, in order, with none
      ticked, and belongs to the same traveller
    - tick an item of the copy and add an item to it, and confirm the template is unchanged
    - remove an item from the template, and confirm the copy is unchanged
    - copy the copy as a template, and confirm the new template holds the copy's four items, none
      ticked, and belongs to no trip

> **What does this buy?** A trip's checklist starts from the list a traveller keeps, and a list
> improved on one trip is kept for the next (`PLN-F17`, `PLN-F18`).

> **Can a copy go to another traveller?** No. A copy belongs to the traveller whose checklist was
> copied (`PLN:CHECKLISTS-NR2`).

### PLN:CHECKLISTS-F5 — Each checklist is written in a stored form of its own, and read back unchanged

The checklists component writes each checklist in a stored form of its own, with every item and
tick, and reads that form back as the same checklist. It refuses a stored form it did not write,
and says why. ^pln-checklists-f5

- **Verification:**
    - write the template Before leaving, and a checklist on a trip with one item ticked, in their
      stored form, read each back, and confirm each equals the checklist written
    - read back a stored form that is not a checklist's, and confirm it is refused, with the reason

> **What does this buy?** Each checklist is stored and sent on its own, so it is given only to the
> traveller it belongs to.

### PLN:CHECKLISTS-F6 — A change gives the same checklist wherever it is applied, and a refused change leaves it as it was

Two copies of a checklist that apply the same changes in the same order hold the same checklist,
wherever each is held. A change the checklists component refuses, such as one naming an item the
checklist does not hold, leaves the checklist as it was. The refusal says what was refused and
why. ^pln-checklists-f6

- **Verification:** on two copies of the same checklist,
    - apply the same ten changes, in the same order, to each, and confirm the two are equal
    - tick an item and untick it, and confirm the second change stands
    - remove an item the checklist does not hold, and confirm it is refused, with the reason, and
      that the checklist is unchanged

> **What does this buy?** A change a traveller makes on one device is applied to the copy held
> online, and each of their other devices shows the same result. No change is ever half applied.

### PLN:CHECKLISTS-F7 — A traveller's checklists keep the order a caller gives them, and a new one goes last

A traveller's checklists on one trip, and their templates, are each listed in an order of their
own. The checklists component puts a new checklist, or a copy, after every other in its list. It
moves a checklist to any place in its list by changing that checklist alone. ^pln-checklists-f7

- **Verification:** with a traveller's templates Before leaving, then Packing,
    - make the template Last day, and confirm the templates read Before leaving, Packing, Last day
    - move Last day to the start, and confirm the templates read Last day, Before leaving, Packing,
      and that no template but Last day changed
    - copy Packing to a trip on which the traveller holds one checklist, and confirm the copy is
      listed second there, and that the templates' order is unchanged
    - make a thousand checklists, each moved before the last one made, and confirm each move
      changes only the checklist moved

> **What does this buy?** A traveller puts the list they need now at the top (`PLN-F17`,
> `PLN-F18`).

> **Why change one checklist alone?** Each checklist is stored and sent on its own. A move that
> rewrote its neighbours would send every one of them to each of the traveller's devices.

---

## Non-functional requirements

### PLN:CHECKLISTS-NFR1 — The checklists component works without a connection, and the same on every device

Everything the checklists component promises works on a device with no connection. Its results do
not depend on the language or the time zone the device is set to. ^pln-checklists-nfr1

- **Verification:**
    - on a phone with no connection, confirm `PLN:CHECKLISTS-F3`'s count of ticked items and
      `PLN:CHECKLISTS-F5` still hold
    - on two devices, one set to English and London time and one to Turkish and Tokyo time, apply
      the same changes to the same checklist, and confirm the two are equal

> **What does this buy?** A traveller reads their checklists on a phone with no connection
> (`PLN-F18`).

> **Can a checklist then be ticked with no connection?** No. The planner accepts a change only from
> a device with a connection (ADR-0004, a trip is read-only offline).

---

## Non-requirements

| Identifier | The checklists component does not | Because |
|---|---|---|
| **PLN:CHECKLISTS-NR1** | Store a checklist, or send a checklist or a change from one device to another | The online side holds each traveller's checklists and templates, and sends each to that traveller's devices |
| **PLN:CHECKLISTS-NR2** | Decide who may see or change a checklist | Its caller gives each checklist only to the traveller it belongs to (ADR-0024, a traveller's checklists are their own) |
| **PLN:CHECKLISTS-NR3** | Show a checklist | The web app shows it, in a section of its own |
| **PLN:CHECKLISTS-NR4** | Remember which template a checklist was copied from | A copy stands alone, so a change to a template changes no trip already under way (ADR-0024) |
| **PLN:CHECKLISTS-NR5** | Hold anything in a checklist but its title and its items, such as a date to finish by, notes, or a link to a page | A checklist is a list to tick. A page holds the rest |
| **PLN:CHECKLISTS-NR6** | Merge changes made on two devices while apart | A trip changes only while the traveller is online (ADR-0004, a trip is read-only offline) |
| **PLN:CHECKLISTS-NR7** | Delete a checklist, or keep one deleted for restoring | Whatever stores a checklist deletes it, for good, once its traveller confirms (ADR-0024, a traveller's checklists are their own) |

^pln-checklists-nr
