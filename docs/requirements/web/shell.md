# The web app's shell

What the component `web/shell` promises to travellers, and to the web app's other components. The
shell is the installable app itself: the files a browser downloads, what lets them open with no
connection, what lets a phone add Itinero to its home screen, and the time-zone rules every time is
read with. The component registry, `components.md`, gives it the prefix `WEB:SHELL`.

The web app's other components are `web/trip-store`, which keeps each trip's copy on the device, and
`web/screens`, which shows it. The time-zone rules are a file `shared/trip-time`, the component that
holds dates and times in the local time of their place, defines and reads.

---

## Functional requirements

### WEB:SHELL-F1 — Once opened with a connection, Itinero opens with none

After Itinero has opened once on a device with a connection, it opens there with no connection,
with every screen it has. It opens the same way from the browser and from a phone's home screen. ^web-shell-f1

- **Verification:** in each browser of `WEB-NFR3`,
    - open Itinero with a connection, and wait until it says it is ready to use offline
    - take the device offline, close the browser, reopen Itinero, and confirm it opens
    - open every screen in turn, and confirm each shows without a connection

> **What does this buy?** A trip's copy is no use offline unless the app that reads it opens offline
> too (`WEB-F2`).

### WEB:SHELL-F2 — A new version of Itinero is fetched in the background, and takes over only when no screen of it is open

While a device is online, the shell fetches each new version of Itinero in the background. It keeps
the version it has until every window of Itinero on the device is closed, and the new version
opens the next time. A version is used whole, never mixed with another's files. ^web-shell-f2

- **Verification:** with Itinero open on a device,
    - publish a new version, and confirm the open window keeps working on the old one
    - close every window of Itinero, reopen it, and confirm the new version opens
    - publish a version while the device is offline, and confirm the old one keeps opening until the
      device connects

> **What does this buy?** A traveller is never interrupted mid-task by an update, and a version half
> downloaded never breaks the app.

> **Does a new version ever take over an open window?** Only when the traveller asks it to, from the
> notice that says it is waiting (`WEB:SHELL-F6`), or from the one that says the online side no
> longer accepts the version they have (`WEB:SHELL-F5`).

### WEB:SHELL-F3 — Itinero can be added to a phone's home screen, and asks the browser to keep what it stores

Itinero offers what a phone needs to add it to the home screen, with its own name and icon, opening
without the browser's address bar. On an iPhone where Itinero is not yet on the home screen, the
shell says how to add it, and why. On every device, it asks the browser to keep what Itinero stores
rather than clear it when space runs short. ^web-shell-f3

- **Verification:**
    - on an iPhone in Safari, confirm the shell says how to add Itinero, and why
    - add it to the iPhone's home screen, and confirm it shows Itinero's name and icon
    - open it from the home screen, and confirm it opens without the address bar, and the shell no
      longer says how to add it
    - on the iPhone, confirm the browser reports Itinero's storage as kept
    - in each browser of `WEB-NFR3` on a computer, confirm Itinero asks the browser to keep its
      storage

> **What does this buy?** A trip's copy lasts however long the phone goes unopened (`WEB-F3`).

### WEB:SHELL-F4 — The shell loads the newest time-zone rules before any time is shown, and takes newer ones whenever it is online

Each version of Itinero carries the newest time-zone rules when it is built. Before any screen
shows a time, the shell loads the newest rules the device holds. Each time the device comes online,
it fetches Itinero's newest rules, and keeps and loads them where they are newer than those it
holds. ^web-shell-f4

- **Verification:**
    - open a new version with no connection, and confirm the rules it loads are those it was built
      with
    - publish newer rules without a new version, bring the device online, and confirm it loads them
    - take the device offline, reopen Itinero, and confirm it loads the newer rules it kept

> **What does this buy?** Every device orders and measures times with the same rules, and works
> offline from its first launch (`WEB-F8`, ADR-0008, trip-time carries its own copy of the time-zone
> rules).

### WEB:SHELL-F5 — A version too old for the online side says so, keeps its trips readable, and updates when the traveller asks

Itinero's online side, which holds each trip and answers every device, can stop accepting requests
from an older version of Itinero, such as after a change to the form of its records. A device
running such a version then says so, in a notice on every screen. Every trip it holds stays
readable, as with no connection, and it offers no way to change one. The shell fetches the newest
version, and the traveller starts it from the notice, without closing Itinero. Starting it reloads
every window of Itinero, which the notice says first. Nothing the traveller has typed is lost before
they start it. ^web-shell-f5

- **Verification:** with Itinero open on a device, on a page a traveller is editing,
    - publish a version whose online side no longer accepts the older one, and confirm the notice
      shows the next time the device reaches the online side, with the text typed still in the
      editor
    - confirm every trip the device holds still opens, and that no screen offers to change one
    - start the new version from the notice, and confirm it opens, brings every trip up to date, and
      shows no notice
    - with a second window open, start the new version in the first, and confirm the second runs it
      too

> **What does this buy?** An app installed weeks ago never sends the online side something the
> online side can no longer read, and never misreads what it is given. The traveller is told what to
> do, in one step.

> **Why not update without asking?** Starting a new version reloads every window, and would lose a
> page the traveller is in the middle of writing (`WEB:SHELL-F2`).

### WEB:SHELL-F6 — A new version waiting says so, and starts when the traveller asks

While a new version of Itinero waits for every window of Itinero on the device to close
(`WEB:SHELL-F2`), every screen says so, in a quiet notice that never takes the focus from what the
traveller is doing. It says the new version opens once every window of Itinero is closed, and
offers to start it now, as the notice of `WEB:SHELL-F5` does, without closing Itinero. Starting it
reloads every window of Itinero, which the notice says first. The traveller can put the notice away
until the window next reloads. Where the online side no longer accepts the version running, only the
notice of `WEB:SHELL-F5` shows. ^web-shell-f6

- **Verification:** with Itinero open in two windows on a device, typing in an editor in the first,
    - publish a new version, and confirm both windows show the notice, with the editor still focused
      and its text kept
    - start the new version from the notice, and confirm both windows run it, and show no notice
    - publish another, put the notice away, and confirm it stays away until the window reloads
    - publish a version whose online side no longer accepts the one running, and confirm only the
      notice of `WEB:SHELL-F5` shows

> **What does this buy?** A traveller who keeps Itinero open for days learns that a new version is
> waiting, and starts it in one step, at a moment they choose.

> **Why not start it when the traveller reloads?** A reload does not close the window, so the old
> version keeps it (`WEB:SHELL-F2`). Without the notice, a traveller who reloads, or signs out and in
> again, sees no change and cannot tell why.

---

## Non-functional requirements

### WEB:SHELL-NFR1 — The shell's own work adds little to opening Itinero

With every file already on the device, the shell has Itinero ready to show its first screen within
300 milliseconds of opening, on a phone. ^web-shell-nfr1

- **Verification:** on such a phone, with no connection,
    - open Itinero from the home screen ten times, and confirm the shell is ready within 300
      milliseconds each time

> **What does this buy?** Most of the two seconds a trip has to open is left for the trip itself
> (`WEB-NFR1`).

---

## Non-requirements

| Identifier | The shell does not | Because |
|---|---|---|
| **WEB:SHELL-NR1** | Show notifications, or wake the device | Notifications are future work (`WEB-NR5`) |
| **WEB:SHELL-NR2** | Hold any trip, or anything of a traveller's | `web/trip-store` holds a device's trips, and deletes them on sign-out |
| **WEB:SHELL-NR3** | Let a traveller keep an older version of Itinero | Each version must agree with the online side it was published with |

^web-shell-nr
