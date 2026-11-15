# ADR-0015 — Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google alone

- **Status:** Accepted
- **Date:** 2026-11-14
- **Scope:** access, planner

## Problem

Itinero has an online side. It holds each traveller's account, who is on each trip, and the one copy
of each trip that every change is applied to. It sends the emails that invite a traveller onto a
trip. Nothing said what it runs on: which servers, which database, and which service sends the
emails.

Itinero is personal software, for the person who keeps it and, later, a few friends and family. It
has one maintainer, and its running cost should be close to nothing. The rules of a trip are already
written as TypeScript packages that run in a browser and on a server: the itinerary, which holds a
trip's calendar, the pages, which hold its research, and the permissions, which decide what each
traveller may see. Whatever runs the online side has to run them unchanged. It also has to apply a
trip's changes one at a time, in order.

Travellers were to sign in with a Google or an Apple account. Apple lets a website offer its sign-in
only to members of its developer programme, which costs $99 a year. At this scale, that is more than
everything else Itinero costs together.

## Decision

The online side runs on Cloudflare, within its free plan, and travellers sign in with a Google
account alone.

**Requests are served by Cloudflare Workers.** A Worker is a program Cloudflare runs on its own
servers whenever a request arrives, with nothing for Itinero to keep running between requests.
Workers run JavaScript, so the trip's packages run in them unchanged.

**Each trip is held in a Durable Object of its own.** A Durable Object is a small program with its
own stored data, which Cloudflare runs in one place and which handles one request at a time. Each
trip's calendar, pages and grants of access live in its Durable Object, stored in the SQLite
database Cloudflare gives each one. A trip's changes are therefore applied one at a time, in order,
with nothing more built for it.

**Accounts and membership are held in one D1 database.** D1 is Cloudflare's hosted SQLite database.
It holds every account, session, member and invitation, because those reach across trips, such as
the list of trips an account is on.

**Invitations are sent through Resend**, an email sending service, within its free plan of 3,000
emails a month and 100 a day.

**Everything stays within the free plans.** On Cloudflare's free plan, a request over a limit fails,
and is never billed. Moving to a paid plan is a choice for the day the free limits are reached.

**The trip's rules stay in their own packages.** Only a thin layer, which receives requests and
reads and writes stored data, is written for Cloudflare. Moving the online side elsewhere means
rewriting that layer alone.

**Travellers sign in with a Google account.** Itinero offers no other way to sign in.

## Consequences

- Itinero costs nothing a month to run. It needs a domain name of its own, at about $10 to $15 a
  year, because Resend sends to any address only from a domain whose ownership it has checked.
- A traveller needs a Google account to join a trip. A Google account can use any email address,
  not only a Gmail one. An admin invites a traveller at the address of their Google account.
- `spec/access/accounts.md` drops Apple, and stores its records in D1. `spec/access/membership.md`
  stores its records in D1, and sends its emails through Resend.
- The copy of each trip held online, which Milestone Planner-0.3 specifies, is that trip's Durable
  Object. A Durable Object can also hold an open connection to each phone, and tell it of a change.
- The free plan allows 100,000 requests to Durable Objects a day, 5 GB of their storage, and 500 MB
  for the D1 database. A few travellers' trips use a small part of each.
- Cloudflare stores the data of Durable Objects and D1 durably, so Itinero runs no backup service of
  its own. Copying a trip out, for a traveller to keep, is future work.
- Developing the online side means Cloudflare's own tool, Wrangler, which runs Workers, Durable
  Objects and D1 on the developer's machine.
- Itinero depends on Cloudflare for everything held online. The packages that hold a trip's rules do
  not.

## Alternatives considered

- **A Node.js server with a SQLite database, on Fly.io.** It costs about $2 to $4 a month, and its
  database is one disk on one machine. Itinero would set up its own backups, and keep the server's
  software up to date.
- **A Node.js server with a PostgreSQL database.** It costs the same as SQLite on Fly.io, and adds a
  second service to run.
- **Supabase**, a hosted database with sign-in built in. Its free plan pauses a project after about
  a week of little use, which a travel app idle between trips would hit. Staying unpaused costs $25
  a month. Its database rules cannot hold access that passes down a tree of pages.
- **Firebase.** Its rules cannot hold access that passes down a tree either. Each page would carry a
  copy of who may see it, which every move would have to rewrite.
- **A server at home.** It costs nothing, but its uptime, security updates and backups would all be
  the maintainer's.
- **Keeping Sign in with Apple.** It costs $99 a year, for the travellers who have no Google
  account.
