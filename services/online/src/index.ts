// The Worker of Itinero's online side (docs/spec/access/accounts.md §2). Requests under /api/ come
// here, and every other path is the web app's, which Wrangler serves as static files
// (docs/spec/web/shell.md §4.6).

import { forgetExpired } from "./accounts.ts";
import { answer } from "./answer.ts";
import { closeExpired } from "./membership.ts";

/** The Durable Object that holds each trip (docs/spec/planner/trip-host.md §5). */
export { TripHost } from "./trip-host.ts";

export default {
  fetch: (request, _env, _ctx) => answer(request),
  scheduled: async (controller, _env, _ctx) => {
    await forgetExpired(controller.scheduledTime);
    await closeExpired(controller.scheduledTime);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
