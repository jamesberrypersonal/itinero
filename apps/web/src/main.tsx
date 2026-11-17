// Opens Itinero: the shell starts first, before any screen shows a time (docs/spec/web/shell.md
// §4.2), then the app draws.

import * as tripTime from "@itinero/trip-time";
import { render } from "preact";
import * as places from "./places/index.ts";
import { App } from "./app.tsx";
import * as shell from "./shell/index.ts";
import "./styles.css";

/** True only in the versions the browser tests build (docs/spec/web/shell.md §4.5). */
declare const __ITINERO_TEST__: boolean;

if (__ITINERO_TEST__) {
  // The browser tests reach the shell, trip-time and the places through these, and play
  // web/trip-store's part.
  Object.assign(window, { itineroShell: shell, itineroTripTime: tripTime, itineroPlaces: places });
}

const root = document.getElementById("app")!;

shell.start().then(
  (state) => {
    // The timing tests read this mark: the time from opening to the shell being ready (§4.5).
    performance.mark("itinero-shell-ready");
    render(<App initial={state} />, root);
  },
  (error: unknown) => {
    console.error(error);
    root.textContent = "Itinero could not start. Close it, and open it again.";
  },
);

// web/trip-store tells the shell each time the device connects, from Milestone Web-1.3. Until it
// is built, the app does.
addEventListener("online", () => shell.online());
