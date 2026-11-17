// Opens Itinero: the shell starts first, before any screen shows a time (docs/spec/web/shell.md
// §4.2), then the app draws.

import * as itinerary from "@itinero/itinerary";
import * as pages from "@itinero/pages";
import * as permissions from "@itinero/permissions";
import * as tripTime from "@itinero/trip-time";
import { render } from "preact";
import * as places from "./places/index.ts";
import * as store from "./store/index.ts";
import { App } from "./app.tsx";
import * as shell from "./shell/index.ts";
import "./styles.css";

/** True only in the versions the browser tests build (docs/spec/web/shell.md §4.5). */
declare const __ITINERO_TEST__: boolean;

if (__ITINERO_TEST__) {
  // The browser tests reach the shell, the places, the trip store and the packages through these.
  Object.assign(window, {
    itineroShell: shell,
    itineroTripTime: tripTime,
    itineroPlaces: places,
    itineroStore: store,
    itineroPackages: { itinerary, pages, permissions },
  });
}

const root = document.getElementById("app")!;

shell.start().then(
  (state) => {
    // The timing tests read this mark: the time from opening to the shell being ready (§4.5).
    performance.mark("itinero-shell-ready");
    render(<App initial={state} />, root);
    // The trip store opens once the rules are loaded, and the places follow the trips it holds.
    void store.open().then(() => places.startPlaces(store));
  },
  (error: unknown) => {
    console.error(error);
    root.textContent = "Itinero could not start. Close it, and open it again.";
  },
);
