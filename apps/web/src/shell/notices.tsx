// The three things the shell shows of its own, which web/screens places (docs/spec/web/shell.md
// §3.1): that Itinero is ready offline, how to add it to an iPhone's home screen, and that a new
// version is required.

import { useEffect, useState } from "preact/hooks";
import { applyUpdate, current, onChange, type ShellState } from "./index.ts";

/** The shell's state, kept up to date as it changes. */
export function useShell(initial: ShellState): ShellState {
  const [state, setState] = useState(initial);
  useEffect(() => {
    // The state may have changed between start resolving and this first subscribing.
    setState(current() ?? initial);
    return onChange(setState);
  }, []);
  return state;
}

/** Shown once the service worker holds every file of the version (`WEB:SHELL-F1`). */
export function ReadyOffline({ state }: { state: ShellState }) {
  if (!state.offlineReady) return null;
  return (
    <p class="shell-ready" role="status" data-shell="ready-offline">
      <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Ready to use offline
    </p>
  );
}

/** Shown on an iPhone or an iPad not opened from the home screen (`WEB:SHELL-F3`, §4.3). */
export function InstallSuggestion({ state }: { state: ShellState }) {
  if (!state.suggestInstall) return null;
  return (
    <aside class="shell-card" data-shell="suggest-install" aria-labelledby="shell-install-title">
      <img class="shell-card-icon" src="/icons/apple-touch-icon.png" alt="" width="44" height="44" />
      <div>
        <h2 id="shell-install-title">Add Itinero to your Home Screen</h2>
        <p>
          Tap <ShareGlyph /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Your trips then stay
          on this phone, even when it goes unused for some days.
        </p>
      </div>
    </aside>
  );
}

/** Shown once the online side refuses the version running (`WEB:SHELL-F5`, §4.7). */
export function UpdateRequired({ state }: { state: ShellState }) {
  if (!state.updateRequired) return null;
  return (
    <div class="shell-update" role="alert" data-shell="update-required">
      <p>
        <strong>Itinero needs a new version before it can reach your trips.</strong> Copy any text you are writing
        somewhere safe first: updating reloads every window of Itinero.
      </p>
      {state.updateWaiting ? (
        <button type="button" class="shell-button" onClick={applyUpdate}>
          Update now
        </button>
      ) : (
        <p class="shell-update-fetching">Fetching the new version…</p>
      )}
    </div>
  );
}

/** Safari's Share symbol: a square with an arrow rising out of it. */
function ShareGlyph() {
  return (
    <svg class="shell-glyph" aria-hidden="true" viewBox="0 0 16 20" width="13" height="16">
      <path
        d="M8 1v11M4.5 4.5L8 1l3.5 3.5M5 8H2.5v10.5h11V8H11"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
