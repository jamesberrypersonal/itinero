# The membership component

What the component `access/membership` promises to the components that use it, and through them to
travellers. The membership component holds who is on each trip and which of them are its admins. It
also holds the invitations that bring a traveller onto a trip, and removes a traveller from one.
The component registry, `components.md`, gives it the prefix `ACC:MEMBERSHIP`.

Three roles appear below. A caller is a component that uses the membership component, such as the
web app, which travellers use on a computer or a phone. The traveller and the admin are the roles
`requirements/README.md` defines. A member of a trip is a traveller on it.

An account is a traveller's Itinero account, which `access/accounts` holds. It holds the email
address that Google, which every traveller signs in with, vouched for.

---

## Functional requirements

### ACC:MEMBERSHIP-F1 — The traveller who creates a trip is its member and its admin for good

When a traveller creates a trip, the membership component makes them its first member, its admin,
and its creator. Nothing removes the creator from the trip, or takes away their admin role. An
admin can make any other member an admin, and the membership component tells its caller of each
one made. Nothing takes the role away from a member who stays on the trip. ^acc-membership-f1

- **Verification:** against the membership component,
    - create a trip, and confirm its creator is its only member, an admin and the creator
    - as the creator, make a second member an admin, and confirm it is accepted, and that the
      caller is told
    - as the second admin, remove the creator, and take away the creator's role, and confirm each
      is refused, with the reason
    - as a member who is not an admin, make a third member an admin, and confirm it is refused

> **What does this buy?** Every trip always has someone who may manage it (`ACC-F2`).

### ACC:MEMBERSHIP-F2 — An admin invites a traveller by email address, with their access to the trip and the calendar

An admin invites a traveller to a trip by an email address, with view or edit access to the trip,
and none, view or edit access to the calendar. The membership component sends the invitation to
that address. An invitation not accepted within 14 days of being sent expires. An admin can
withdraw an invitation before it is accepted. A second invitation to the same address, on the same
trip, replaces the first. ^acc-membership-f2

- **Verification:** against the membership component, with an admin on a trip,
    - invite an address with view access to the trip and none to the calendar, and confirm an
      email reaches the address
    - invite the same address again with edit access, and confirm the first invitation can no
      longer be accepted
    - withdraw the second, and confirm it can no longer be accepted
    - invite an address that is already a member's, and confirm it is refused, with the reason
    - as a member who is not an admin, invite an address, and confirm it is refused

> **What does this buy?** An admin brings in exactly the people they mean to, with the access they
> mean them to have (`ACC-F3`, `ACC-F5`).

### ACC:MEMBERSHIP-F3 — Only an account holding the invited address accepts an invitation

A traveller accepts an invitation once signed in with an account whose email address is the one
invited, confirmed by its provider. Accepting makes them a member, with the access the invitation
gave. The membership component refuses an invitation that has expired, been withdrawn, been
replaced or been accepted, and says why. ^acc-membership-f3

- **Verification:** against the membership component, with an invitation to an address,
    - accept it with an account holding the address, and confirm the account is a member with the
      access invited
    - accept a second invitation with an account holding another address, and confirm it is
      refused, with the reason
    - accept the first invitation a second time, and confirm it is refused
    - accept an invitation sent 15 days before, and confirm it is refused

> **What does this buy?** An invitation forwarded to someone else lets nobody in (`ACC-F3`).

> **What if the invited address differs only in capitals?** It matches. Email addresses are
> compared with capitals ignored.

### ACC:MEMBERSHIP-F4 — An admin removes a member, other than the creator

An admin removes any member of a trip other than its creator. The membership component then no
longer counts them a member, and tells its caller, so that every grant they held is removed with
them. ^acc-membership-f4

- **Verification:** against the membership component, with three members on a trip,
    - as an admin, remove a member, and confirm they are no longer a member, and that the caller is
      told
    - remove the creator, and confirm it is refused, with the reason
    - as a member who is not an admin, remove another member, and confirm it is refused

> **What does this buy?** An admin takes a trip back from someone who should no longer have it
> (`ACC-F11`).

> **Can a removed traveller be invited back?** Yes, as anyone else is.

### ACC:MEMBERSHIP-F5 — The membership component says who is on a trip, and which of them are admins

The membership component gives any member of a trip its members, each with the name their account
holds, which of them are admins, and which is its creator. It also gives each former member's
name, marked as removed. It gives only an admin the invitations not yet accepted. For an account,
it gives the trips it is a member of. ^acc-membership-f5

- **Verification:** against the membership component, with the trip of `ACC:MEMBERSHIP-F4` after
  the removal,
    - as a member who is not an admin, confirm it gives the two members left, each marked admin or
      not, and the creator
    - invite an address, and confirm an admin is given the invitation, with its expiry, and the
      other member is not
    - confirm each member's account gives the trip among its trips
    - confirm the member removed is given by name, marked as removed, and that their account does
      not give the trip among its trips

> **What does this buy?** Every check of what a traveller may do starts from whether they are on
> the trip, and whether they are an admin (`ACC-F2`).

> **Why give the names of former members?** A booking keeps naming a traveller after they leave
> the trip, and the travellers still on it should see who that was.

---

## Non-functional requirements

### ACC:MEMBERSHIP-NFR1 — An invitation cannot be guessed, and is useless to anyone else

No one accepts an invitation without the message sent to the invited address, and without an
account holding that address. ^acc-membership-nfr1

- **Verification:**
    - try to accept an invitation with a made-up link, and confirm it is refused
    - take an invitation's link from the stored records, accept it with an account holding the
      invited address, and confirm it is refused

> **What does this buy?** Only the person an admin invites joins the trip, even if the link or
> Itinero's stored data is seen by someone else.

---

## Non-requirements

| Identifier | The membership component does not | Because |
|---|---|---|
| **ACC:MEMBERSHIP-NR1** | Let a member leave a trip by themselves | Only an admin removes a member, for now (`ACC-NR2`) |
| **ACC:MEMBERSHIP-NR2** | Take away an admin's role | Admins are kept as they are made, for now (`ACC-NR3`) |
| **ACC:MEMBERSHIP-NR3** | Hand the creator's role to another member, or delete a trip | Both are future work (`ACC-NR4`) |
| **ACC:MEMBERSHIP-NR4** | Invite by a link anyone may use | A forwarded link would let in someone the admin never chose (`ACC-NR6`) |
| **ACC:MEMBERSHIP-NR5** | Decide what a member may see or change | `access/permissions` decides, from the access each invitation gave |

^acc-membership-nr
