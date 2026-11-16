// The requests access/membership answers (docs/spec/access/membership.md §3.2). Each needs a
// session, which access/accounts checks before the request reaches it.

import { acceptInvitation, invite, listMembers, makeAdmin, removeMember, withdraw } from "./membership.ts";
import { body, refused, type Result } from "./result.ts";
import type { Route, SignedIn } from "./route.ts";

const SEGMENT = "([^/]+)";

function reply<T>(result: Result<T>, by: SignedIn, status = 200): Response {
  if (!result.ok) return refused(result.refusal, by.headers);
  if (result.value === undefined) return new Response(null, { status: 204, headers: by.headers });
  return Response.json(result.value, { status, headers: by.headers });
}

const part = (match: RegExpMatchArray, n: number) => decodeURIComponent(match[n]!);

export const membershipRoutes: Route[] = [
  {
    method: "GET",
    path: new RegExp(`^/api/trips/${SEGMENT}/members$`),
    signedIn: true,
    answer: async (_, match, by) => reply(await listMembers(part(match, 1), by!.account), by!),
  },
  {
    method: "POST",
    path: new RegExp(`^/api/trips/${SEGMENT}/invitations$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const read = await body(request);
      if (!read.ok) return refused(read.refusal, by!.headers);
      return reply(await invite(part(match, 1), by!.account, read.value, new URL(request.url).origin), by!, 201);
    },
  },
  {
    method: "DELETE",
    path: new RegExp(`^/api/trips/${SEGMENT}/invitations/${SEGMENT}$`),
    signedIn: true,
    answer: async (_, match, by) => reply(await withdraw(part(match, 1), by!.account, part(match, 2)), by!),
  },
  {
    method: "POST",
    path: new RegExp(`^/api/invitations/${SEGMENT}/accept$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const read = await body(request);
      if (!read.ok) return refused(read.refusal, by!.headers);
      return reply(await acceptInvitation(part(match, 1), by!.account, read.value.token), by!);
    },
  },
  {
    method: "POST",
    path: new RegExp(`^/api/trips/${SEGMENT}/admins$`),
    signedIn: true,
    answer: async (request, match, by) => {
      const read = await body(request);
      if (!read.ok) return refused(read.refusal, by!.headers);
      return reply(await makeAdmin(part(match, 1), by!.account, read.value.account), by!);
    },
  },
  {
    method: "DELETE",
    path: new RegExp(`^/api/trips/${SEGMENT}/members/${SEGMENT}$`),
    signedIn: true,
    answer: async (_, match, by) => reply(await removeMember(part(match, 1), by!.account, part(match, 2)), by!),
  },
];
