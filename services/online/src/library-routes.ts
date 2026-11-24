// The requests planner/library answers (docs/spec/planner/library.md §3.2). Each needs a session,
// which access/accounts checks before the request reaches it, and works on that account's library
// alone.

import { addTemplate, changeTemplate, deleteTemplate, sync } from "./library.ts";
import { body, type Refusal, type Result } from "./result.ts";
import type { Route, SignedIn } from "./route.ts";

/** A refusal's status (§3.2). Every refusal from planner/checklists but `malformed` is 409. */
function status(code: string): number {
  if (code === "malformed") return 400;
  if (code === "unknown-template") return 404;
  if (code === "not-yours") return 403;
  return 409;
}

function refusedHere(refusal: Refusal, by: SignedIn): Response {
  return Response.json({ code: refusal.code, message: refusal.message }, { status: status(refusal.code), headers: by.headers });
}

function reply<T>(result: Result<T>, by: SignedIn, ok = 200): Response {
  if (!result.ok) return refusedHere(result.refusal, by);
  return Response.json(result.value, { status: ok, headers: by.headers });
}

async function read(request: Request, by: SignedIn): Promise<Record<string, unknown> | Response> {
  const read = await body(request);
  return read.ok ? read.value : refusedHere(read.refusal, by);
}

export const libraryRoutes: Route[] = [
  {
    method: "POST",
    path: /^\/api\/library\/sync$/,
    signedIn: true,
    answer: async (request, _, by) => {
      const value = await read(request, by!);
      if (value instanceof Response) return value;
      const { since } = value;
      if (since !== undefined && (typeof since !== "number" || !Number.isInteger(since) || since < 0)) {
        return refusedHere({ code: "malformed", message: "A catch-up gives the sequence it holds, if any." }, by!);
      }
      return Response.json(await sync(by!.account.id, since as number | undefined), { headers: by!.headers });
    },
  },
  {
    method: "POST",
    path: /^\/api\/library\/templates$/,
    signedIn: true,
    answer: async (request, _, by) => {
      const value = await read(request, by!);
      if (value instanceof Response) return value;
      return reply(await addTemplate(by!.account.id, value), by!, 201);
    },
  },
  {
    method: "POST",
    path: /^\/api\/library\/changes$/,
    signedIn: true,
    answer: async (request, _, by) => {
      const value = await read(request, by!);
      if (value instanceof Response) return value;
      return reply(await changeTemplate(by!.account.id, value), by!);
    },
  },
  {
    method: "DELETE",
    path: /^\/api\/library\/templates\/([^/]+)$/,
    signedIn: true,
    answer: async (_, match, by) => reply(await deleteTemplate(by!.account.id, decodeURIComponent(match[1]!)), by!),
  },
];
