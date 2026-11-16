// A request the Worker answers: its method and path, whether it needs a session, and the answer.

import type { Account } from "./accounts.ts";

/** A request from a signed-in device: the account behind it, and the headers to answer with. */
export type SignedIn = { account: Account; headers: Headers };

export type Route = {
  method: string;
  path: RegExp;
  /** Whether the request needs a session. */
  signedIn: boolean;
  answer: (request: Request, match: RegExpMatchArray, by: SignedIn | undefined) => Promise<Response>;
};
