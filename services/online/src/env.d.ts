// The bindings of the Worker of the online side (docs/spec/access/accounts.md §5), as
// `import { env } from "cloudflare:workers"` gives them.

declare namespace Cloudflare {
  interface Env {
    /** The online side's D1 database, holding accounts and membership. */
    DB: D1Database;
    /** Itinero's client identifier at Google, which is public. */
    GOOGLE_CLIENT_ID: string;
    /** 32 random bytes in base64url, a secret of the Worker, that nonces are made with. */
    NONCE_KEY: string;
    /** The key Itinero sends emails through Resend with, a secret of the Worker. */
    RESEND_API_KEY: string;
    /** The address invitations are sent from, at Itinero's own domain. */
    INVITATIONS_FROM: string;
    /**
     * Unset in every deploy. The web app's browser tests point it at a stand-in for Google's key
     * set, so that a test signs in with ID tokens of its own (docs/spec/web/screens.md §4.9).
     */
    GOOGLE_KEYS_URL?: string;
    /** Unset in every deploy. The browser tests point it at a stand-in for Resend that keeps each email. */
    RESEND_URL?: string;
    /** Unset in every deploy, which raises OLDEST_API in the code. The browser tests raise it here, as a deploy would. */
    OLDEST_API?: string;
    /** Unset in every deploy. `yes` leaves Secure off the session cookie, for the browser tests over plain HTTP. */
    SESSION_COOKIE_INSECURE?: string;
    /** The Durable Objects that each hold one trip (docs/spec/planner/trip-host.md §5). */
    TRIPS: DurableObjectNamespace<import("./trip-host.ts").TripHost>;
  }
}
