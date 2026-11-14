# The accounts component

What the component `access/accounts` promises to the components that use it, and through them to
travellers. The accounts component holds each traveller's account, signs a traveller in with a
Google or an Apple account, and says which account made each request. The component registry,
`components.md`, gives it the prefix `ACC:ACCOUNTS`.

Two roles appear below. A caller is a component that uses the accounts component, such as the web
app, which travellers use on a computer or a phone. The traveller is the role
`requirements/README.md` defines.

Google and Apple each sign a person in, and vouch for who they are, without Itinero seeing their
password. Each is a provider below. A session is the proof a device holds that its traveller has
signed in, which the device sends with every request.

---

## Functional requirements

### ACC:ACCOUNTS-F1 — A traveller signs in with a Google or an Apple account, and has the same account each time

The accounts component signs a traveller in once their provider vouches for them, and refuses a
sign-in no provider vouches for, saying why. A traveller signing in for the first time gets a new
account. A traveller signing in again with the same Google or Apple account gets the same
account. ^acc-accounts-f1

- **Verification:** against the accounts component, with test accounts at Google and at Apple,
    - sign in with the Google account, and confirm a new account is given
    - sign in again with it, and confirm the same account is given
    - sign in with the Apple account, and confirm a second account is given
    - present proof of a sign-in that has expired, or that was made for another app, and confirm
      each is refused, with the reason

> **What does this buy?** A traveller signs in with an account they already have (`ACC-F1`).

> **Are a traveller's Google and Apple accounts joined into one?** No (`ACC:ACCOUNTS-NR1`).

### ACC:ACCOUNTS-F2 — An account holds the email address its provider vouches for

An account holds the email address its provider vouched for at the last sign-in, and says whether
the provider confirmed it belongs to the traveller. The accounts component gives a caller an
account's email address. ^acc-accounts-f2

- **Verification:** against the accounts component,
    - sign in with a Google account, and confirm the account gives that account's email address, as
      confirmed
    - change the Google account's email address, sign in again, and confirm the account gives the
      new address
    - sign in with an Apple account that hides its address, and confirm the account gives the relay
      address Apple passes on

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
| **ACC:ACCOUNTS-NR1** | Join a traveller's Google and Apple accounts into one Itinero account | A traveller signs in with one of them. Joining them is future work |
| **ACC:ACCOUNTS-NR2** | Sign a traveller in by any other means than Google or Apple | Travellers chose to sign in with an account they already have (`ACC-NR1`) |
| **ACC:ACCOUNTS-NR3** | Sign a traveller out on every device at once | Each device signs out for itself, for now |
| **ACC:ACCOUNTS-NR4** | Delete an account | Deleting an account is future work (`ACC-NR7`) |
| **ACC:ACCOUNTS-NR5** | Decide what a traveller may do | `access/permissions` decides, once the accounts component has named the traveller |

^acc-accounts-nr
