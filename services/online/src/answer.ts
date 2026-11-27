// How the online side answers a request. It checks the version of the web app behind each request
// (docs/spec/access/accounts.md §4.7), then passes the request to the component that answers it.
// The Worker's own module, index.ts, exports nothing else, since the Workers runtime reads each of
// its named exports as an entrypoint.

import { env } from "cloudflare:workers";
import { authenticate, makeNonce, setName, signIn, signOut } from "./accounts.ts";
import { body, refused, type Refusal } from "./result.ts";
import { libraryRoutes } from "./library-routes.ts";
import { membershipRoutes } from "./membership-routes.ts";
import { connectMembership, tripRoutes } from "./trip-routes.ts";
import type { Route } from "./route.ts";
import { clearSession, sessionOf, setSession } from "./session.ts";

/** The oldest number in `Itinero-Api` the online side answers (§4.7). It changes only with a deploy. */
export const OLDEST_API = 2;

const accountRoutes: Route[] = [
  {
    method: "POST",
    path: /^\/api\/auth\/nonce$/,
    signedIn: false,
    // The nonce comes with Itinero's client identifier at Google, which the sign-in screen draws
    // Google's button with, so the Worker's variable is its one source (§3.2).
    answer: async () => Response.json({ nonce: await makeNonce(), google: env.GOOGLE_CLIENT_ID }),
  },
  {
    method: "POST",
    path: /^\/api\/auth\/sign-in$/,
    signedIn: false,
    answer: async (request) => {
      const read = await body(request);
      if (!read.ok) return refused(read.refusal);
      const { provider, idToken, nonce } = read.value;
      const result = await signIn(provider, idToken, nonce);
      if (!result.ok) return refused(result.refusal);
      const { account, session } = result.value;
      return Response.json(
        { account: account.id, email: account.email, name: account.name, named: account.named },
        { headers: { "Set-Cookie": setSession(session) } },
      );
    },
  },
  {
    method: "PUT",
    path: /^\/api\/auth\/name$/,
    signedIn: true,
    answer: async (request, _, by) => {
      const read = await body(request);
      if (!read.ok) return refused(read.refusal, by!.headers);
      const result = await setName(by!.account.id, read.value.name);
      if (!result.ok) return refused(result.refusal, by!.headers);
      return Response.json({ name: result.value }, { headers: by!.headers });
    },
  },
  {
    method: "POST",
    path: /^\/api\/auth\/sign-out$/,
    signedIn: false,
    answer: async (request) => {
      await signOut(sessionOf(request));
      return new Response(null, { status: 204, headers: { "Set-Cookie": clearSession() } });
    },
  },
];

function refusal(code: string, message: string): Refusal {
  return { code, message };
}

const routes: Route[] = [...accountRoutes, ...tripRoutes, ...membershipRoutes, ...libraryRoutes];

// access/membership hands each change of a trip's members to the trip host.
connectMembership();

/** Whether a request carries a version of the web app the online side answers (§4.7). */
function versionAnswered(request: Request): boolean {
  // A browser lets no page add a header to the request that opens a WebSocket.
  if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") return true;
  const api = request.headers.get("Itinero-Api");
  // A test of the web app's update raises the oldest it answers, as a deploy would (env.d.ts).
  const oldest = env.OLDEST_API ? Number(env.OLDEST_API) : OLDEST_API;
  return api !== null && /^[0-9]{1,9}$/.test(api) && Number(api) >= oldest;
}

export async function answer(request: Request): Promise<Response> {
  try {
    return await route(request);
  } catch (error) {
    console.error(error);
    return Response.json({ code: "failed", message: "Something went wrong on Itinero's side. Try again." }, { status: 500 });
  }
}

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) {
    return refused(refusal("not-found", "Nothing is here."));
  }
  if (!versionAnswered(request)) {
    return refused(refusal("update-first", "This version of Itinero is too old. Update it, and try again."));
  }
  for (const route of routes) {
    const match = url.pathname.match(route.path);
    if (!match || route.method !== request.method) continue;
    if (!route.signedIn) return route.answer(request, match, undefined);
    const who = await authenticate(sessionOf(request));
    if (!who.ok) return refused(who.refusal);
    const headers = new Headers();
    if (who.value.renewed) headers.set("Set-Cookie", setSession(sessionOf(request)!));
    return route.answer(request, match, { account: who.value.account, headers });
  }
  return refused(refusal("not-found", "The online side answers no such request."));
}
