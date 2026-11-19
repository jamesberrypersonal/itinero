# The trip store

What the component `web/trip-store` promises to `web/screens`, the component that shows a trip, and
through it to travellers. The trip store keeps each trip's copy on a device: it brings the copy up
to date, is told of each change while a trip is open, sends each change a traveller makes, and
deletes every copy when its traveller signs out. It also carries every other request a traveller
makes about a trip, such as creating one or inviting a traveller. The component registry,
`components.md`, gives it the prefix `WEB:STORE`.

A trip's copy holds what its traveller may see of the trip: its name and dates, their own dates,
their pages, the titles of the deleted pages they could see, the calendar where an admin has
granted it, their bookings, and the trip's members. An admin's copy also holds every traveller's
access, and the invitations not yet accepted. `planner/trip-host`, the component that holds
each trip online, gives the copy, and decides what it may hold. A device is a phone or a computer a
traveller signs in on.

---

## Functional requirements

### WEB:STORE-F1 — A device holds a copy of every trip its traveller is on, read with no connection, with when it was last brought up to date

The trip store holds a copy of every trip its traveller is on, and gives it with no connection, as
it stood when last brought up to date. It gives, with each copy, when that was, and whether the
device is online now. ^web-store-f1

- **Verification:** with a traveller on two trips, signed in on a device,
    - bring the device up to date, take it offline, and confirm both trips are given, whole
    - confirm each gives the time it was last brought up to date, and that the device is offline
    - close and reopen Itinero offline, and confirm both trips are still given

> **What does this buy?** A traveller reads every trip they are on, anywhere, and knows how far to
> trust it (`WEB-F2`).

### WEB:STORE-F2 — Each time the device connects, every trip is brought up to date, and drops what its traveller may no longer see

Each time the device connects, the trip store brings every trip it holds up to date. It takes what
changed, drops each page and booking its traveller may no longer see, and gains each one they now
may. It drops the calendar where its access was taken away. It deletes a trip its traveller is no
longer on, and adds a trip they have joined. A copy is brought up to date whole, or left as it
was. ^web-store-f2

- **Verification:** with a traveller's device offline,
    - rename a page, take a booking away from the traveller, and take away their access to the
      calendar, then connect the device, and confirm the copy holds the new title, and neither the
      booking nor the calendar
    - remove the traveller from the second trip, connect the device, and confirm the trip is deleted
    - cut the connection halfway through bringing a trip up to date, and confirm the copy is as it
      was before

> **What does this buy?** A phone carries each trip as it stands, and nothing its traveller may no
> longer see (`WEB-F4`, `ACC-F11`, `ACC-F12`).

### WEB:STORE-F3 — While a trip is open and the device online, each change to it is taken within seconds

While a trip is open and the device online, the trip store is told of each change to the trip, and
takes it within five seconds. A connection that drops is opened again on its own. ^web-store-f3

- **Verification:** with the trip open on two devices,
    - change a page on the first, and confirm the second's copy holds the change within five seconds
    - break the second's connection for a minute, change a booking on the first, restore the
      connection, and confirm the second holds the change within five seconds of being reconnected

> **What does this buy?** Travellers planning together see each other's changes as they happen
> (`WEB-F4`, `PLN-F6`).

### WEB:STORE-F4 — A change is sent only while the device is online, and is in the copy once it is accepted

The trip store sends a traveller's change to the copy held online only while the device is online.
With no connection, it refuses the change without sending it, saying the device is offline. A
change refused online is returned with its refusal unchanged. A change accepted is in the device's
copy before the trip store says so. ^web-store-f4

- **Verification:**
    - with the device offline, send a change, and confirm it is refused as offline, and nothing is
      sent
    - online, send a change the traveller may not make, and confirm the refusal is returned
      unchanged
    - send a change that is accepted, and confirm the copy holds it as soon as it is reported
      accepted

> **What does this buy?** A trip changes only with a connection (ADR-0004, a trip can be read
> without a connection, but changed only with one), and a traveller never sees their own change go
> missing after it was accepted.

### WEB:STORE-F5 — Signing out deletes every trip from the device first, and a session that has ended does the same

When a traveller signs out, the trip store deletes every trip it holds before it ends the session,
whether or not the device is online. Where the device is offline, it ends the session the next time
it connects. When a request is refused because the device's session has ended, the trip store
deletes every trip it holds. ^web-store-f5

- **Verification:**
    - sign out online, and confirm nothing of any trip is left in the browser's storage for
      Itinero's site, and the session is ended
    - sign out offline, confirm nothing is left, then connect, and confirm the session is ended
    - end the device's session online, from the accounts component, connect, and confirm every trip
      is deleted

> **What does this buy?** A shared computer, or a phone left unused, keeps no trip once its
> traveller has gone (`WEB-F5`, ADR-0017, a trip's copy on a device is protected by the device's own
> lock, and deleted when its traveller signs out).

### WEB:STORE-F6 — Every window of Itinero on a device shares one copy, and each is told when it changes

Every window of Itinero open on one device reads the same copy of each trip. When the copy changes,
in any window, every window is told. ^web-store-f6

- **Verification:** with two windows of Itinero open on one computer,
    - in the first, change a page, and confirm the second shows the change within a second
    - sign out in the first, and confirm the second shows no trip

> **What does this buy?** A traveller with a trip open in two tabs never reads an old copy in one of
> them, and signing out in one signs out in both.

### WEB:STORE-F7 — The trip store carries every other request about a trip, and the copy shows what each did

The trip store carries each request a traveller makes about a trip that is not a change to it:
creating a trip, accepting an invitation, an admin's requests about members and invitations, and an
admin's reading of a deleted page. It sends each only while the device is online, and returns a
refusal unchanged. The trip store reports a request answered only once the device's copy holds what
the request did. An admin's copy holds every traveller's access and the invitations not yet
accepted. ^web-store-f7

- **Verification:** with an admin signed in on a device,
    - create a trip, and confirm the trip store gives it among the device's trips at once
    - invite an address, and confirm the copy holds the invitation, then withdraw it, and confirm
      the copy holds none
    - make a member an admin, and confirm the copy marks them one
    - remove a member, and confirm the copy marks them removed, and holds no access of theirs
    - read a deleted page, and confirm it is given, and is not in the device's storage afterwards
    - as a traveller who is not an admin, confirm the copy holds no other traveller's access and no
      invitation
    - with the device offline, make each request, and confirm each is refused as offline, and
      nothing is sent

> **What does this buy?** Every screen makes its requests in one way, and a traveller sees what
> they just did without reloading, such as a new trip or a new invitation.

> **Why does only an admin's copy hold other travellers' access?** An admin sets each traveller's
> access, and has to see it first. No other traveller learns it (`PLN:HOST-NFR1`).

---

## Non-functional requirements

### WEB:STORE-NFR1 — A large trip is read from the device quickly

The trip store gives a trip holding 500 pages and 300 bookings from the device's storage within one
second, on a phone. ^web-store-nfr1

- **Verification:** on such a phone, with no connection,
    - open the trip ten times, and confirm it is given within one second each time

> **What does this buy?** A trip opens within two seconds, with time to spare for showing it
> (`WEB-NFR1`).

---

## Non-requirements

| Identifier | The trip store does not | Because |
|---|---|---|
| **WEB:STORE-NR1** | Keep a change made with no connection, to send later | A trip changes only with a connection (`WEB-NR2`) |
| **WEB:STORE-NR2** | Encrypt a copy, or lock it | The device's own lock protects it (`WEB-NR3`) |
| **WEB:STORE-NR3** | Hold a deleted page's text | Only an admin reads a page in the graveyard, and only online (`ACC-F10`) |
| **WEB:STORE-NR4** | Decide what a copy may hold | `planner/trip-host` gives each device only what its traveller may see |

^web-store-nr
