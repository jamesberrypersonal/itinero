# ADR-0017 — A trip's copy on a device is protected by the device's own lock, and deleted when its traveller signs out

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** web

## Problem

Itinero's web app runs in the browser of a traveller's phone or computer. Each device keeps a copy
of every trip its traveller is on, so that the trip can be read with no connection (ADR-0004, a
trip can be read without a connection, but changed only with one). The copy holds what the
traveller may see of the trip: its pages of research, its calendar where an admin has granted it,
and their bookings. A booking holds its booking reference, seat numbers and notes. A booking
reference with a traveller's surname is often enough to change or cancel the booking on the
company's own website.

A lost or borrowed device therefore exposes whatever its copy holds. ADR-0004 requires a decision
on how the copy is protected before a trip holds personal details. Bookings already put such
details on the device.

A traveller signs in to Itinero with a Google account, and a device stays signed in until its
traveller signs out there, or until it goes 180 days unused (`ACC:ACCOUNTS-F3`). A traveller cannot
sign a device out from another device (`ACC:ACCOUNTS-NR3`).

## Decision

**A device's copy is protected by the device's own lock, and by nothing of Itinero's.** The web app
keeps the copy in the browser's storage for Itinero's site, which no other site can read. iOS and
Android encrypt that storage while the phone is locked. Itinero adds no lock, PIN or encryption of
its own.

**Every device a traveller signs in on keeps a copy.** A phone and a computer are treated alike, and
nothing asks whether the device is the traveller's own.

**Signing out deletes the device's copy of every trip.** The web app deletes the copy before it ends
the session. A device whose session has ended, after 180 days unused, deletes its copy the next
time it connects, as a device whose traveller has been removed from a trip does (`ACC-F11`).

## Consequences

- The web app's requirements promise that signing out deletes every trip from the device, and that
  a device whose session has ended deletes them once it connects.
- A traveller reads a trip on the road with nothing to enter but the phone's own unlock. A
  forgotten PIN never leaves a traveller without their trip at a border with no signal.
- Anyone who has a phone unlocked, or knows its unlock code, can read every trip on it. A phone
  with no lock screen protects nothing.
- A traveller who uses a shared or borrowed computer must sign out on it, or it keeps their trips.
  The web app says so when it signs in on a computer, which it cannot tell apart from the
  traveller's own.
- A lost phone keeps its copy until its traveller signs out on it, or until it reconnects after its
  session ends. Signing a lost phone out from another device is future work.
- A copy that stays on a device never ages out by itself, so a traveller on a long trek keeps their
  trip however long they are offline.

> [!NOTE]
> **History.** ADR-0004 left the protection of a device's copy undecided, and required it to be
> decided before a trip held personal details.

## Alternatives considered

- **An optional lock of Itinero's own, opened with a fingerprint, a face or a PIN.** It guards only
  against someone who already has the phone unlocked, and a traveller who turns it on and forgets
  the PIN loses the trip until they reconnect.
- **A lock of Itinero's own, always on.** It has the cost of the optional lock for every traveller,
  for a risk the phone's lock already covers.
- **The copy encrypted with a key kept in the same browser.** Anyone who can read the storage can
  read the key beside it, so it protects nothing the phone's own encryption does not.
- **A copy kept only on a device the traveller marks as their own.** A traveller would have to
  answer it at every sign-in, and one who answers wrongly on their own phone has no trip offline.
- **A copy deleted after a set time with no connection.** A traveller on a long trek or a long
  stretch with no signal would lose their trip when they most need it.
