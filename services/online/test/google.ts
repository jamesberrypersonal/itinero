// A stand-in for Google (docs/spec/access/accounts.md §4.6). It signs ID tokens with a key of its
// own, and answers the Worker's fetch of Google's key set with that key's public half.

import { vi } from "vitest";
import { toBase64url } from "../src/bytes.ts";
import { GOOGLE_KEYS } from "../src/google.ts";

export const CLIENT_ID = "itinero-test.apps.googleusercontent.com";

type Signer = { kid: string; privateKey: CryptoKey; publicJwk: JsonWebKey };

async function newSigner(): Promise<Signer> {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { kid: crypto.randomUUID(), privateKey: pair.privateKey, publicJwk };
}

/** The stand-in's own key, which its key set holds. */
export const google = await newSigner();
/** A key Google's key set does not hold. */
export const stranger = await newSigner();

/** How many times the Worker has fetched the key set. */
export let keyFetches = 0;

const realFetch = globalThis.fetch;
vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === GOOGLE_KEYS) {
    keyFetches++;
    const keys = [{ ...google.publicJwk, kid: google.kid, alg: "RS256", use: "sig" }];
    return Response.json({ keys }, { headers: { "Cache-Control": "public, max-age=3600" } });
  }
  return realFetch(input, init);
});

/** A person with an account at Google. */
export type Person = { sub: string; email?: string; emailVerified?: boolean; name?: string };

export type TokenOptions = {
  signer?: Signer;
  /** The `kid` the header names, if not the signer's own. */
  kid?: string;
  iss?: string;
  aud?: string;
  /** Seconds from now until it expires. */
  expiresIn?: number;
};

/** An ID token the stand-in signs for a person and a nonce. */
export async function idToken(person: Person, nonce: string, options: TokenOptions = {}): Promise<string> {
  const signer = options.signer ?? google;
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    iss: options.iss ?? "https://accounts.google.com",
    aud: options.aud ?? CLIENT_ID,
    sub: person.sub,
    iat: now,
    exp: now + (options.expiresIn ?? 3600),
    nonce,
  };
  if (person.email !== undefined) {
    claims.email = person.email;
    claims.email_verified = person.emailVerified ?? true;
  }
  if (person.name !== undefined) claims.name = person.name;
  const encode = (value: unknown) => toBase64url(new TextEncoder().encode(JSON.stringify(value)));
  const signed = `${encode({ alg: "RS256", kid: options.kid ?? signer.kid, typ: "JWT" })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signer.privateKey, new TextEncoder().encode(signed));
  return `${signed}.${toBase64url(new Uint8Array(signature))}`;
}
