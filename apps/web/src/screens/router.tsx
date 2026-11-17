// Each screen's address (docs/spec/web/screens.md §3.1). The router follows the browser's history,
// so a traveller returns to a screen with Back, and a link names it.

import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

addEventListener("popstate", notify);

/** Opens a screen by its address. */
export function go(path: string, replace = false): void {
  if (path === location.pathname + location.search + location.hash) return;
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  scrollTo(0, 0);
  notify();
}

/** The address showing, kept up to date. */
export function useLocation(): { path: string; search: URLSearchParams; hash: string } {
  const [, setTick] = useState(0);
  const drawn = useRef("");
  drawn.current = location.pathname + location.search + location.hash;
  useLayoutEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    // An address changed between drawing and listening, such as by a redirect while drawing, is
    // caught up with now rather than missed.
    if (location.pathname + location.search + location.hash !== drawn.current) listener();
    return () => listeners.delete(listener);
  }, []);
  return { path: location.pathname, search: new URLSearchParams(location.search), hash: location.hash };
}

/** Matches an address against a pattern such as `/trips/:trip/pages/:page`. */
export function match(pattern: string, path: string): Record<string, string> | undefined {
  const want = pattern.split("/");
  const have = path.replace(/\/+$/, "").split("/");
  if (want.length !== have.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i]!.startsWith(":")) params[want[i]!.slice(1)] = decodeURIComponent(have[i]!);
    else if (want[i] !== have[i]) return undefined;
  }
  return params;
}

/** A link to another screen, opened without reloading. */
type LinkProps = {
  href: string;
  children: ComponentChildren;
  class?: string;
  role?: "menuitem" | "tab" | "option";
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
  [data: `data-${string}`]: string | undefined;
};

export function Link({ href, children, ...rest }: LinkProps) {
  return (
    <a
      {...(rest as Record<string, unknown>)}
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        go(href);
      }}
    >
      {children}
    </a>
  );
}
