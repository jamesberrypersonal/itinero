# The access system's roadmap

**Kept by:** James Berry

The access system holds accounts, invitations to a trip, and who may see and change each of its
pages. Phase 0 designs it: its requirements, its components and their specifications, before any
of it is built.

Access is set page by page, so its design follows the planner's pages, in Milestone Planner-0.2.

## Completed

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

Nothing is pending. Milestone Access-0.1 is complete in design, and building it is not yet planned.
