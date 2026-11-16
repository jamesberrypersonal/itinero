// The bindings the test suite adds to the Worker's own (vitest.config.ts).

declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
