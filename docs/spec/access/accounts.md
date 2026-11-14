# The accounts component

**Assumes** [accounts.md](../../requirements/access/accounts.md) — what the accounts component promises, and the providers and sessions it works with.

## 1. Purpose

The accounts component is the part of Itinero's online side that holds each traveller's account,
signs a traveller in with Google or Apple, and names the account behind every request. Every other
check of a request, such as what a traveller may see, starts from the account it gives.

## 2. Scope

The accounts component covers accounts, signing in, sessions, and naming the account behind a
request.

Two things act on it:

- **The web app**, the system travellers use on a computer or a phone, signs a traveller in and
  out, and sends its session with every request (§3.2).
- **The component holding the copy of each trip online** passes it each request, and is given the
  account that sent it. That component is not yet registered.

Deliberately absent:

- what a traveller may see or change, which `access/permissions` decides
- who is on a trip, which `access/membership` holds
- joining a traveller's Google and Apple accounts into one
- signing in by any other means, or holding a password
- deleting an account

What Itinero's online side runs on, and so how the accounts component stores its records and serves
its requests, is not decided until TODO-12 is done. This specification gives the behaviour any such
platform must keep.

## 3. Interface

### 3.1 User interface

None. The web app shows the Google and Apple sign-in buttons each provider supplies, and a sign-out
command.

### 3.2 Application interface

The accounts component answers three requests over HTTPS, each with a JSON body. Every response
that refuses gives a status of 400 or 401, and a JSON body `{ "code": ..., "message": ... }`, whose
message is one English sentence the web app may show.

| Request | Body | Gives |
|---|---|---|
| `POST /auth/nonce` | None | `{ "nonce": ... }`: a single-use value for the next sign-in (§4.1) |
| `POST /auth/sign-in` | `{ "provider": "google" \| "apple", "idToken": ..., "nonce": ... }` | `{ "account": ..., "email": ... }`, and sets the session (§4.2) |
| `POST /auth/sign-out` | None | Nothing, and ends the session sent with it (§4.4) |

The session is set as a cookie named `itinero_session`, marked `Secure`, `HttpOnly` and
`SameSite=Lax`, so that a script on the page cannot read it. The web app sends it with every
request without handling it.

| Refusal code | Status | When |
|---|---|---|
| `bad-token` | 401 | An ID token whose signature, issuer, audience or expiry fails §4.2 |
| `bad-nonce` | 401 | A nonce the accounts component did not give, already used, or older than 10 minutes |
| `no-session` | 401 | A request with no session, or with one that has ended (§4.3) |
| `malformed` | 400 | A body not in the form above |

### 3.3 Programming interface

Inside the online side, the accounts component gives one function to the component holding the
copy of each trip online:

```ts
type AccountId = string;      // "u-" and 22 characters of base64url, unique and never reused
type Account = { id: AccountId; email: string; emailVerified: boolean };

function whoSent(request: { session?: string }): Promise<Result<Account>>;
function account(id: AccountId): Promise<Account | undefined>;
```

`whoSent` gives the account behind a request, or refuses it with `no-session` (`ACC:ACCOUNTS-F4`).
`account` gives an account by its identifier, as `access/membership` needs to match an invitation's
address. `Result` has the form `shared/trip-time` gives it: `{ ok: true, value }` or
`{ ok: false, refusal }`.

### 3.4 Systems this drives

The accounts component signs a traveller in through Google and Apple, using OpenID Connect, the
standard protocol by which a provider vouches for who a person is. Each provider's sign-in, in the
browser, gives the web app an ID token: a short-lived statement, signed by the provider, holding
these claims among others.

| Claim | Holds |
|---|---|
| `iss` | The issuer: `https://accounts.google.com` for Google, `https://appleid.apple.com` for Apple |
| `aud` | The audience: the client identifier Itinero registered with that provider |
| `sub` | The subject: the provider's own identifier for the person, which never changes |
| `email`, `email_verified` | The person's email address, and whether the provider has confirmed it is theirs |
| `exp` | When the token stops being valid |
| `nonce` | The single-use value the web app passed to the sign-in, which ties the token to it |

Each provider publishes the public keys it signs tokens with, as a JSON Web Key Set at a fixed
address: `https://www.googleapis.com/oauth2/v3/certs` for Google, and
`https://appleid.apple.com/auth/keys` for Apple. The accounts component fetches each set, keeps it
for the time its response allows, and fetches it again when a token names a key it does not hold.

Apple gives the `email` claim only at a person's first sign-in to Itinero, and may give an address
at `privaterelay.appleid.com` that forwards to the person's own. The provider documents of each,
Google Identity and Sign in with Apple, give the full flows.

## 4. Behaviour

Behaviour crossing every operation:

- **The server's clock is the only clock.** Every expiry is checked against the online side's own
  clock, never a device's.
- **Secrets are compared in constant time**, so that how long a comparison takes reveals nothing of
  the value held.

### 4.1 The nonce

*Porcelain:* `POST /auth/nonce` gives a nonce of 32 random bytes, written in base64url, and keeps a
SHA-256 digest of it with the time it was made. A sign-in naming it uses it up. A nonce not used
within 10 minutes is thrown away.

### 4.2 Signing in

*Porcelain:* `POST /auth/sign-in` accepts an ID token only when every check below passes
(`ACC:ACCOUNTS-F1`):

1. the nonce given is one the accounts component made, unused and under 10 minutes old, or the
   sign-in is refused with `bad-nonce`. It is used up whether or not the rest passes
2. the token's signature checks against a key of its provider's key set, or it is refused with
   `bad-token`
3. its `iss` is its provider's, its `aud` is Itinero's client identifier for that provider, its
   `exp` is not past, and its `nonce` equals the nonce given, or it is refused with `bad-token`

The account is then found by the pair of the provider and `sub`. Where no account holds the pair,
one is made, with a new identifier. Where the token holds an `email`, the account's address and
`emailVerified` are set from it (`ACC:ACCOUNTS-F2`). Where it holds none, as Apple's tokens after
the first sign-in, they are kept as they were. The address is kept in lower case.

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

*Porcelain:* `POST /auth/sign-out` forgets the session sent with it, and clears the cookie. Sessions
on the account's other devices are unchanged. Signing out with no session, or one already ended,
succeeds and does nothing.

### 4.5 The test suite

The suite runs the checks in the verification of each requirement the accounts component claims,
against a provider stand-in that signs ID tokens with a key of its own. It also checks each refusal
of §3.2, and that the stored records hold no session and no password. How the suite runs depends on
the platform, which is not decided until TODO-12 is done.

## 5. Resources

The accounts component stores three kinds of record. What holds them is not decided
until TODO-12 is done.

| Record | Holds | Kept |
|---|---|---|
| Account | Its identifier, its provider, the provider's `sub`, its email address, `emailVerified`, and when it was made | For as long as Itinero runs. Deleting an account is future work |
| Session | The SHA-256 digest of the session, its account, and when it was last used | Until signed out, or 180 days unused |
| Nonce | The SHA-256 digest of the nonce, and when it was made | Until used, or 10 minutes old |

The pair of the provider and `sub` is unique across accounts. Itinero's client identifier for each
provider, and Apple's signing key for its client secret, are configuration held by the online side,
never in the repository.

| Resource | Owned by |
|---|---|
| The client identifiers registered with Google and with Apple | Whoever keeps the access system's roadmap |
| The stored records | Whoever keeps the access system's roadmap |

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
| [ACC:ACCOUNTS-NFR1](../../requirements/access/accounts.md#^acc-accounts-nfr1) | Digests in place of sessions and nonces, and no password, in §4.3 and §5. |
| [ACC-F1](../../requirements/access/access.md#^acc-f1) | Signing in with Google or Apple, and staying signed in (§4.2, §4.3). Showing the sign-in buttons is the web app, whose specification is not yet written. |
| [ACC-NFR1](../../requirements/access/access.md#^acc-nfr1) | Naming, for certain, the account behind each request (§4.3). What that account may do is `access/permissions`. |

## 8. Open

- **What the accounts component runs on.** Its records, and the service answering §3.2, depend on
  the platform chosen for Itinero's online side. It is not decided until TODO-12 is done.
- **A traveller who signs in with Google and then with Apple** has two accounts, each with its own
  trips. Joining them is future work.
