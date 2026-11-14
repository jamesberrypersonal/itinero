# The membership component

**Assumes** [membership.md](../../requirements/access/membership.md) — what the membership component promises, and the members, admins and invitations it holds.

## 1. Purpose

The membership component is the part of Itinero's online side that holds who is on each trip,
which members are admins, and the invitations not yet accepted. It sends each invitation by email,
accepts it for the account it was meant for, and removes a member when an admin asks.

## 2. Scope

The membership component covers a trip's members, its creator and admins, invitations from sending
to acceptance, and removing a member.

Three things act on it:

- **The web app**, the system travellers use on a computer or a phone, sends an admin's
  invitations, withdrawals and removals, and a traveller's acceptance (§3.2).
- **The component holding the copy of each trip online** asks who is on a trip and who is an admin,
  for every request. It also applies the grant changes the membership component hands it. That
  component is not yet registered.
- **`access/accounts`**, the component that holds accounts, names the account behind each request,
  and gives an account's email address.

Deliberately absent:

- what a member may see or change, which `access/permissions` decides from the grants
- a member leaving a trip, or an admin losing their role
- handing a trip to a new creator, or deleting a trip
- invitations by a link anyone may use

What Itinero's online side runs on, and so how the membership component stores its records and
sends its emails, is not decided until TODO-12 is done. This specification gives the behaviour any
such platform must keep.

## 3. Interface

### 3.1 User interface

None. The web app shows a trip's members and invitations, and the forms an admin uses. The
invitation email (§4.3) is the one thing the membership component shows a person directly.

### 3.2 Application interface

The membership component answers these requests over HTTPS, each with a JSON body, from a device
signed in through `access/accounts`. A refusal gives a status of 400, 403, 404 or 409, and a JSON
body `{ "code": ..., "message": ... }`.

| Request | Body | Gives |
|---|---|---|
| `GET /trips/{trip}/members` | None | The members, admins, creator and open invitations (§4.6) |
| `POST /trips/{trip}/invitations` | `{ "email": ..., "trip": "view" \| "edit", "calendar": "none" \| "view" \| "edit" }` | The invitation, without its token (§4.2) |
| `DELETE /trips/{trip}/invitations/{invitation}` | None | Nothing, and withdraws it (§4.2) |
| `POST /invitations/{invitation}/accept` | `{ "token": ... }` | The trip joined (§4.4) |
| `POST /trips/{trip}/admins` | `{ "account": ... }` | Nothing, and makes the member an admin (§4.1) |
| `DELETE /trips/{trip}/members/{account}` | None | Nothing, and removes the member (§4.5) |

| Refusal code | Status | When |
|---|---|---|
| `admin-only` | 403 | A request only an admin may make, from a member who is not one |
| `not-a-member` | 404 | A request about a trip the account is not a member of, or naming an account that is not a member |
| `creator` | 409 | Removing the trip's creator |
| `already-a-member` | 409 | An invitation to an address a member's account holds |
| `bad-email` | 400 | An address that is not one, as §4.2 gives |
| `bad-invitation` | 404 | An invitation that is unknown, withdrawn, replaced, accepted or expired, or a token that is not its own |
| `wrong-account` | 403 | Accepting with an account whose address is not the one invited, or is not confirmed |
| `malformed` | 400 | A body not in the forms above |

A trip the account is not a member of is refused with `not-a-member`, whatever the request, so a
refusal says nothing of whether the trip exists.

### 3.3 Programming interface

Inside the online side, the membership component gives these functions to the component holding
the copy of each trip online:

```ts
import type { AccountId } from "access/accounts";            // as spec/access/accounts.md §3.3
import type { GrantChange } from "@itinero/permissions";

type Member = { account: AccountId; admin: boolean; creator: boolean; joined: string };

function createTrip(trip: string, creator: AccountId): Promise<Member>;
function member(trip: string, account: AccountId): Promise<Member | undefined>;
function trips(account: AccountId): Promise<readonly string[]>;
function onChange(listener: (trip: string, change: GrantChange) => Promise<void>): void;
```

`member` gives the member an account is on a trip, or `undefined`. The caller passes
`{ traveller: account, admin }` from it to every function of `@itinero/permissions`. `onChange`
names the listener that applies to a trip's grants each `add` and `remove` the membership component
makes (§4.4, §4.5). `joined` is the moment the member joined, in the text form of an ISO 8601 UTC
time.

### 3.4 Systems this drives

The membership component sends each invitation as an email, through an email sending service. Which
service is not decided until TODO-12 is done. The email is sent from an address of Itinero's own,
and is plain text with one link.

## 4. Behaviour

Behaviour crossing every operation:

- **Every request names its account** through `access/accounts`'s `whoSent`, and is refused with
  its refusal otherwise.
- **An address is compared in lower case.** Every address is trimmed and lowered before it is kept
  or compared.
- **The server's clock is the only clock.** An invitation's expiry is checked against the online
  side's own clock.
- **Each operation on a trip runs alone.** Two operations on the same trip never interleave, so an
  invitation is never accepted twice, nor accepted as it is withdrawn.

### 4.1 Creating a trip, and admins

*Porcelain:* `createTrip(trip, creator)` makes the creator the trip's one member, with `admin` and
`creator` true (`ACC:MEMBERSHIP-F1`). The component holding the copy online calls it as it creates
the trip, and gives the creator edit access in the trip's grants.

`POST /trips/{trip}/admins` makes a member an admin, and is refused with `admin-only` from a member
who is not one. Making an admin of a member who already is one succeeds and does nothing. No request
takes the role away.

### 4.2 Inviting, and withdrawing

*Porcelain:* `POST /trips/{trip}/invitations` is refused with `admin-only` from a member who is not
an admin (`ACC:MEMBERSHIP-F2`). It is refused with `bad-email` where the address has no `@`, has
nothing before or after it, or is longer than 254 characters. It is refused with `already-a-member`
where a member's account holds the address. Otherwise it:

1. withdraws any open invitation to the same address on the same trip
2. makes an invitation with a new identifier and a token of 32 random bytes, written in base64url.
   It keeps only the token's SHA-256 digest (`ACC:MEMBERSHIP-NFR1`)
3. sets the invitation to expire 14 days, of 24 hours each, after it is made
4. sends the email of §4.3, holding the token

`DELETE /trips/{trip}/invitations/{invitation}` withdraws an open invitation, and is refused with
`admin-only` from a member who is not an admin. Withdrawing one already closed succeeds and does
nothing.

### 4.3 The invitation email

*Plumbing:* the email goes to the address invited. Its subject is "You are invited to a trip on
Itinero". It names the admin who sent it and the trip, says when the invitation expires, and holds
one link:

```
https://<Itinero's address>/invitations/<invitation>#<token>
```

The token sits after the `#`, which a browser never sends in a request, so it stays out of every
server's logs. The web app reads it from the address, and passes it in the body of the acceptance.

### 4.4 Accepting

*Porcelain:* `POST /invitations/{invitation}/accept` accepts only where every check passes
(`ACC:MEMBERSHIP-F3`):

1. the invitation is known and open, has not expired, and the digest of the token given is its own,
   or the acceptance is refused with `bad-invitation`
2. the account that sent it holds the invited address, with `emailVerified` true, or it is refused
   with `wrong-account`

The account then becomes a member, with `admin` and `creator` false, and the invitation is closed as
accepted. The listener of `onChange` is given `{ op: "add", traveller, trip, calendar }`, with the
access the invitation named, and the acceptance succeeds once it returns. An account already a
member when it accepts closes the invitation, and stays as it was.

### 4.5 Removing a member

*Porcelain:* `DELETE /trips/{trip}/members/{account}` is refused with `admin-only` from a member who
is not an admin, and with `creator` for the trip's creator (`ACC:MEMBERSHIP-F4`). Otherwise the
member is removed, and the listener of `onChange` is given `{ op: "remove", traveller }`. Every
request of theirs about the trip is then refused with `not-a-member`.

### 4.6 Who is on a trip

*Porcelain:* `GET /trips/{trip}/members` gives every member, with `admin`, `creator` and `joined`,
and each open invitation's identifier, address, access and expiry (`ACC:MEMBERSHIP-F5`). `trips`
gives the trips an account is a member of, in the order they were joined.

### 4.7 The test suite

The suite runs the checks in the verification of each requirement the membership component claims,
against an email stand-in that keeps each message sent. It also checks each refusal of §3.2. How
the suite runs depends on the platform, which is not decided until TODO-12 is done.

## 5. Resources

The membership component stores two kinds of record. What holds them is not decided
until TODO-12 is done.

| Record | Holds | Kept |
|---|---|---|
| Member | The trip, the account, `admin`, `creator`, and when they joined | Until the member is removed |
| Invitation | Its identifier, the trip, the address, the access to the trip and the calendar, who sent it, the token's SHA-256 digest, when it expires, and whether it is open, withdrawn, replaced or accepted | For 90 days after it closes, so that an admin can see what became of it |

A trip has exactly one member whose `creator` is true. The pair of the trip and the account is
unique among members.

| Resource | Owned by |
|---|---|
| The stored records | Whoever keeps the access system's roadmap |
| The address invitations are sent from | Whoever keeps the access system's roadmap |

## 6. Quality attributes

- **An invitation is useless to anyone else** (`ACC:MEMBERSHIP-NFR1`). Accepting needs the token,
  which only the email holds, and an account confirmed to hold the address. The stored records hold
  only the token's digest.
- **Says nothing of trips a traveller is not on** (`ACC-NFR1`). Every request about such a trip is
  refused the same way.
- **Every trip keeps its creator** (`ACC:MEMBERSHIP-F1`). No request removes the creator, or takes
  away an admin's role.
- **Grants follow membership.** The grants of a trip gain a traveller only as they accept, and lose
  them only as they are removed (§4.4, §4.5).

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [ACC:MEMBERSHIP-F1](../../requirements/access/membership.md#^acc-membership-f1) | `createTrip`, and making an admin, in §4.1. |
| [ACC:MEMBERSHIP-F2](../../requirements/access/membership.md#^acc-membership-f2) | Inviting and withdrawing, in §4.2, and the email of §4.3. |
| [ACC:MEMBERSHIP-F3](../../requirements/access/membership.md#^acc-membership-f3) | Accepting, with its checks, in §4.4. |
| [ACC:MEMBERSHIP-F4](../../requirements/access/membership.md#^acc-membership-f4) | Removing a member, in §4.5. |
| [ACC:MEMBERSHIP-F5](../../requirements/access/membership.md#^acc-membership-f5) | `member` and `trips` in §3.3, and the members of §4.6. |
| [ACC:MEMBERSHIP-NFR1](../../requirements/access/membership.md#^acc-membership-nfr1) | The random token, kept only as a digest, and the address check, in §4.2 and §4.4. |
| [ACC-F2](../../requirements/access/access.md#^acc-f2) | The creator as the permanent admin, and making admins (§4.1). Giving an admin edit access to every page is `access/permissions`. |
| [ACC-F3](../../requirements/access/access.md#^acc-f3) | Invitations by address, their expiry and withdrawal, and accepting only with the address invited (§4.2 to §4.4). Showing the trip once accepted is the web app, whose specification is not yet written. |
| [ACC-F11](../../requirements/access/access.md#^acc-f11) | Removing a member (§4.5). Deleting the trip from each of their phones is the component holding the copy of each trip online, which is not yet registered, and the web app. |

## 8. Open

- **What the membership component runs on.** Its records, its service and its email sending depend
  on the platform chosen for Itinero's online side. It is not decided until TODO-12 is done.
- **Who sees a trip's members.** `GET /trips/{trip}/members` gives every member to any member. No
  requirement says whether a traveller should see who else is on a trip. It is not decided.
