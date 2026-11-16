// Runs the online side's test suite inside workerd, with the Worker's Wrangler configuration, a
// local D1 database, and test values for its variables and secrets (docs/spec/access/accounts.md
// §4.6). Google is replaced by a stand-in that signs ID tokens with a key of its own.

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          GOOGLE_CLIENT_ID: "itinero-test.apps.googleusercontent.com",
          NONCE_KEY: "dGhpcy1pcy1hLXRlc3Qta2V5LW9mLTMyLWJ5dGVzLiE",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
});
