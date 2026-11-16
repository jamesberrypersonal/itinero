// Shared by the online side's tests: requests to the Worker, and signing in through the stand-in.

import { env } from "cloudflare:test";
import { expect } from "vitest";
import { answer } from "../src/index.ts";
import { idToken, type Person, type TokenOptions } from "./google.ts";

export const ORIGIN = "https://itinero.test";

export type Call = { method?: string; body?: unknown; session?: string; headers?: Record<string, string> };

/** Sends a request to the Worker, as the web app of the current version would. */
export async function api(path: string, call: Call = {}): Promise<Response> {
  const headers = new Headers({ "Itinero-Api": "1", ...call.headers });
  if (call.session !== undefined) headers.set("Cookie", `itinero_session=${call.session}`);
  const init: RequestInit = { method: call.method ?? "GET", headers };
  if (call.body !== undefined) {
    init.body = typeof call.body === "string" ? call.body : JSON.stringify(call.body);
    headers.set("Content-Type", "application/json");
  }
  return answer(new Request(`${ORIGIN}${path}`, init));
}

/** The JSON body of a response. */
export async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Confirms a response is a refusal, with its status and code, and gives its message. */
export async function expectRefused(response: Response, status: number, code: string): Promise<string> {
  const refusal = await json<{ code: string; message: string }>(response);
  expect({ status: response.status, code: refusal.code }).toEqual({ status, code });
  expect(refusal.message).toMatch(/^[A-Z].*\.$/);
  return refusal.message;
}

export async function nonce(): Promise<string> {
  return (await json<{ nonce: string }>(await api("/api/auth/nonce", { method: "POST" }))).nonce;
}

/** The session a response sets as its cookie. */
export function sessionSet(response: Response): string {
  const match = /itinero_session=([^;]*)/.exec(response.headers.get("Set-Cookie") ?? "");
  expect(match, "a session cookie is set").not.toBeNull();
  return match![1]!;
}

export type SignedIn = { account: string; email: string; name: string; named: boolean; session: string };

/** Signs a person in through the stand-in, which must be accepted. */
export async function signIn(person: Person, options: TokenOptions = {}): Promise<SignedIn> {
  const n = await nonce();
  const response = await api("/api/auth/sign-in", { method: "POST", body: { provider: "google", idToken: await idToken(person, n, options), nonce: n } });
  expect(response.status).toBe(200);
  return { ...(await json<Omit<SignedIn, "session">>(response)), session: sessionSet(response) };
}

/** Counts the rows of a table. */
export async function rows(table: string): Promise<number> {
  return (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
}
