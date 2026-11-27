# The access system's roadmap

**Kept by:** James Berry

The access system holds accounts, invitations to a trip, and who may see and change each of its
pages. Phase 0 designs it: its requirements, its components and their specifications, before any
of it is built. Phase 1 builds it, one component at a time. Phase 2 readies it for a first trip
with the app.

Access is set page by page, so its design follows the planner's pages, in Milestone Planner-0.2.

## Completed

### Phase 1 — Build

#### Milestone Access-1.4 — The online side on Cloudflare

- Itinero is registered with Google, and its client identifier is set as `GOOGLE_CLIENT_ID` in
  the Worker's Wrangler configuration.
- The online side's D1 database is made, with the tables of `access/accounts` and
  `access/membership`. The Worker is deployed to Cloudflare's free plan, at Itinero's own domain,
  `useitinero.ca`, with its secret `NONCE_KEY`.
- Resend has checked `useitinero.ca`. Invitations are sent from `invitations@useitinero.ca`, set
  as `INVITATIONS_FROM`, with the Worker's secret `RESEND_API_KEY`.
- The deployed Worker passes each check of the verification of `ACC:ACCOUNTS-F1`, with two test
  accounts at Google, and the first check of the verification of `ACC:MEMBERSHIP-F2`.

#### Milestone Access-1.3 — Membership and invitations

- `access/membership` is in the Worker, with the tables of its records, as its specification gives
  it. It sends invitations through Resend.
- Its test suite proves each requirement of `access/membership` by the verification it carries,
  against a stand-in for Resend that keeps each email sent, and one for `planner/trip-host`.

#### Milestone Access-1.2 — Permissions

- `access/permissions` is built as `@itinero/permissions`, in `packages/permissions/`, as its
  specification gives it.
- Its test suite proves each requirement of `access/permissions` by the verification it carries,
  except the checks of `ACC:PERMISSIONS-NFR1` that need a phone or a browser. It makes the rest of
  them on Node.js, under two languages and two time zones.

#### Milestone Access-1.1 — Accounts and signing in

- The Worker of the online side is started, in `services/online/`, as `@itinero/online`, with its
  D1 database and the tables of `access/accounts`. Wrangler runs it on the developer's machine.
- `access/accounts` is in the Worker, as its specification gives it.
- Its test suite proves each requirement of `access/accounts` by the verification it carries,
  against a stand-in for Google that signs ID tokens with a key of its own.

### Phase 0 — Design

#### Milestone Access-0.1 — Accounts, invitations and page access

- The access system is registered.
- Access to a page passes down to the pages beneath it, from the trip's own access as the root. An
  admin can change a traveller's access for a branch, and a traveller who may see a page may see
  every page above it (ADR-0012, access to a page passes down to the pages beneath it).
- The access system has its requirements. A traveller signs in with a Google account,
  and joins a trip by an invitation to their email address. A trip's creator is always its admin.
  A traveller sees a trip's calendar only once an admin grants it. An admin removes a traveller,
  who then loses the trip on every device.
- The access system is divided into three components: `access/accounts`, `access/membership` and
  `access/permissions`. Each has its requirements and its specification.
- Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google alone
  (ADR-0015, Itinero's online side runs on Cloudflare's free plan). Accounts and membership are held
  in a D1 database, and invitations are sent through Resend.
- A traveller chooses the name other travellers see them by when they first sign in, such as to
  accept an invitation, starting from their Google account's name, and changes it at any time.

## Pending

The checks of the access system's requirements that need a phone or the screens wait in the web
app's roadmap.

### Phase 2 — Before a first trip

#### Milestone Access-2.1 — A traveller's insurance

- Decide which fields of a traveller's insurance their account holds, and that every member of
  their trips sees them. Add the requirements to the access system, its components and the web app.
  Do TODO-54.
- Build the fields in `access/accounts`, and give them with each member's name in
  `GET /api/trips/{trip}/members`. Prove their requirements in the online side's suite.
