// Signing in with Google, choosing a name, and accepting an invitation
// (docs/spec/web/screens.md §4.1, §4.7, WEB:SCREENS-F9, WEB:SCREENS-F10).

import { useEffect, useRef, useState } from "preact/hooks";
import { About, InstallSuggestion } from "../shell/notices.tsx";
import * as store from "../store/index.ts";
import { nonce, nameOwed, setName, signIn } from "./auth.ts";
import { go, useLocation } from "./router.tsx";
import { useCanChange, useOnline, useShellState } from "./state.ts";
import { Button, Field, Refused } from "./ui.tsx";

type Google = {
  accounts: {
    id: {
      initialize(options: { client_id: string; nonce: string; callback: (answer: { credential: string }) => void; ux_mode: "popup" }): void;
      renderButton(element: HTMLElement, options: Record<string, string | number>): void;
    };
  };
};

let gis: Promise<Google> | undefined;

/** Loads Google Identity Services, once. */
function loadGoogle(): Promise<Google> {
  gis ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve((window as unknown as { google: Google }).google);
    script.onerror = () => {
      gis = undefined;
      reject(new Error("Google's sign-in could not be loaded."));
    };
    document.head.append(script);
  });
  return gis;
}

/** Where to go once signed in and named: the screen the traveller came for, or the list of trips. */
function nextOf(search: URLSearchParams): string {
  const next = search.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Signs in with Google's ID token, then asks for a name where the traveller has none yet (§4.1). */
export async function complete(idToken: string, given: string, next: string): Promise<string | undefined> {
  const result = await signIn(idToken, given);
  if (!result.ok) return result.refusal.message;
  go(result.value.named ? next : `/name?next=${encodeURIComponent(next)}`, true);
  return undefined;
}

/** A computer: wider than 720 pixels, and no touch screen (§4.1). */
function onComputer(): boolean {
  return matchMedia("(min-width: 721px)").matches && navigator.maxTouchPoints === 0;
}

export function SignIn() {
  const { search } = useLocation();
  const online = useOnline();
  const shell = useShellState();
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const next = nextOf(search);

  useEffect(() => {
    if (!online) return;
    let live = true;
    void (async () => {
      const asked = await nonce();
      if (!asked.ok) return setError(asked.refusal.message);
      try {
        const google = await loadGoogle();
        if (!live || !button.current) return;
        google.accounts.id.initialize({
          client_id: asked.value.google,
          nonce: asked.value.nonce,
          ux_mode: "popup",
          callback: ({ credential }) => void complete(credential, asked.value.nonce, next).then(setError),
        });
        google.accounts.id.renderButton(button.current, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "signin_with", width: 280 });
      } catch (failed) {
        setError((failed as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [online, next]);

  return (
    <main class="screen narrow sign-in" data-screen="sign-in">
      <img class="sign-in-icon" src="/icons/apple-touch-icon.png" alt="" width="72" height="72" />
      <h1 class="title">Itinero</h1>
      <p class="lead">Plan a trip day by day, keep its bookings, and read it with no connection.</p>
      <InstallSuggestion state={shell} />
      {online ? <div class="google-button" ref={button} data-google-button /> : <p class="lead">Connect to the internet to sign in.</p>}
      <Refused message={error} />
      {onComputer() ? (
        <p class="footnote" data-notice="computer">
          The trips you open stay on this computer until you sign out. Sign out when you finish, on a computer others use.
        </p>
      ) : null}
      <About state={shell} />
    </main>
  );
}

/** Choosing the name other travellers see, before any other screen opens (§4.1, WEB:SCREENS-F10). */
export function ChooseName({ given }: { given: string }) {
  const { search } = useLocation();
  const canChange = useCanChange();
  const [name, setNameText] = useState(given);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const next = nextOf(search);
  return (
    <main class="screen narrow" data-screen="name">
      <h1 class="title">Your name</h1>
      <p class="lead">Other travellers on your trips see you by this name. You can change it later in Settings.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          const result = await setName(name);
          setSaving(false);
          if (!result.ok) return setError(result.refusal.message);
          go(next, true);
        }}
      >
        <Field label="Name" error={error}>
          <input
            name="name"
            value={name}
            maxLength={60}
            autocomplete="name"
            enterkeyhint="done"
            onInput={(event) => setNameText(event.currentTarget.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={!canChange || saving || name.trim() === ""}>
          Continue
        </Button>
      </form>
    </main>
  );
}

/** The screen an invitation's email links to: sign in, choose a name, then accept (§4.7). */
export function Invitation({ id, account }: { id: string; account: string | undefined }) {
  const { hash } = useLocation();
  const canChange = useCanChange();
  const [error, setError] = useState<string>();
  const token = hash.replace(/^#/, "");
  const here = `/invitations/${encodeURIComponent(id)}${hash}`;

  useEffect(() => {
    if (!account) return go(`/sign-in?next=${encodeURIComponent(here)}`, true);
    if (nameOwed() !== undefined) return go(`/name?next=${encodeURIComponent(here)}`, true);
    if (!canChange) return;
    void store.accept(id, token).then((result) => {
      if (result.ok) go(`/trips/${encodeURIComponent(result.value.trip)}`, true);
      else setError(result.refusal.message);
    });
  }, [account, canChange]);

  return (
    <main class="screen narrow" data-screen="invitation">
      <h1 class="title">Joining a trip</h1>
      {error ? <Refused message={error} /> : <p class="lead">{canChange ? "Accepting the invitation…" : "Connect to the internet to accept the invitation."}</p>}
      {error ? <Button onClick={() => go("/")}>Your trips</Button> : null}
    </main>
  );
}
