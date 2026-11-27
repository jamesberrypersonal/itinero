// A stand-in for the online side, for the browser tests (docs/spec/web/shell.md §4.5). It serves a
// built version as the Worker's Wrangler configuration does (§4.6): each file it holds, and
// index.html for any other path outside /api/. Under /api/ it answers as the Worker does to the
// version behind each request (spec/access/accounts.md §4.7), refusing an `Itinero-Api` lower than
// the oldest it answers with `update-first`.
//
// A test publishes a new version, newer rules, or a new oldest number, as a deploy would.

import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};

export type Online = {
  url: string;
  /** Deploys the version built in `dir`, with the oldest `Itinero-Api` the online side answers. */
  publish(dir: string, oldestApi?: number): void;
  /** Deploys newer rules beside the version already served, as `npm run build-rules` does. */
  publishRules(file: string): void;
  /** Deploys one file beside the version already served, such as a newer list of places. */
  publishFile(path: string, file: string): void;
  /**
   * Makes the online side unreachable, or reachable again. Taking a browser offline does not stop
   * the browser's own checks for a new service worker in every engine, so the tests do both.
   */
  reachable(yes: boolean): void;
  /** Every path requested, in order. */
  requests: string[];
  close(): Promise<void>;
};

export async function startOnline(dir: string): Promise<Online> {
  let served = dir;
  let oldestApi = 2;
  let published = new Map<string, string>();
  let up = true;
  const requests: string[] = [];

  const server: Server = createServer(async (request, response) => {
    if (!up) {
      request.socket.destroy();
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    requests.push(url.pathname);
    if (url.pathname.startsWith("/api/")) {
      const api = request.headers["itinero-api"];
      const answered = typeof api === "string" && /^[0-9]{1,9}$/.test(api) && Number(api) >= oldestApi;
      response.writeHead(answered ? 200 : 426, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(
        JSON.stringify(
          answered ? { ok: true } : { code: "update-first", message: "This version of Itinero is too old. Update it, and try again." },
        ),
      );
      return;
    }
    const file = published.get(url.pathname);
    if (file !== undefined) {
      response.writeHead(200, { "Content-Type": TYPES[".json"]!, "Cache-Control": "no-cache" });
      response.end(file);
      return;
    }
    const path = normalize(join(served, decodeURIComponent(url.pathname)));
    const found = path.startsWith(served) && (await isFile(path)) ? path : join(served, "index.html");
    response.writeHead(200, {
      "Content-Type": TYPES[extname(found)] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=0, must-revalidate",
    });
    response.end(await readFile(found));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    // localhost, not 127.0.0.1: every engine treats it as a secure origin, as service workers need.
    url: `http://localhost:${port}`,
    publish(next, oldest = 2) {
      served = next;
      oldestApi = oldest;
      published = new Map();
    },
    publishRules(file) {
      published.set("/time-zone-rules.json", file);
    },
    publishFile(path, file) {
      published.set(path, file);
    },
    reachable(yes) {
      up = yes;
      if (!yes) server.closeAllConnections();
    },
    requests,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
