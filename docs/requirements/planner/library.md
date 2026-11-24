# The library

What the component `planner/library` promises to the components that use it, and through them to
travellers. The library holds each traveller's checklist templates online, outside any trip. It
applies each change a traveller makes to one of their templates, and keeps each of the traveller's
devices up to date with their library. The component registry, `components.md`, gives it the prefix
`PLN:LIBRARY`.

Two roles appear below. A device is the app a traveller uses, on a computer or a phone, which the
web app provides. The traveller is the role `requirements/README.md` defines.

A template is a checklist a traveller keeps outside any trip, with a title and items in their
order, to start a trip's checklists from. `requirements/planner/checklists.md` defines checklists,
templates and the changes to them. A traveller's library is every template they keep, in the order
they give. A traveller's library is their own, and no other traveller sees it (ADR-0024, a
traveller's checklists are their own).

---

## Functional requirements

### PLN:LIBRARY-F1 — A traveller adds a template to their library, empty or copied from a checklist of their own

A signed-in traveller adds a template to their library, either empty with a title, or copied from
one of their own checklists, with no item ticked. The library puts a new template after every other
it holds. It refuses a copy of a checklist that belongs to another traveller, and says
why. ^pln-library-f1

- **Verification:** on a running system, as a signed-in traveller with an empty library,
    - add an empty template titled Before leaving, and confirm the library holds it alone
    - copy the traveller's checklist Packing, from a trip, with two of its items ticked, and confirm
      the library holds Before leaving, then Packing, with no item ticked
    - copy a checklist belonging to another traveller, and confirm it is refused, with the reason

> **What does this buy?** A traveller writes the list they keep for every trip once, or keeps a list
> they improved on one trip for the next (`PLN-F17`).

### PLN:LIBRARY-F2 — A change is applied only to a template of the traveller's own

The library applies each change a traveller makes to one of their own templates, such as adding an
item or moving the template to the top. It refuses a change naming a template the traveller does
not hold, the same way whether another traveller holds it or nobody does. A refused change leaves
the library as it was, and says why. ^pln-library-f2

- **Verification:** on a running system, with the library of `PLN:LIBRARY-F1`'s verification,
    - add the item Travel insurance to Before leaving, and confirm it holds it
    - move Packing before Before leaving, and confirm the library lists Packing first
    - as another traveller, rename Before leaving by its identifier, and confirm it is refused in the
      same way as a rename of a template nobody holds, and that the template is unchanged
    - tick an item of Before leaving, and confirm it is refused, with the reason, and that the
      template is unchanged

> **What does this buy?** A traveller's library changes only as they change it (`PLN-F17`).

> **Why is a template another traveller holds refused like one nobody holds?** A refusal that told
> them apart would say that the template exists.

### PLN:LIBRARY-F3 — A traveller deletes a template for good

A traveller deletes any of their own templates. The library then holds nothing of it, and gives it
to no device again. Checklists already copied from it are unchanged. ^pln-library-f3

- **Verification:** on a running system, with a trip's checklist copied from Before leaving,
    - delete Before leaving, and confirm the library no longer holds it
    - confirm the trip's checklist still holds its items and ticks
    - delete Before leaving again, and confirm it is refused, with the reason

> **What does this buy?** A traveller keeps their library to the lists they still use (`PLN-F17`).

> **Is the traveller asked first?** Yes. The web app asks before it sends a delete, since nothing
> restores a template once deleted (ADR-0024).

### PLN:LIBRARY-F4 — Each of a traveller's devices catches up on every template that changed while it was away

A device catches up on its traveller's library whenever it asks. It is given every template added
or changed since it last caught up, and learns of every template deleted since. A device that has
never caught up is given the whole library. ^pln-library-f4

- **Verification:** on a running system, with one traveller signed in on two devices,
    - on the first, add a template, change another, and delete a third
    - catch the second up, and confirm its library equals the first's
    - catch the second up again, with nothing changed, and confirm it is given no template's text
    - sign in on a third device, catch it up, and confirm it is given the whole library

> **What does this buy?** A traveller's library is the same on their phone and their computer, and a
> phone keeps a copy to read with no connection (`PLN-F17`).

> **Is a device with the library open told of a change at once?** No. A device catches up when
> Itinero opens or comes to the front, which is enough for a list one traveller changes
> (`PLN:LIBRARY-NR1`).

### PLN:LIBRARY-F5 — A traveller's library holds at most 100 templates

The library refuses a template added to a library that holds 100, and says why. ^pln-library-f5

- **Verification:** on a running system,
    - fill a traveller's library with 100 templates, add one more, and confirm it is refused, with
      the reason
    - delete one, add one, and confirm it is accepted

> **What does this buy?** A library whose every template holds its largest checklist stays small
> enough for a phone to keep a copy of.

---

## Non-functional requirements

### PLN:LIBRARY-NFR1 — Nothing of a library leaves the library except to its traveller

The library gives a traveller's devices their own templates, and nothing of any other traveller's
library: no template, no title and no count. That holds whatever the device asks for. ^pln-library-nfr1

- **Verification:** with a device altered to send any request, as a traveller whose library is
  empty, while another traveller's library holds Before leaving,
    - catch up from the start, and confirm nothing is given
    - change and delete Before leaving by its identifier, and confirm each is refused as for a
      template nobody holds
    - send a request with no session, and confirm it is refused

> **What does this buy?** A traveller's library is their own, so it reaches no one else
> (ADR-0024, a traveller's checklists are their own).

### PLN:LIBRARY-NFR2 — A traveller's library costs nothing to host

A traveller's library, used each day from three devices, stays within the free plan Itinero's
online side runs on. ^pln-library-nfr2

- **Verification:**
    - with ten travellers, each with a library of 50 templates and three devices catching up thirty
      times a day, and changing ten templates a day, confirm the day's requests, rows read and rows
      written stay within the free plan's daily limits

> **What does this buy?** Itinero is personal software, and costs nothing to run beyond its domain
> name (ADR-0015, Itinero's online side runs on Cloudflare's free plan, and travellers sign in with
> Google alone).

---

## Non-requirements

| Identifier | The library does not | Because |
|---|---|---|
| **PLN:LIBRARY-NR1** | Tell a device with the library open of a change at once | A library changes only as its one traveller changes it, and each device catches up when Itinero opens or comes to the front |
| **PLN:LIBRARY-NR2** | Share a template with another traveller | A traveller's library is their own (ADR-0024, a traveller's checklists are their own) |
| **PLN:LIBRARY-NR3** | Keep a deleted template for restoring | A delete is for good, once the traveller confirms (ADR-0024) |
| **PLN:LIBRARY-NR4** | Accept a change from a device with no connection, or merge changes made while apart | A traveller's library changes only while they are online, as a trip does (ADR-0004, a trip is read-only offline) |
| **PLN:LIBRARY-NR5** | Check what a template holds | `planner/checklists`, which holds checklists and templates, checks every change to one |
| **PLN:LIBRARY-NR6** | Copy a template into a trip | `planner/trip-host`, which holds each trip online, adds the copy to the trip |

^pln-library-nr
