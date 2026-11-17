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
- **`planner/trip-host`**, the component holding the copy of each trip online, asks who is on a
  trip and who is an admin, for every request. It also applies the grant changes the membership
  component hands it.
- **`access/accounts`**, the component that holds accounts, names the account behind each request,
  and gives an account's email address.

Deliberately absent:

- what a member may see or change, which `access/permissions` decides from the grants
- a member leaving a trip, or an admin losing their role
- handing a trip to a new creator, or deleting a trip
- invitations by a link anyone may use

Itinero's online side runs on Cloudflare's free plan (ADR-0015, Itinero's online side runs on
Cloudflare's free plan, and travellers sign in with Google alone). The membership component is part
of the same Cloudflare Worker as `access/accounts`, and holds its records in the same D1 database,
Cloudflare's hosted SQLite database. It sends its emails through Resend.

## 3. Interface

### 3.1 User interface

None. The web app shows a trip's members and invitations, and the forms an admin uses. The
invitation email (§4.3) is the one thing the membership component shows a person directly.

### 3.2 Application interface

The membership component answers these requests over HTTPS, each with a JSON body, from a device
signed in through `access/accounts`. Each has a path beginning `/api/`, as every request of the
online side has. A refusal gives a status of 400, 403, 404, 409 or 502, and a JSON
body `{ "code": ..., "message": ... }`.

| Request | Body | Gives |
|---|---|---|
| `GET /api/trips/{trip}/members` | None | The members, admins and creator, and to an admin the open invitations (§4.6) |
| `POST /api/trips/{trip}/invitations` | `{ "email": ..., "trip": "view" \| "edit", "calendar": "none" \| "view" \| "edit" }` | The invitation, without its token (§4.2) |
| `DELETE /api/trips/{trip}/invitations/{invitation}` | None | Nothing, and withdraws it (§4.2) |
| `POST /api/invitations/{invitation}/accept` | `{ "token": ... }` | The trip joined (§4.4) |
| `POST /api/trips/{trip}/admins` | `{ "account": ... }` | Nothing, and makes the member an admin (§4.1) |
| `DELETE /api/trips/{trip}/members/{account}` | None | Nothing, and removes the member (§4.5) |

| Refusal code | Status | When |
|---|---|---|
| `admin-only` | 403 | A request only an admin may make, from a member who is not one |
| `not-a-member` | 404 | A request about a trip the account is not a member of, or naming an account that is not a member |
| `creator` | 409 | Removing the trip's creator |
| `already-a-member` | 409 | An invitation to an address a member's account holds |
| `bad-email` | 400 | An address that is not one, as §4.2 gives |
| `bad-invitation` | 404 | An invitation that is unknown, withdrawn, replaced, accepted or expired, or a token that is not its own |
| `wrong-account` | 403 | Accepting with an account whose address is not the one invited, or is not confirmed |
| `not-sent` | 502 | An invitation Resend refused to send (§3.4) |
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
type Listed = Member & { name: string;     // as GET /api/trips/{trip}/members gives each member
                         removed?: string }; // present: a former member, removed then

function createTrip(trip: string, creator: AccountId): Promise<Member>;
function member(trip: string, account: AccountId): Promise<Member | undefined>;
function trips(account: AccountId): Promise<readonly string[]>;
type Change = GrantChange | { op: "admin"; traveller: AccountId };
function onChange(listener: (trip: string, change: Change) => Promise<void>): void;
function onTitle(title: (trip: string) => Promise<string | undefined>): void;
```

`member` gives the member an account is on a trip, and `undefined` for an account that is not on it,
a former member included. The caller passes `{ traveller: account, admin }` from it to every
function of `@itinero/permissions`. `onChange` names the listener that applies to a trip's grants
each `add` and `remove` the membership component makes (§4.4, §4.5). The listener is also given
`{ op: "admin", traveller }` for each member made an admin. `planner/trip-host` then tells every
device that has the trip open (§4.1). `joined` is the moment the member joined, in the text form of
an ISO 8601 UTC time. `onTitle` names the function that gives a trip's title, for the invitation
email (§4.3). `planner/trip-host` gives it too, since it holds each trip.

### 3.4 Systems this drives

The membership component sends each invitation as an email through Resend, an email sending
service, within its free plan of 3,000 emails a month and 100 a day. It sends each one with a
`POST` to `https://api.resend.com/emails`, with the Worker's secret `RESEND_API_KEY` as its bearer
token. The email is plain text with one link.

Resend sends to any address only from a domain whose ownership it has checked, through records
added to the domain's DNS. Invitations are therefore sent from an address at Itinero's own domain,
such as `invitations@` that domain. An invitation Resend refuses to send, such as one past the
day's 100, closes the request with the refusal `not-sent`. Nothing is written for it, so an earlier
invitation to the same address stays open (§4.2).

## 4. Behaviour

Behaviour crossing every operation:

- **Every request names its account** through `access/accounts`'s `whoSent`, and is refused with
  its refusal otherwise.
- **An address is compared in lower case.** Every address is trimmed and lowered before it is kept
  or compared.
- **The server's clock is the only clock.** An invitation's expiry is checked against the online
  side's own clock.
- **Each operation on a trip runs alone.** Each operation is one D1 batch, which D1 runs as one
  transaction. An invitation is closed by an update that names its state as open, and the operation
  stops where the update changes no row. So an invitation is never accepted twice, nor accepted as
  it is withdrawn.
- **A trip's grants change first, and its members last.** An acceptance and a removal each change
  two stores: the members in D1, and the grants in the trip's Durable Object, the program that
  holds the trip online. No transaction covers both. The membership component therefore hands the
  grant change to the listener of `onChange` first, and writes its own records only once the
  listener returns. The listener's change is safe to repeat, as `spec/planner/trip-host.md` §4.3
  gives. An operation that stops between the two is finished by making the same request again.

### 4.1 Creating a trip, and admins

*Porcelain:* `createTrip(trip, creator)` makes the creator the trip's one member, with `admin` and
`creator` true (`ACC:MEMBERSHIP-F1`). The component holding the copy online calls it as it creates
the trip, and gives the creator edit access in the trip's grants.

`POST /api/trips/{trip}/admins` makes a member an admin, and is refused with `admin-only` from a
member who is not one. Making an admin of a member who already is one succeeds, and changes no
record. No request takes the role away.

Whether or not the member was an admin already, the listener of `onChange` is then given
`{ op: "admin", traveller }`. No grant changes, because an admin's access comes from the role.
`planner/trip-host` raises the trip's sequence, the count of its changes, for it, so that every open
device catches up. The new admin's device then holds everything an admin sees, and every other
device marks them an admin. A request whose listener fails is refused, and making it again tells the
devices.

### 4.2 Inviting, and withdrawing

*Porcelain:* `POST /api/trips/{trip}/invitations` is refused with `admin-only` from a member who is
not an admin (`ACC:MEMBERSHIP-F2`). It is refused with `bad-email` where the address has no `@`, has
nothing before or after it, or is longer than 254 characters. It is refused with `already-a-member`
where a member's account holds the address. Otherwise it:

1. makes an invitation with a new identifier and a token of 32 random bytes, written in base64url.
   It keeps only the token's SHA-256 digest (`ACC:MEMBERSHIP-NFR1`)
2. sets the invitation to expire 14 days, of 24 hours each, after it is made
3. sends the email of §4.3, holding the token
4. once Resend has accepted the email, in one batch, closes any open invitation to the same address
   on the same trip as replaced, and stores the new invitation

An invitation whose batch fails after its email was sent is never stored. Its link is then refused
with `bad-invitation`, and an admin invites the address again.

`DELETE /api/trips/{trip}/invitations/{invitation}` withdraws an open invitation, and is refused
with `admin-only` from a member who is not an admin. Withdrawing one already closed succeeds and
does nothing.

### 4.3 The invitation email

*Plumbing:* the email goes to the address invited. Its subject is "You are invited to a trip on
Itinero". It names the admin who sent it, by their account's name, and the trip, by the title
`onTitle` gives, or as "a trip" where it gives none. It says when the invitation expires, in UTC,
and holds one link:

```
https://<Itinero's address>/invitations/<invitation>#<token>
```

Itinero's address is the one the invitation's request was sent to. The link's address is a screen
of the web app, outside `/api/`. The token sits after the `#`, which
a browser never sends in a request, so it stays out of every server's logs. The web app reads it
from the address, and passes it in the body of the acceptance.

### 4.4 Accepting

*Porcelain:* `POST /api/invitations/{invitation}/accept` accepts only where every check passes
(`ACC:MEMBERSHIP-F3`):

1. the invitation is known and open, has not expired, and the digest of the token given is its own,
   or the acceptance is refused with `bad-invitation`
2. the account that sent it holds the invited address, with `emailVerified` true, or it is refused
   with `wrong-account`

An account already a member when it accepts closes the invitation, and stays as it was. Otherwise
the acceptance takes two steps, in this order:

1. the listener of `onChange` is given `{ op: "add", traveller, trip, calendar }`, with the access
   the invitation named
2. once the listener returns, one batch makes the account a member, with `admin` and `creator`
   false, and closes the invitation as accepted

The acceptance succeeds once the batch is written. An acceptance that stops after the first step
leaves the invitation open and the account not a member, so the traveller accepts again, and the
same `add` is given again.

Where the batch finds the invitation no longer open, such as one withdrawn in the same moment, the
listener is given `{ op: "remove", traveller }`, and the acceptance is refused with
`bad-invitation`.

### 4.5 Removing a member

*Porcelain:* `DELETE /api/trips/{trip}/members/{account}` is refused with `admin-only` from a member
who is not an admin, and with `creator` for the trip's creator (`ACC:MEMBERSHIP-F4`). Otherwise the
listener of `onChange` is given `{ op: "remove", traveller }`, which takes away every grant the
member holds. Once the listener returns, the member is removed: their record is kept, with `removed`
set to the moment of the removal, and `admin` set false. Every request of theirs about the trip is
then refused with `not-a-member`, as for any account not on it.

A former member is kept so that what still names them, such as a booking, still shows who they
were. An invitation is not refused for a former member's address, and accepting it makes them a
member again: `removed` is cleared, and `joined` is set to the acceptance.

A removal that stops after the listener returns leaves a member with no grant. `planner/trip-host`
refuses every request of such a member with `not-a-member`, because its grants no longer hold them,
so they have lost the trip already. They
are still listed as a member, and an admin removes them again to finish.

### 4.6 Who is on a trip

*Porcelain:* `GET /api/trips/{trip}/members` gives any member every member of the trip, with
`admin`, `creator` and `joined`, and the `name` `access/accounts`' `account` gives for it
(`ACC:MEMBERSHIP-F5`, `ACC-F13`). It also gives each former member, with `removed`, so that their
name can be shown where something names them. To an admin, it also gives each open invitation's
identifier, address, access and expiry. A member who is not an admin is given no invitations, so
that the addresses invited stay with the admins. `trips` gives the trips an account is a member of,
in the order they were joined, and no trip it has been removed from.

### 4.7 The test suite

The suite runs the checks in the verification of each requirement the membership component claims,
against an email stand-in that keeps each message sent, and a listener stand-in in place of
`planner/trip-host`. It also checks each refusal of §3.2. It runs
with the accounts component's suite, with `npm test` in `services/online/`, inside Wrangler.

`RESEND_URL`, a variable of the Worker unset in every deploy, points it at a stand-in for Resend
that keeps each email, for the web app's browser tests (`spec/web/screens.md` §4.9).

## 5. Resources

The membership component stores two kinds of record, each a table of the online side's D1
database.

| Record | Holds | Kept |
|---|---|---|
| Member | The trip, the account, `admin`, `creator`, when they joined, and when they were removed, for a former member | For as long as the trip is kept, so that a former member's name still shows |
| Invitation | Its identifier, the trip, the address, the access to the trip and the calendar, who sent it, the token's SHA-256 digest, when it expires, and whether it is open, withdrawn, replaced, expired or accepted | For 90 days after it closes, so that an admin can see what became of it |

A trip has exactly one member whose `creator` is true. The pair of the trip and the account is
unique among members.

A scheduled task of the Worker, which Cloudflare runs once a day, deletes every invitation 90 days
after it closed, and closes every open invitation past its expiry as expired.

| Resource | Path | Owned by |
|---|---|---|
| The tables `members` and `invitations` | The online side's D1 database | Whoever keeps the access system's roadmap |
| The Resend key | `RESEND_API_KEY`, a secret of the Worker, set with Wrangler and never in the repository | Whoever keeps the access system's roadmap |
| The address invitations are sent from | `INVITATIONS_FROM`, a variable in the Worker's Wrangler configuration | Whoever keeps the access system's roadmap |
| The domain invitations are sent from, and its DNS records for Resend | Itinero's own domain | Whoever keeps the access system's roadmap |

## 6. Quality attributes

- **An invitation is useless to anyone else** (`ACC:MEMBERSHIP-NFR1`). Accepting needs the token,
  which only the email holds, and an account confirmed to hold the address. The stored records hold
  only the token's digest.
- **Says nothing of trips a traveller is not on** (`ACC-NFR1`). Every request about such a trip is
  refused the same way.
- **Every trip keeps its creator** (`ACC:MEMBERSHIP-F1`). No request removes the creator, or takes
  away the role of an admin who stays on the trip. A removed admin returns, if invited back, as a
  member who is not one.
- **Grants and members agree, or nobody gets in.** The grants of a trip gain a traveller only as
  they create the trip or accept an invitation. They lose a traveller only as the traveller is
  removed, or as an acceptance that came too late is undone (§4.4, §4.5). An operation that stops
  part way leaves a grant with no member, or a member with no grant. Neither opens the trip to
  anyone, and the same request made again finishes it (§4).

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [ACC:MEMBERSHIP-F1](../../requirements/access/membership.md#^acc-membership-f1) | `createTrip`, and making an admin, in §4.1. |
| [ACC:MEMBERSHIP-F2](../../requirements/access/membership.md#^acc-membership-f2) | Inviting and withdrawing, in §4.2, and the email of §4.3. |
| [ACC:MEMBERSHIP-F3](../../requirements/access/membership.md#^acc-membership-f3) | Accepting, with its checks, in §4.4. |
| [ACC:MEMBERSHIP-F4](../../requirements/access/membership.md#^acc-membership-f4) | Removing a member, in §4.5. |
| [ACC:MEMBERSHIP-F5](../../requirements/access/membership.md#^acc-membership-f5) | `member` and `trips` in §3.3, and the members of §4.6. |
| [ACC:MEMBERSHIP-NFR1](../../requirements/access/membership.md#^acc-membership-nfr1) | The random token, kept only as a digest, and the address check, in §4.2 and §4.4. |
| [ACC-F13](../../requirements/access/access.md#^acc-f13) | Each member's name, in the list of §4.6. |
| [ACC-F2](../../requirements/access/access.md#^acc-f2) | The creator as the permanent admin, and making admins (§4.1). Giving an admin edit access to every page is `access/permissions`. |
| [ACC-F3](../../requirements/access/access.md#^acc-f3) | Invitations by address, their expiry and withdrawal, and accepting only with the address invited (§4.2 to §4.4). Showing the trip once accepted is `web/screens`. |
| [ACC-F11](../../requirements/access/access.md#^acc-f11) | Removing a member (§4.5). Deleting the trip from each of their phones is `planner/trip-host` and `web/trip-store`. |

## 8. Open

- **A grant left without a member.** An acceptance that stops part way, and is never made again,
  leaves a grant for an account that is not a member. It opens the trip to nobody. It is still
  counted when `access/permissions` counts the travellers who would come to see a page moved
  elsewhere in the trip. Clearing
  such grants is not designed.
