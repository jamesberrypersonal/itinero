// The online side itself, run by Wrangler on this machine, for the browser tests that need it
// (docs/spec/web/trip-store.md §4.7). It serves a version the tests built, and holds accounts and
// sessions seeded straight into its local D1 database, so no test signs in through Google.

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { appRoot } from "./versions.ts";

const online = join(appRoot, "..", "..", "services", "online");

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });
}

export type Account = { id: string; name: string; email: string };
export type Wrangler = {
  url: string;
  session(account: Account): string;
  /** Deploys another version: the Worker starts again on the same port, with the same records. */
  publish(assets: string, vars?: Record<string, string>): Promise<void>;
  stop(): Promise<void>;
};

const wrangler = (args: string[]) => execFileSync("npx", ["wrangler", ...args], { cwd: online, stdio: "pipe" });

/** Starts the Worker on a port of its own, serving `assets`, with the accounts given. */
export async function startWrangler(assets: string, accounts: Account[], name: string, vars: Record<string, string> = {}): Promise<Wrangler> {
  const state = join(appRoot, "test-results", `wrangler-${name}-${process.pid}`);
  rmSync(state, { recursive: true, force: true });
  mkdirSync(state, { recursive: true });
  wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", state]);

  let count = 0;
  const sessions: string[] = [];
  const tokens = new Map<string, string[]>();
  const statements = accounts.map(
    (a) => `INSERT INTO accounts (id, provider, sub, email, email_verified, name, named, made) VALUES ('${a.id}', 'google', '${a.id}', '${a.email}', 1, '${a.name}', 1, 0);`,
  );
  // Five sessions for each account: one for each device a test opens.
  for (const account of accounts) {
    const own: string[] = [];
    for (let i = 0; i < 5; i++) {
      const token = `token-${account.id}-${i}-${process.pid}`;
      own.push(token);
      const digest = createHash("sha256").update(token).digest("hex");
      statements.push(`INSERT INTO sessions (digest, account, last_used) VALUES ('${digest}', '${account.id}', ${Date.now()});`);
    }
    tokens.set(account.id, own);
  }
  if (statements.length) wrangler(["d1", "execute", "DB", "--local", "--persist-to", state, "--command", statements.join(" ")]);

  const port = await freePort();
  const inspector = await freePort();
  const start = (served: string, more: Record<string, string> = {}): ChildProcess =>
    spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--port",
      String(port),
      "--inspector-port",
      String(inspector),
      "--persist-to",
      state,
      "--assets",
      served,
      "--var",
      "NONCE_KEY:dGhpcy1pcy1hLXRlc3Qta2V5LW9mLTMyLWJ5dGVzLiE",
      ...Object.entries({ ...vars, ...more }).flatMap(([key, value]) => ["--var", `${key}:${value}`]),
      "--log-level",
      "error",
    ],
    { cwd: online, stdio: "ignore", detached: true },
  );
  const url = `http://localhost:${port}`;
  const listening = async () => {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(url)).ok) return;
      } catch {
        // Not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  };
  const kill = async (process_: ChildProcess) => {
    try {
      process.kill(-process_.pid!, "SIGTERM");
    } catch {
      // Stopped already.
    }
    for (let i = 0; i < 40; i++) {
      try {
        await fetch(url);
      } catch {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };
  let child = start(assets);
  await listening();
  return {
    url,
    session(account) {
      const token = tokens.get(account.id)![count++ % 5]!;
      sessions.push(token);
      return token;
    },
    async publish(next, more = {}) {
      await kill(child);
      child = start(next, more);
      await listening();
    },
    async stop() {
      await kill(child);
      rmSync(state, { recursive: true, force: true });
    },
  };
}
