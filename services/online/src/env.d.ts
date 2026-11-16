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
  }
}
