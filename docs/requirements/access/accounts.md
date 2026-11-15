# The accounts component

What the component `access/accounts` promises to the components that use it, and through them to
travellers. The accounts component holds each traveller's account, signs a traveller in with a
Google account, and says which account made each request. The component registry,
`components.md`, gives it the prefix `ACC:ACCOUNTS`.

Two roles appear below. A caller is a component that uses the accounts component, such as the web
app, which travellers use on a computer or a phone. The traveller is the role
`requirements/README.md` defines.

Google signs a person in, and vouches for who they are, without Itinero seeing their password.
Google is the provider below, the one service travellers sign in through (ADR-0015, Itinero's online
side runs on Cloudflare's free plan, and travellers sign in with Google alone). A session is the
proof a device holds that its traveller has signed in, which the device sends with every request.

---

## Functional requirements

### ACC:ACCOUNTS-F1 — A traveller signs in with a Google account, and has the same account each time

The accounts component signs a traveller in once their provider vouches for them, and refuses a
sign-in no provider vouches for, saying why. A traveller signing in for the first time gets a new
account. A traveller signing in again with the same Google account gets the same
account. ^acc-accounts-f1

- **Verification:** against the accounts component, with two test accounts at Google,
    - sign in with the first, and confirm a new account is given
    - sign in again with it, and confirm the same account is given
    - sign in with the second, and confirm a second account is given
    - present proof of a sign-in that has expired, or that was made for another app, and confirm
      each is refused, with the reason

> **What does this buy?** A traveller signs in with an account they already have (`ACC-F1`).

> **Can a traveller sign in some other way?** No (`ACC:ACCOUNTS-NR2`).

### ACC:ACCOUNTS-F2 — An account holds the email address its provider vouches for

An account holds the email address its provider vouched for at the last sign-in, and says whether
the provider confirmed it belongs to the traveller. The accounts component gives a caller an
account's email address. ^acc-accounts-f2

- **Verification:** against the accounts component,
    - sign in with a Google account, and confirm the account gives that account's email address, as
      confirmed
    - change the Google account's email address, sign in again, and confirm the account gives the
      new address

> **What does this buy?** An invitation is accepted only by the account holding the address it was
> sent to (`ACC-F3`).

### ACC:ACCOUNTS-F3 — A device stays signed in until its traveller signs out, or leaves it unused for 180 days

Signing in gives the device a session. Each request the device sends with its session is made by
that account. A session lasts until the traveller signs out on that device, or until it goes 180
days without being used. ^acc-accounts-f3

- **Verification:** against the accounts component,
    - sign in, send a request with the session, and confirm it is made by the account
    - sign out, send a request with the same session, and confirm it is refused
    - send a request with a session last used 181 days before, and confirm it is refused
    - sign in on two devices, sign out on one, and confirm the other's session still works

> **What does this buy?** A traveller opens Itinero on the road without signing in each time
> (`ACC-F1`). A phone lost and left unused stops working on its own.

### ACC:ACCOUNTS-F4 — Every request names its account, or is refused

For each request a caller passes it, the accounts component gives the account that sent it, or
refuses it, saying why. A request with no session, or with a session that has ended, is
refused. ^acc-accounts-f4

- **Verification:** against the accounts component,
    - pass a request with a working session, and confirm it gives the account
    - pass a request with no session, and one with a made-up session, and confirm each is refused,
      with the reason

> **What does this buy?** Every check of what a traveller may do starts from knowing, for certain,
> who the traveller is (`ACC-NFR1`).

### ACC:ACCOUNTS-F5 — An account holds a name its traveller chooses, which a later sign-in never changes

A new account starts with the name its provider gives, marked as not yet chosen, and the accounts
component tells the caller so. A traveller sets their account's name to between 1 and 60
characters, and it is then chosen. A later sign-in never changes a chosen name. The accounts
component gives a caller an account's name. ^acc-accounts-f5

- **Verification:** against the accounts component, with a test account at Google named Sam Taylor,
    - sign in for the first time, and confirm the account's name is Sam Taylor, not yet chosen
    - set the name to Sam, and confirm it is chosen
    - change the Google account's name, sign in again, and confirm the name is still Sam
    - set an empty name, and a name of 61 characters, and confirm each is refused, with the reason

> **What does this buy?** Travellers on a trip see each other by the names they chose (`ACC-F13`).

> **What if the provider gives no name?** The account starts with the part of its email address
> before the `@`, not yet chosen.

---

## Non-functional requirements

### ACC:ACCOUNTS-NFR1 — Itinero holds no password, and nothing that lets a stolen copy sign anyone in

The accounts component holds no traveller's password. A copy of everything it stores lets no one
make a request as any traveller. ^acc-accounts-nfr1

- **Verification:**
    - read everything the accounts component stores, and confirm it holds no password
    - take a session from that stored copy, send a request with it, and confirm it is refused

> **What does this buy?** A leak of Itinero's stored data gives away no traveller's account
> elsewhere, and lets no one into Itinero.

---

## Non-requirements

| Identifier | The accounts component does not | Because |
|---|---|---|
| **ACC:ACCOUNTS-NR1** | Join two of a traveller's Google accounts into one Itinero account | Each Google account is its own Itinero account. Joining them is future work |
| **ACC:ACCOUNTS-NR2** | Sign a traveller in by any other means than a Google account | Travellers sign in with an account they already have, and Apple's sign-in costs $99 a year (`ACC-NR1`) |
| **ACC:ACCOUNTS-NR3** | Sign a traveller out on every device at once | Each device signs out for itself, for now |
| **ACC:ACCOUNTS-NR4** | Delete an account | Deleting an account is future work (`ACC-NR7`) |
| **ACC:ACCOUNTS-NR5** | Decide what a traveller may do | `access/permissions` decides, once the accounts component has named the traveller |

^acc-accounts-nr
