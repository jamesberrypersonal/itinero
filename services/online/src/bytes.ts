// Random values, digests and base64url, shared by every component of the online side.

export function randomBytes(count: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(count));
}

export function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The bytes a base64url text holds, or undefined where it is not base64url. */
export function fromBase64url(text: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return undefined;
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** A value of `bytes` random bytes, in base64url. */
export function randomToken(bytes: number): string {
  return toBase64url(randomBytes(bytes));
}

/** The SHA-256 digest of a text, in hexadecimal, as sessions, nonces and tokens are kept. */
export async function digest(text: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The number of Unicode code points in a text. */
export function codePoints(text: string): number {
  let count = 0;
  for (const _ of text) count++;
  return count;
}
