# Access specifications

How the access system's components are built.

| Document | Is | Runs |
|---|---|---|
| [accounts.md](accounts.md) | Travellers' accounts, and signing in with a Google account | Itinero's online side, on Cloudflare Workers |
| [membership.md](membership.md) | Who is on each trip: its admins, the invitations that bring travellers in, and removing them | Itinero's online side, on Cloudflare Workers |
| [permissions.md](permissions.md) | What each traveller may see and change of a trip's pages, calendar and bookings | A TypeScript package, on the server and in the browser |

All three are programs. `permissions.md` is a package other components call. `accounts.md` and
`membership.md` are parts of Itinero's online side, which serve requests from the web app.
