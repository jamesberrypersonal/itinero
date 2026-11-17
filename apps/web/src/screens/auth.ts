// The only requests the screens send themselves: signing in, and choosing a name
// (docs/spec/web/screens.md §2, §4.1, §4.8). Every other goes through web/trip-store.

import { API, API_HEADER, updateFirst } from "../shell/index.ts";
import * as store from "../store/index.ts";
import type { Result } from "../store/index.ts";

/**
 * Set while a traveller has signed in and not yet chosen their name, so the next opening asks
 * again (§4.1). It holds the name their Google account gave, which the name starts as.
 */
const NAME_OWED = "itinero-name-owed";

async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  const headers: Record<string, string> = { [API_HEADER]: String(API) };
  const init: RequestInit = { method, headers, credentials: "same-origin" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    return { ok: false, refusal: { code: "offline", message: "This device has no connection. Connect it, and try again." } };
  }
  const answer = (await response.json().catch(() => ({}))) as T & { code?: string; message?: string };
  if (response.ok) return { ok: true, value: answer };
  if (answer.code === "update-first") updateFirst();
  return { ok: false, refusal: { code: answer.code ?? "failed", message: answer.message ?? "Something went wrong. Try again." } };
}

/** A nonce for the next sign-in, and Itinero's client identifier at Google. */
export function nonce(): Promise<Result<{ nonce: string; google: string }>> {
  return request("POST", "/api/auth/nonce");
}

export type SignedIn = { account: string; email: string; name: string; named: boolean };

/** Sends Google's ID token, and records the account with the trip store once it is signed in. */
export async function signIn(idToken: string, nonce: string): Promise<Result<SignedIn>> {
  const result = await request<SignedIn>("POST", "/api/auth/sign-in", { provider: "google", idToken, nonce });
  if (!result.ok) return result;
  setNameOwed(result.value.named ? undefined : result.value.name);
  await store.signedIn(result.value.account);
  return result;
}

/** Sets the name other travellers see, and brings it to every trip's members (§4.8). */
export async function setName(name: string): Promise<Result<{ name: string }>> {
  const result = await request<{ name: string }>("PUT", "/api/auth/name", { name });
  if (result.ok) {
    setNameOwed(undefined);
    await store.catchUpAll();
  }
  return result;
}

/** Forgets the name owed, which holds a traveller's name, on signing out. */
export function forgetNameOwed(): void {
  setNameOwed(undefined);
}

/** The name a traveller who has not chosen one starts from, or undefined once they have. */
export function nameOwed(): string | undefined {
  try {
    return localStorage.getItem(NAME_OWED) ?? undefined;
  } catch {
    return undefined;
  }
}

function setNameOwed(given: string | undefined): void {
  try {
    if (given !== undefined) localStorage.setItem(NAME_OWED, given);
    else localStorage.removeItem(NAME_OWED);
  } catch {
    // Not kept: the traveller is asked only in this window.
  }
}
