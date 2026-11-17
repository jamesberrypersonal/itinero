# The accounts component

**Assumes** [accounts.md](../../requirements/access/accounts.md) — what the accounts component promises, and the provider and sessions it works with.

## 1. Purpose

The accounts component is the part of Itinero's online side that holds each traveller's account,
signs a traveller in with Google, and names the account behind every request. Every other
check of a request, such as what a traveller may see, starts from the account it gives.

## 2. Scope

The accounts component covers accounts, signing in, sessions, and naming the account behind a
request.

Three things act on it:

- **The web app**, the system travellers use on a computer or a phone, signs a traveller in and
  out, and sends its session with every request (§3.2).
- **`planner/trip-host`**, the component holding the copy of each trip online, passes it each
  request, and is given the account that sent it.
- **`access/membership`**, the component that holds who is on each trip, reads an account by its
  identifier, to match an invitation's address and to name each member.

Deliberately absent:

- what a traveller may see or change, which `access/permissions` decides
- who is on a trip, which `access/membership` holds
- joining two of a traveller's Google accounts into one
- signing in by any other means than Google, or holding a password
- deleting an account

Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google alone
(ADR-0015, Itinero's online side runs on Cloudflare's free plan, and travellers sign in with Google
alone). The accounts component is part of one Cloudflare Worker, a program Cloudflare runs on its
servers for each request that arrives. Its records are held in D1, Cloudflare's hosted SQLite
database.

## 3. Interface

### 3.1 User interface

None. The web app shows the sign-in button Google supplies, and a sign-out command.

### 3.2 Application interface

The accounts component answers four requests over HTTPS, each with a JSON body. It also checks the
version of the web app behind every request of the online side, before any component answers (§4.7).
Every response that refuses gives a status of 400, 401 or 426, and a JSON body
`{ "code": ..., "message": ... }`, whose message is one English sentence the web app may show.

| Request | Body | Gives |
|---|---|---|
| `POST /api/auth/nonce` | None | `{ "nonce": ..., "google": ... }`: a single-use value for the next sign-in (§4.1), and Itinero's client identifier at Google, which the sign-in screen draws Google's button with |
| `POST /api/auth/sign-in` | `{ "provider": "google", "idToken": ..., "nonce": ... }` | `{ "account": ..., "email": ..., "name": ..., "named": ... }`, and sets the session (§4.2) |
| `PUT /api/auth/name` | `{ "name": ... }` | `{ "name": ... }`, and sets the account's name (§4.5) |
| `POST /api/auth/sign-out` | None | Nothing, and ends the session sent with it (§4.4) |

The session is set as a cookie named `itinero_session`, marked `Secure`, `HttpOnly` and
`SameSite=Lax`, so that a script on the page cannot read it. The web app sends it with every
request without handling it. The cookie lasts 180 days, and is set again each time the session's
last use is written (§4.3), so that it lasts as long as the session does.

| Refusal code | Status | When |
|---|---|---|
| `bad-token` | 401 | An ID token whose signature, issuer, audience or expiry fails §4.2 |
| `bad-nonce` | 401 | A nonce the accounts component did not give, already used, or older than 10 minutes |
| `bad-name` | 400 | A name that is empty once trimmed, or longer than 60 characters (§4.5) |
| `no-session` | 401 | A request with no session, or with one that has ended (§4.3) |
| `update-first` | 426 | A request of the online side from a version of the web app too old to answer (§4.7) |
| `malformed` | 400 | A body not in the form above |

### 3.3 Programming interface

Inside the online side, the accounts component gives two functions to `planner/trip-host` and
`access/membership`:

```ts
type AccountId = string;      // "u-" and 22 characters of base64url, unique and never reused
type Account = { id: AccountId; email: string; emailVerified: boolean;
                 name: string; named: boolean };   // named: the traveller has chosen it

function whoSent(request: { session?: string }): Promise<Result<Account>>;
function account(id: AccountId): Promise<Account | undefined>;
```

`whoSent` gives the account behind a request, or refuses it with `no-session` (`ACC:ACCOUNTS-F4`).
`account` gives an account by its identifier, as `access/membership` needs to match an invitation's
address. `Result` has the form `shared/trip-time` gives it: `{ ok: true, value }` or
`{ ok: false, refusal }`.

### 3.4 Systems this drives

The accounts component signs a traveller in through Google, using OpenID Connect, the standard
protocol by which a provider vouches for who a person is. Google's sign-in, in the browser, gives
the web app an ID token: a short-lived statement, signed by Google, holding these claims among
others.

| Claim | Holds |
|---|---|
| `iss` | The issuer: `https://accounts.google.com`, or `accounts.google.com` |
| `aud` | The audience: the client identifier Itinero registered with Google |
| `sub` | The subject: the provider's own identifier for the person, which never changes |
| `email`, `email_verified` | The person's email address, and whether the provider has confirmed it is theirs |
| `name` | The person's name, as their Google account gives it, where they have one |
| `exp` | When the token stops being valid |
| `nonce` | The single-use value the web app passed to the sign-in, which ties the token to it |

Google publishes the public keys it signs tokens with, as a JSON Web Key Set at
`https://www.googleapis.com/oauth2/v3/certs`. The accounts component fetches the set, keeps it in
Cloudflare's cache for the time the response allows, and fetches it again when a token names a key
it does not hold. Google's documents for Sign in with Google give the full flow.

The sign-in in the browser needs only the client identifier, which is public. The ID token flow
needs no client secret, so the online side holds none for Google.

## 4. Behaviour

Behaviour crossing every operation:

- **The server's clock is the only clock.** Every expiry is checked against the online side's own
  clock, never a device's.
- **Secrets are compared in constant time**, so that how long a comparison takes reveals nothing of
  the value held.

### 4.1 The nonce

*Porcelain:* `POST /api/auth/nonce` gives a nonce, and stores nothing. A nonce is 16 random bytes
and the time it was made, followed by a code made from both. The code is their HMAC-SHA256, made
with the Worker's secret `NONCE_KEY`. All three are written in base64url. Only the online side can
make a nonce whose code checks.
Asking for any number of nonces therefore writes no record, and so uses none of the rows the free
plan lets the online side write each day.

A sign-in naming a nonce uses it up, by storing its SHA-256 digest (§4.2). A nonce older than 10
minutes is refused whether or not it was used.

### 4.2 Signing in

*Porcelain:* `POST /api/auth/sign-in` accepts an ID token only when every check below passes
(`ACC:ACCOUNTS-F1`):

1. the nonce given has a code that checks with `NONCE_KEY`, and was made under 10 minutes ago, or
   the sign-in is refused with `bad-nonce`
2. the token's signature checks against a key of its provider's key set, or it is refused with
   `bad-token`
3. its `iss` is its provider's, its `aud` is Itinero's client identifier for that provider, its
   `exp` is not past, and its `nonce` equals the nonce given, or it is refused with `bad-token`
4. the nonce's digest is stored, and is not stored already, or the sign-in is refused with
   `bad-nonce`

Nothing is written before the fourth check, so a sign-in with a token Google did not sign for
Itinero writes no record. The fourth check is one insert, which fails when the digest is stored
already, so two sign-ins naming one nonce at once cannot both pass.

The account is then found by the pair of the provider and `sub`. Where no account holds the pair,
one is made, with a new identifier. Where the token holds an `email`, the account's address and
`emailVerified` are set from it (`ACC:ACCOUNTS-F2`). Where it holds none, an account already made
keeps its address as it was, and a new one is made with an empty address, not verified. The
address is kept in lower case.

A new account's `name` is the token's `name`, trimmed and cut to 60 characters, or the part of its
email address before the `@` where the token holds no name. Where the token holds neither, it is
`Traveller`. Its `named` is false. A sign-in to an
account that already exists never changes its name (`ACC:ACCOUNTS-F5`). The sign-in gives `name`
and `named`, so that the web app asks a traveller for their name while `named` is false.

A new session is then started for the device (§4.3), and set as its cookie.

### 4.3 Sessions

*Plumbing:* a session is 32 random bytes, written in base64url. The accounts component keeps only
its SHA-256 digest, with the account it belongs to and the time it was last used
(`ACC:ACCOUNTS-NFR1`). The session itself exists only on the device.

`whoSent` takes the digest of the session the request carries, and finds it. It gives the session's
account, and sets its last use to now, where the session was used within the last 180 days. It
refuses with `no-session` otherwise, and forgets a session past its 180 days (`ACC:ACCOUNTS-F3`). A
session's last use is written at most once an hour, so that a busy device does not write on every
request.

### 4.4 Signing out

*Porcelain:* `POST /api/auth/sign-out` forgets the session sent with it, and clears the cookie.
Sessions on the account's other devices are unchanged. Signing out with no session, or one already
ended, succeeds and does nothing.

### 4.5 Choosing a name

*Porcelain:* `PUT /api/auth/name` sets the name of the account behind the request's session, and
sets `named` to true (`ACC:ACCOUNTS-F5`). The name is trimmed of white space at both ends, and
refused with `bad-name` where it is then empty, or longer than 60 characters, counted as Unicode
code points. A request with no session is refused with `no-session`. Setting the name an account
already holds sets `named`, and changes nothing else.

### 4.6 The test suite

The suite runs the checks in the verification of each requirement the accounts component claims,
against a provider stand-in that signs ID tokens with a key of its own. It also checks each refusal
of §3.2, and that the stored records hold no session and no password. It runs with `npm test` in
`services/online/`, inside Wrangler, Cloudflare's own tool, which runs the Worker and a D1 database
on the developer's machine. The suite uses Cloudflare's Vitest integration, which runs each test
file in the Workers runtime, with the Worker's Wrangler configuration and a D1 database of its own.
The recipe `just test-online` runs it from anywhere in the repository.

### 4.7 A version of the web app too old to answer

*Porcelain:* every request whose path begins `/api/` carries a header named `Itinero-Api`. The
header holds a whole number. The number names the form of the requests and records that the version
of the web app sending it was built to send and read, as `spec/web/shell.md` §4.7 gives. The Worker
holds the oldest number it answers, as `OLDEST_API`. It refuses a request whose number is lower, or
that carries none, with `update-first`, before it looks for a session or passes the request to any
component (`WEB:SHELL-F5`). Nothing is read or written for a request so refused.

The Worker makes one exception: the request that opens a trip's WebSocket, a connection the online
side holds open to tell a device each time the trip changes. That request carries no number, because
a browser lets no page add a header to it, and the Worker does not refuse it for that. The socket
carries only a count of the trip's changes. The device then asks for the changes themselves with a
request checked like any other.

## 5. Resources

The accounts component stores three kinds of record, each a table of the online side's D1
database.

| Record | Holds | Kept |
|---|---|---|
| Account | Its identifier, its provider, the provider's `sub`, its email address, `emailVerified`, its `name` and `named`, and when it was made | For as long as Itinero runs. Deleting an account is future work |
| Session | The SHA-256 digest of the session, its account, and when it was last used | Until signed out, or 180 days unused |
| Nonce | The SHA-256 digest of a nonce a sign-in used, and when it was made | Until the daily task below deletes it, once it is 10 minutes old and §4.2 refuses it for its age anyway |

The pair of the provider and `sub` is unique across accounts. A provider of `google` is the only one
written today. The column is kept, so that an account's provider is never guessed. A scheduled task
of the Worker, which Cloudflare runs once a day, deletes every session past its 180 days and every
nonce past its 10 minutes.

Itinero's client identifier at Google is set as a variable of the Worker, named `GOOGLE_CLIENT_ID`,
in its Wrangler configuration. `NONCE_KEY` is 32 random bytes, set as a secret of the Worker with
Wrangler, and never in the repository. Changing it refuses every nonce not yet used, which costs a
traveller signing in at that moment one more try. `OLDEST_API` is a constant of the Worker's code,
so that it changes only with a deploy.

The web app's browser tests run the Worker on the developer's machine, over plain HTTP. They set
three more variables of the Worker, which every deploy leaves unset:

- `GOOGLE_KEYS_URL` points the Worker at a stand-in for Google's key set.
- `SESSION_COOKIE_INSECURE`, set to `yes`, leaves `Secure` off the session cookie. WebKit, the
  engine of Safari, keeps a cookie marked `Secure` only over HTTPS.
- `OLDEST_API` takes the place of the constant of the same name, so that a test raises the oldest
  number in `Itinero-Api` the Worker answers, as a deploy raises the constant.

| Resource | Path | Owned by |
|---|---|---|
| The Worker of the online side | `services/online/`, which `planner/trip-host` shares | Whoever keeps the access system's roadmap |
| The tables `accounts`, `sessions` and `nonces` | The online side's D1 database | Whoever keeps the access system's roadmap |
| The client identifier registered with Google | `GOOGLE_CLIENT_ID`, in the Worker's Wrangler configuration | Whoever keeps the access system's roadmap |
| The key nonces are made with | `NONCE_KEY`, a secret of the Worker | Whoever keeps the access system's roadmap |

## 6. Quality attributes

- **No password, and nothing to replay** (`ACC:ACCOUNTS-NFR1`). Itinero holds no password, and
  keeps only digests of sessions and nonces, so a copy of its records starts no session.
- **Every token is checked against its provider's own keys** (`ACC:ACCOUNTS-F1`), and a nonce ties
  each token to one sign-in, so a token captured from one sign-in cannot be used again.
- **Unreadable by scripts.** The session is an `HttpOnly` cookie, so a script injected into a page
  cannot read it.
- **Fails closed** (`ACC:ACCOUNTS-F4`). A request whose session is missing, unknown or ended names
  no account, and is refused.

## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [ACC:ACCOUNTS-F1](../../requirements/access/accounts.md#^acc-accounts-f1) | Signing in, with every check of §4.2, and accounts found by provider and subject. |
| [ACC:ACCOUNTS-F2](../../requirements/access/accounts.md#^acc-accounts-f2) | The email address and `emailVerified` set at each sign-in, in §4.2, and `account` in §3.3. |
| [ACC:ACCOUNTS-F3](../../requirements/access/accounts.md#^acc-accounts-f3) | Sessions, and their 180 days, in §4.3, and signing out in §4.4. |
| [ACC:ACCOUNTS-F4](../../requirements/access/accounts.md#^acc-accounts-f4) | `whoSent`, in §3.3 and §4.3. |
| [ACC:ACCOUNTS-F5](../../requirements/access/accounts.md#^acc-accounts-f5) | A new account's name from its provider, and `named`, in §4.2, and `PUT /api/auth/name`, in §4.5. |
| [ACC-F13](../../requirements/access/access.md#^acc-f13) | Each account's name, starting as its Google account's, and changed by its traveller (§4.2, §4.5). Asking for it is `web/screens`, and showing it on a trip is `access/membership`. |
| [ACC:ACCOUNTS-NFR1](../../requirements/access/accounts.md#^acc-accounts-nfr1) | Digests in place of sessions and nonces, and no password, in §4.3 and §5. |
| [WEB:SHELL-F5](../../requirements/web/shell.md#^web-shell-f5) | The `update-first` refusal, made before anything else, in §4.7. Sending the number, and updating, are `web/shell`. |
| [ACC-F1](../../requirements/access/access.md#^acc-f1) | Signing in with Google, and staying signed in (§4.2, §4.3). Showing the sign-in buttons is `web/screens`. |
| [ACC-NFR1](../../requirements/access/access.md#^acc-nfr1) | Naming, for certain, the account behind each request (§4.3). What that account may do is `access/permissions`. |

## 8. Open

- **A traveller with two Google accounts** has two Itinero accounts, each with its own trips.
  Joining them is future work.
