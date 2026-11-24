# The live work list

What needs active work, and what waits on a decision. `documentation-system.md` gives the list's
rules. When an item is done, it leaves this list for `CHANGELOG.md` in the commit that finishes it.

*Next free:* TODO-42

## Tags

| Tag | Means |
|---|---|
| access | Accounts, invitations and permissions |
| access/accounts | Travellers' accounts, and signing in with a Google account |
| access/membership | Who is on each trip: its admins, the invitations that bring travellers in, and removing them |
| access/permissions | What each traveller may see and change of a trip's pages, calendar and bookings |
| bookings | A trip's bookings, such as flights, stays and tours, each for the travellers it names, and the page that lists them |
| bookings/activity | A tour, a ticket or a table, at one place, on a date and perhaps at a time |
| bookings/flight | A flight, in one or more legs, each leaving and arriving in its own airport's local time |
| bookings/journey | A train, a bus, a ferry or a hired car, from one place to another, with a time at each end |
| bookings/list | A trip's bookings: adding, changing and removing each one, the travellers it names, and the order they happen in |
| bookings/stay | One or more nights' stay, such as a hotel or a flat, from check-in to check-out |
| planner | The trip planner |
| planner/checklists | Each traveller's checklists on a trip, which only they see and tick, and their own templates, kept outside any trip, to start each from |
| planner/itinerary | The itinerary: a trip's pencilled stretches and firm items |
| planner/library | Each traveller's library of checklist templates, kept online outside any trip |
| planner/pages | The pages of a trip |
| planner/trip-host | The copy of each trip held online, in a Durable Object of its own, which applies every change and keeps each traveller's devices up to date |
| shared/doc-check | The documentation checker |
| shared/doc-scaffold | The scaffolder that starts new documents |
| shared/trip-time | Local dates and times, and time zones |
| web | The web app, on a computer and on a phone |
| web/places | The places a device knows the time zone of: every airport, and the towns of each country its trips visit |
| web/screens | What travellers see and use: the home page, the calendar, the bookings page, the pages of research, their checklists and templates, and the trip's members |
| web/shell | The installable app itself: launching with no connection, adding it to a phone's home screen, and keeping the time-zone rules up to date |
| web/trip-store | Each trip's copy on a device: catching it up, telling it of changes as they happen, sending changes, and deleting it on sign-out |
| docs | The documentation system, and the tools authors use with it |
| ci | The workflows that test each pull request and each push to `main` |

## Items

### TODO-4 — Let a traveller change a trip while offline

*Tags:* web, planner/itinerary
*Written:* 2026-11-11

*Problem:* A traveller with no connection can read a trip but cannot change it.

*Reason:* ADR-0004 (a trip can be read without a connection, but changed only with one) kept the
trip held online as the only copy anyone changes. That way, two changes never need reconciling.

*Proposal:* Decide how changes made on two phones while apart are reconciled. Record it in a
decision record that supersedes ADR-0004.

*Releases:* Nothing is planned for it yet.

### TODO-6 — Show a time in another time zone

*Tags:* shared/trip-time
*Written:* 2026-11-12

*Problem:* A traveller sees each time only in the local time of its place, and cannot see it in
another time zone, such as their home's.

*Reason:* Converting imprecise values, such as an afternoon in Paris seen in Tokyo time, raised
questions that were left for later (`SHR:TRIP-TIME-NR2`).

*Proposal:* Decide which time zones a traveller can pick, and how each kind of value converts.
Then add the requirements to trip-time.

*Releases:* Nothing is planned for it yet.

### TODO-7 — Write dates and times in languages other than English

*Tags:* shared/trip-time
*Written:* 2026-11-12

*Problem:* trip-time writes dates and times only in English.

*Reason:* The first requirements for trip-time keep to English (`SHR:TRIP-TIME-NR3`). Which
other languages travellers need is not known yet.

*Proposal:* Decide which languages to support first, and add the requirements to trip-time.

*Releases:* Nothing is planned for it yet.

### TODO-11 — Find the city a traveller is in, for the home page

*Tags:* planner, web
*Written:* 2026-11-14

*Problem:* A trip's home page links to the page for the country the traveller is in, but not to the
page for their city.

*Reason:* The phone works out its country from its own location, with a small map of country
borders held on it (ADR-0014, a trip opens on a home page for each traveller). Finding the city
needs a far larger list of places on the phone, and pages that remember the place they are about.
The country was enough to start with (`PLN-NR7`).

*Proposal:* Decide where the list of places comes from, and how a page records its place. Then
add the requirements to the planner and the web app.

*Releases:* Nothing is planned for it yet.

### TODO-13 — Merge two travellers' edits to one page automatically

*Tags:* planner/pages, planner/trip-host, web
*Written:* 2026-11-14

*Problem:* When two travellers edit the same page at once, the second save is refused, and the
second traveller combines the two texts by hand.

*Reason:* Refusing a save made from an older version of a page loses no work, and is simple to
build (`PLN-NR8`). Merging edits as they are made changes how a page's text is stored and sent.

*Proposal:* Look into merging edits automatically, such as with a CRDT, a data type built so that
edits made at once on two devices always combine into the same text. Record the choice in a
decision record scoped `planner`.

*Releases:* Nothing is planned for it yet.

### TODO-14 — Read a booking in from its confirmation email

*Tags:* bookings, bookings/flight, bookings/stay
*Written:* 2026-11-14

*Problem:* A traveller copies every booking in by hand, from a confirmation they already hold as
an email.

*Reason:* Reading confirmations from many airlines and hotels is the largest part of the bookings
system, and travellers needed their bookings before it could be built (ADR-0016, a trip's bookings
are entered by hand, as one of four kinds, and kept with the trip online). It left open whether
Itinero should import bookings at all.

*Proposal:* Decide whether Itinero should import bookings at all. If it should, decide how a
confirmation reaches Itinero, such as by forwarding it to an address of the trip, and how its
booking is matched to a trip and its travellers, and record it in a decision record scoped
`bookings`.

*Releases:* Nothing is planned for it yet.

### TODO-15 — Hold a file with a booking, such as a ticket or a boarding pass

*Tags:* bookings, bookings/list, web
*Written:* 2026-11-14

*Problem:* A booking holds text only, so a traveller opens a ticket's file from their email, which
may need a connection.

*Reason:* Files would fill the free plan's storage, and every phone's copy of a trip, faster than
every other part of a trip together (`BKG-NR2`).

*Proposal:* Decide whether a booking should hold files at all. If it should, decide where files are
kept, how large one may be, and whether each phone keeps a copy of its traveller's files to read
with no connection, and record it in a decision record scoped `bookings`.

*Releases:* Nothing is planned for it yet.

### TODO-16 — Sign a lost device out from another device

*Tags:* access/accounts, web
*Written:* 2026-11-14

*Problem:* A traveller who loses a phone cannot sign it out from another device, so the lost phone
keeps its copy of every trip, and its session, until it goes 180 days unused.

*Reason:* Each device signs out for itself (`ACC:ACCOUNTS-NR3`). A device's copy is protected by
the device's own lock alone (ADR-0017, a trip's copy on a device is protected by the device's own
lock, and deleted when its traveller signs out).

*Proposal:* Consider listing the devices a traveller is signed in on, and letting them sign out
any or all of them, so that each deletes its copy the next time it connects. Decide it in a
decision record scoped `access/accounts` and `web`.

*Releases:* Nothing is planned for it yet.

### TODO-20 — Limit the invitation emails one account can send

*Tags:* access/membership
*Written:* 2026-11-19

*Problem:* Any Google account can sign in, create a trip, and make Itinero send as many invitation
emails as it likes, to any address, from `invitations@useitinero.ca`, carrying its own name and
trip name as free text, which can hold a link.

*Reason:* Signing in is open to every Google account (`ACC:ACCOUNTS-F1`), any traveller can create
a trip and be its admin, and the online side counts nothing before it sends an invitation. A
security audit on 2026-11-19 found no limit in the source. Whether Cloudflare or Resend limits it
is not known.

*Proposal:* Check Cloudflare for a rate-limiting rule on the trip and invitation routes, and
Resend's sending limits. Then cap the invitations an account sends in a day, and to one address,
refusing the rest. Decide also whether open sign-up is what production wants.

*Releases:* Nothing is planned for it yet.

### TODO-21 — Decide whether a page shows images from other sites

*Tags:* planner/pages, web/screens
*Written:* 2026-11-19

*Problem:* An image written in a page's Markdown, such as `![x](https://example.com/p.png)`, loads
from that site as soon as another traveller opens the page, so whoever wrote it learns each
reader's IP address, browser and the time they read it.

*Reason:* The screens leave micromark's settings as they are (`WEB:SCREENS-NR4`), and those keep
images. The screens give every link to another site no referrer, but they do nothing with images,
and the web app sets no Content-Security-Policy. The pages component holds no images of its own
(`PLN:PAGES-NR4`), but that does not say whether one from another site may be shown.

*Proposal:* Decide whether a page may show an image from another site. If not, turn off
micromark's image syntax, or allow images only from Itinero's own address, and test that a page
with an image loads nothing from another site.

*Releases:* Nothing is planned for it yet.

### TODO-22 — Send the headers that keep the web app safe in a browser

*Tags:* web/shell
*Written:* 2026-11-19

*Problem:* The web app is served with no Content-Security-Policy, no `frame-ancestors`, no
`Referrer-Policy` and no `Strict-Transport-Security`.

*Reason:* The Worker serves the web app as static files, and nothing yet adds headers to them. The
session cookie's `SameSite=Lax` and micromark's settings stop the attacks these headers guard
against today, so they were not needed to ship.

*Proposal:* Add the headers to every response, with a policy that allows scripts, styles and
images only from Itinero's own address, allows no framing, and sends no referrer. Test that every
screen still works under the policy.

*Releases:* Nothing is planned for it yet.

### TODO-23 — Refuse, in a deploy, the settings only the tests use

*Tags:* access/accounts, web/shell
*Written:* 2026-11-19

*Problem:* Nothing stops a deploy from carrying a setting only the tests should use: with
`GOOGLE_KEYS_URL` set, anyone could sign in as anyone, and a build made with `ITINERO_TEST` set
gives every page the test hooks. The Worker may also answer at a `workers.dev` address, a second
origin beside `useitinero.ca`.

*Reason:* The tests point the Worker at stand-ins through variables that every deploy leaves unset,
and the deploy builds the web app from whatever the shell holds. Settings made in Cloudflare's
dashboard are not in the repository.

*Proposal:* Check Cloudflare's dashboard that none of the test variables is set. Make the Worker
ignore them unless it runs on this machine, make the deploy script refuse to run with
`ITINERO_TEST` set, and set `workers_dev` and `preview_urls` to false in `wrangler.toml`.

*Releases:* Nothing is planned for it yet.

### TODO-24 — Check the origin of a trip's live socket

*Tags:* planner/trip-host
*Written:* 2026-11-19

*Problem:* The live socket for a trip is opened without checking which site asked for it, so only
the cookie's `SameSite=Lax` stops another site from opening one with a traveller's session.

*Reason:* A browser cannot add the `Itinero-Api` header to a WebSocket, so the socket is let
through without it. It carries only the trip's sequence number, so another site could learn no
more than when the trip changes.

*Proposal:* Refuse a socket whose `Origin` is not the Worker's own address.

*Releases:* Nothing is planned for it yet.

### TODO-25 — Stop a sign-in from fetching Google's keys again for every unknown key

*Tags:* access/accounts
*Written:* 2026-11-19

*Problem:* A sign-in whose token names a key Google does not hold makes the Worker fetch Google's
key set again, so anyone can make it fetch once for each request they send.

*Reason:* The Worker fetches the key set afresh whenever a token names a key the cached set lacks,
so that it learns a key Google has just added.

*Proposal:* Fetch afresh at most once a minute, and refuse a token naming an unknown key until
then.

*Releases:* Nothing is planned for it yet.

### TODO-26 — Ask a traveller before accepting an invitation

*Tags:* access/membership, web/screens
*Written:* 2026-11-19

*Problem:* Opening an invitation's link while signed in accepts it at once, so a link planted
elsewhere can put a traveller on a trip they never chose to join.

*Reason:* The invitation screen accepts as soon as it opens, which saves a step. Only the invited
address can accept, which limits the harm.

*Proposal:* Show the trip and who invited the traveller, with a button to accept.

*Releases:* Nothing is planned for it yet.

### TODO-27 — Add a member only from the acceptance that closed the invitation

*Tags:* access/membership
*Written:* 2026-11-19

*Problem:* Two acceptances of one invitation sent at once both write the member, so the second can
put back on the trip a traveller an admin removed between the two.

*Reason:* The acceptance adds the member wherever the invitation is accepted by that account, not
only where the request itself closed the invitation. The window is short, and the invitee cannot
widen it.

*Proposal:* Add the member only where this request's own close changed the invitation, and
otherwise give back the grant it added.

*Releases:* Nothing is planned for it yet.

### TODO-28 — Withdraw the open invitations of an admin who is removed

*Tags:* access/membership
*Written:* 2026-11-19

*Problem:* An admin removed from a trip leaves their open invitations behind, so someone they
invited, such as the admin at another address, can still join for up to 14 days.

*Reason:* Removing a member does not look at the invitations they sent, though each invitation
records who sent it.

*Proposal:* Decide whether removing an admin withdraws the invitations they sent. If it does,
withdraw them in the same batch as the removal.

*Releases:* Nothing is planned for it yet.

### TODO-29 — Take away a removed member's admin role first

*Tags:* access/membership
*Written:* 2026-11-19

*Problem:* Where a removal stops after the trip's grants change, the member's row still says they
are an admin, so they can still invite, make admins and remove members until the removal is done
again.

*Reason:* A removal changes the trip's grants first and its members last (`ACC:MEMBERSHIP-F4`), so
that a removal that stops part way leaves a traveller with less access, never more. The admin
role, kept with the members, is cleared only in the last step.

*Proposal:* Clear the admin role before the trip's grants change, in a step of its own.

*Releases:* Nothing is planned for it yet.

### TODO-30 — Check a traveller's email address afresh before they accept an invitation

*Tags:* access/accounts, access/membership
*Written:* 2026-11-19

*Problem:* An account keeps the email address it last signed in with for as long as its session
lasts, so an account whose address has since passed to someone else can still accept an
invitation sent to it.

*Reason:* The account's address is updated only when its traveller signs in, and a session lasts
until it goes 180 days unused. Addresses are also compared after lowering their case only.

*Proposal:* Decide whether accepting an invitation needs a fresh sign-in with Google, and whether
addresses are compared in a normalised form.

*Releases:* Nothing is planned for it yet.

### TODO-31 — Refuse a hidden page or booking as if it did not exist

*Tags:* access/permissions, planner/trip-host, access/membership
*Written:* 2026-11-19

*Problem:* A traveller can tell whether a page or booking they may not see exists, from which
refusal a change naming it gets. An admin can likewise tell whether a member's account holds an
email address they guess, from the refusal of an invitation to it.

*Reason:* Each refusal names its own cause, which helps a traveller fix a change. Only identifiers
are given away, never a title or text, and some identifiers, such as a country's page, can be
guessed.

*Proposal:* Decide whether a page or booking the traveller may not see is refused as unknown, and
whether inviting a member's address is refused as an invitation is.

*Releases:* Nothing is planned for it yet.

### TODO-32 — Check access for a booking with no travellers

*Tags:* planner/trip-host
*Written:* 2026-11-19

*Problem:* A booking change whose new list of travellers is empty is not checked against the
traveller's access, and is refused only because the bookings component refuses a booking with no
travellers.

*Reason:* The trip host checks the access of each traveller a booking names, and an empty list names
none.

*Proposal:* Refuse an empty list of travellers in the trip host, before any access is checked.

*Releases:* Nothing is planned for it yet.

### TODO-33 — Give the workflows only the access they need

*Tags:* ci
*Written:* 2026-11-19

*Problem:* The workflows run with the repository's default token access, keep the token on disk
while they install and test, and name their actions by major version, which their owners can move.

*Reason:* The workflows were written to test, and neither publishes nor deploys, so their access was
left at the defaults.

*Proposal:* Set `permissions: contents: read`, check out with `persist-credentials: false`, and pin
every action to a commit, which Dependabot keeps up to date.

*Releases:* Nothing is planned for it yet.

### TODO-34 — Check the files the build scripts read before building from them

*Tags:* shared/trip-time, web/places, web/screens
*Written:* 2026-11-19

*Problem:* The time-zone rules, the places and the country borders are built from files a maintainer
downloads by hand, and nothing checks that each file is the one its publisher made.

*Reason:* The built files are committed, so a change to them is read in a pull request. But the
time-zone build compiles and runs IANA's own program, on the maintainer's computer.

*Proposal:* Check IANA's signature on each release before building from it, and record each other
file's SHA-256 digest in the script that reads it.

*Releases:* Nothing is planned for it yet.

### TODO-35 — Find what a trip's changes can cost the trip host

*Tags:* planner/trip-host
*Written:* 2026-11-19

*Problem:* No one has checked how much work one traveller's changes can push onto a trip's Durable
Object, and so onto every other traveller on the trip.

*Reason:* A trip limits the size of each page and booking, but not how many there are, nor the size
of a request. Every change of the calendar, the grants or the bookings reads the whole tree of
pages. The security audit on 2026-11-19 left this unchecked.

*Proposal:* Review the trip host's changes and catch-ups for cost, for text that is stored but later
fails to read, and for requests larger than any change needs. Then add the limits the review finds
are needed.

*Releases:* Nothing is planned for it yet.

### TODO-36 — Find what signing in and creating trips can cost the online side

*Tags:* access/accounts, planner/trip-host
*Written:* 2026-11-19

*Problem:* No one has checked what one account, or no account, can make the online side do through
signing in, creating trips and listing them.

*Reason:* Nonces are free to make, a trip creates a Durable Object, an account may create any number
of trips, and listing an account's trips asks each trip's Durable Object in turn. The security audit
on 2026-11-19 left this unchecked.

*Proposal:* Review these routes for cost, and decide on limits such as trips per account, with
Cloudflare's rate limiting where the Worker cannot count.

*Releases:* Nothing is planned for it yet.

### TODO-37 — Keep a trip's copy on a computer however long it goes unopened

*Tags:* web/shell, web/trip-store
*Written:* 2026-11-21

*Problem:* On a computer, the browser may clear a trip's copy left long unopened, so `WEB-F3` holds
only on a phone.

*Reason:* Itinero asks every browser to keep what it stores (`WEB:SHELL-F3`). In Milestone
Web-1.5's checks, on 2026-11-21, the iPhone kept it, but Chrome and Safari on a computer answered
no. Each decides for itself, by how much a site is used, or whether it is installed. Safari can also
clear a site's storage after some days of use in which the site is not opened.

*Proposal:* Find what makes Chrome, Safari, Firefox and Edge on a computer keep Itinero's storage,
such as installing it, and decide whether the web app suggests it on a computer as it does on an
iPhone. If nothing will, say on a computer that a trip's copy may be cleared.

*Releases:* Nothing is planned for it yet.

### TODO-38 — Offer no access to change for an admin

*Tags:* web/screens
*Written:* 2026-11-21

*Problem:* An admin's member screen offers to change the admin's access to the trip, the calendar
and each page, though an admin sees and changes the whole trip whatever is set.

*Reason:* The member screen shows every member's grant in the same way (`spec/web/screens.md`
§4.7). In Milestone Web-1.5's checks, on 2026-11-21, changing the creator's access to the trip
seemed to do nothing.

*Proposal:* Show an admin's access as edit throughout, with nothing to change, and say why.

*Releases:* Nothing is planned for it yet.

### TODO-40 — Print a sheet of a trip's details for when a phone is lost

*Tags:* web/screens, bookings, planner
*Written:* 2026-11-21

*Problem:* A traveller whose phone is lost, stolen or flat has no copy of their trip's dates,
stays, flight numbers and booking references, or of the numbers to call for help.

*Reason:* Reading a trip with no connection covers a phone that is offline, not one that is gone,
and nothing in the web app is laid out for paper. Each detail sits on its own screen: the calendar,
the bookings page or a page of research.

*Proposal:* Decide what the sheet holds for each traveller, from what that traveller may see,
including whether it takes the trip's country pages whole. Then add the requirements to the web
app's screens.

*Releases:* Nothing is planned for it yet.

### TODO-41 — Make the web app's browser tests pass every run

*Tags:* ci, web
*Written:* 2026-11-24

*Problem:* The browser tests of `test-packages` fail now and then, on a different test each time,
with no change that explains it. Three of the runs on `main` between 2026-11-21 and 2026-11-24
failed this way, and a pull request's run fails with them.

*Reason:* The failures seen are of tests that sign a new traveller in, or that wait on a screen
drawn after a catch-up. On 2026-11-24, in Firefox, the list of trips never showed after a new
traveller chose their name, in `screens-trip.spec.ts`. Earlier runs failed the same way in
`screens-account.spec.ts` and `screens-checklists.spec.ts`, in each of the three engines, and once
on the shell's timing test. The same day's rerun failed instead in Chromium, where the trip's home
page, opened with no connection, was drawn twice, not once (`WEB-NFR1`). Run locally ten times in
Firefox, the booking test failed once.

*Proposal:* Find what each failing test waits on that is not yet there, and wait on the state the
screen depends on instead. Until then, a failed run of `test-packages` is rerun before it is read as
a fault.

*Releases:* Nothing is planned for it yet.
