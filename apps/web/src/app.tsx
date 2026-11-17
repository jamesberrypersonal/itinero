// The web app's frame. web/screens draws every screen in it from Milestone Web-1.4, and places the
// shell's notices on them (docs/spec/web/screens.md §4). Until then, every address shows this one
// screen, with the shell's notices, so that the shell can be used and tested on its own.

import { InstallSuggestion, ReadyOffline, UpdateRequired, useShell } from "./shell/notices.tsx";
import type { ShellState } from "./shell/index.ts";

export function App({ initial }: { initial: ShellState }) {
  const state = useShell(initial);
  return (
    <div class="app">
      <UpdateRequired state={state} />
      <main class="screen" data-screen="start">
        <h1 class="title">Itinero</h1>
        <p class="lead">Plan a trip day by day, keep its bookings, and read it with no connection.</p>
        <InstallSuggestion state={state} />
        <ReadyOffline state={state} />
      </main>
      <footer class="about" data-shell="about">
        Version <span data-shell="version">{state.version}</span> · time zones{" "}
        <span data-shell="rules-version">{state.rulesVersion}</span>
      </footer>
    </div>
  );
}
