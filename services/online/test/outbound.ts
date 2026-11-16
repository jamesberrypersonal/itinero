// Answers the Worker's requests to Google and Resend with their stand-ins.

import { vi } from "vitest";
import { RESEND_EMAILS } from "../src/email.ts";
import { GOOGLE_KEYS } from "../src/google.ts";
import { keySet } from "./google.ts";
import { emails } from "./resend.ts";

const realFetch = globalThis.fetch;
vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
  const request = new Request(input, init);
  if (request.url === GOOGLE_KEYS) return keySet();
  if (request.url === RESEND_EMAILS && request.method === "POST") return emails(request);
  return realFetch(input, init);
});
