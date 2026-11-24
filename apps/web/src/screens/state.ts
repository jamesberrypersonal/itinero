// The screens' view of the shell and the trip store, kept up to date as each changes.

import { useEffect, useState } from "preact/hooks";
import type { TextStyle } from "@itinero/trip-time";
import { current, onChange, type ShellState } from "../shell/index.ts";
import * as store from "../store/index.ts";
import type { Copy, Library, Summary } from "../store/index.ts";
import { onStyle, style } from "./style.ts";

export function useShellState(): ShellState {
  const [state, setState] = useState(current()!);
  useEffect(() => {
    setState(current()!);
    return onChange(setState);
  }, []);
  return state;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(store.isOnline());
  useEffect(() => {
    setOnline(store.isOnline());
    return store.onOnline(setOnline);
  }, []);
  return online;
}

/** Whether a screen may offer a change: online, and with a version the online side answers (§4). */
export function useCanChange(): boolean {
  const online = useOnline();
  const shell = useShellState();
  return online && !shell.updateRequired;
}

export function useTrips(): readonly Summary[] | undefined {
  const [trips, setTrips] = useState<readonly Summary[] | undefined>(undefined);
  useEffect(() => {
    void store.trips().then(setTrips);
    return store.onTrips(setTrips);
  }, []);
  return trips;
}

/** A trip's copy, as the trip store gives it and each time it changes. Undefined: still reading. Null: not held. */
export function useCopy(id: string): Copy | null | undefined {
  const [copy, setCopy] = useState<Copy | null | undefined>(undefined);
  useEffect(() => {
    setCopy(undefined);
    return store.watch(id, (next) => setCopy(next ?? null));
  }, [id]);
  return copy;
}

export function useStyle(): TextStyle {
  const [current, setCurrent] = useState(style());
  useEffect(() => onStyle(setCurrent), []);
  return current;
}

/** The device's clock, read again each minute, so that today and what is next stay right. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** The traveller's library, as the trip store gives it and each time it changes. Undefined: still reading. */
export function useLibrary(): Library | undefined {
  const [library, setLibrary] = useState<Library | undefined>(undefined);
  useEffect(() => {
    void store.library().then(setLibrary);
    return store.onLibrary(setLibrary);
  }, []);
  return library;
}
