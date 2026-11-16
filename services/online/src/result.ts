// Refusals and results, in the form shared/trip-time gives them (docs/spec/access/accounts.md
// §3.3), and the HTTP status each refusal code of the online side is given (§3.2).

export type Refusal = { code: string; message: string; details?: Record<string, string> };
export type Result<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

export function accept<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function refuse<T>(code: string, message: string): Result<T> {
  return { ok: false, refusal: { code, message } };
}

const STATUS: Record<string, number> = {
  // access/accounts (docs/spec/access/accounts.md §3.2)
  "bad-token": 401,
  "bad-nonce": 401,
  "bad-name": 400,
  "no-session": 401,
  "update-first": 426,
  malformed: 400,
  "not-found": 404,
};

/** The response a refusal is given: its status, and `{ code, message }`. */
export function refused(refusal: Refusal, headers: HeadersInit = {}): Response {
  return Response.json({ code: refusal.code, message: refusal.message }, { status: STATUS[refusal.code] ?? 400, headers });
}

/** A request's JSON body, or `malformed` where it is not a JSON object. */
export async function body(request: Request): Promise<Result<Record<string, unknown>>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return refuse("malformed", "The request's body is not JSON.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return refuse("malformed", "The request's body is not a JSON object.");
  }
  return accept(value as Record<string, unknown>);
}
