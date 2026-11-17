// Stand-ins for the services outside Itinero that the online side calls, for the screens' browser
// tests (docs/spec/web/screens.md §4.9): Google's key set, so that a test signs travellers in with
// ID tokens of its own, and Resend, which keeps each email sent. Wrangler points the Worker at both
// with GOOGLE_KEYS_URL and RESEND_URL.

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export const CLIENT_ID = "itinero-test.apps.googleusercontent.com";

const pair = (await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
)) as CryptoKeyPair;
const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
const kid = crypto.randomUUID();

const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

export type Person = { sub: string; email: string; name: string };

/** An ID token Google's stand-in signs for a person and a nonce. */
export async function idToken(person: Person, nonce: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: "https://accounts.google.com", aud: CLIENT_ID, sub: person.sub, iat: now, exp: now + 3600, nonce, email: person.email, email_verified: true, name: person.name };
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const signed = `${encode({ alg: "RS256", kid, typ: "JWT" })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(signed));
  return `${signed}.${base64url(new Uint8Array(signature))}`;
}

export type Email = { to: string[]; subject: string; text: string };
export type Outside = { url: string; emails: Email[]; close(): Promise<void> };

export async function startOutside(): Promise<Outside> {
  const emails: Email[] = [];
  const server: Server = createServer((request, response) => {
    if (request.url === "/keys") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
      response.end(JSON.stringify({ keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }] }));
      return;
    }
    if (request.url === "/emails" && request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        emails.push(JSON.parse(body) as Email);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ id: crypto.randomUUID() }));
      });
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    emails,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** The invitation link in the latest email to an address. */
export function invitationTo(outside: Outside, address: string): string {
  const email = [...outside.emails].reverse().find((e) => e.to.includes(address));
  if (!email) throw new Error(`No email was sent to ${address}`);
  const link = /https?:\/\/[^\s]+\/invitations\/[^\s]+/.exec(email.text);
  if (!link) throw new Error("The email holds no invitation link");
  return new URL(link[0]).pathname + new URL(link[0]).hash;
}
