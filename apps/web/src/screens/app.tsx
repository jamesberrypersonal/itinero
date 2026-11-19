// The screens' root: each address's screen (docs/spec/web/screens.md §3.1), the bars of a version
// waiting and a version too old, and the guards of signing in and choosing a name (§4.1).

import { useEffect, useState } from "preact/hooks";
import { UpdateRequired, UpdateWaiting } from "../shell/notices.tsx";
import * as store from "../store/index.ts";
import { ChooseName, Invitation, SignIn } from "./account.tsx";
import { forgetNameOwed, nameOwed } from "./auth.ts";
import { BookingForm, Bookings, BookingView } from "./bookings.tsx";
import { Calendar } from "./calendar.tsx";
import { Member, Members } from "./members.tsx";
import { Graveyard, PageEditor, PageTree, PageView, Search } from "./pages.tsx";
import { go, match, useLocation } from "./router.tsx";
import { Settings } from "./settings.tsx";
import { useShellState } from "./state.ts";
import { Home, TripFrame } from "./trip.tsx";
import { NewTrip, Trips } from "./trips.tsx";

/** Addresses a traveller who is signed out may open. */
const OPEN = ["/sign-in"];

export function App({ initialAccount }: { initialAccount: string | undefined }) {
  const shell = useShellState();
  const { path, search } = useLocation();
  const [account, setAccount] = useState(initialAccount);
  // The address whose account has been read. Signing in, in this window, records the account with
  // the trip store, so it is read again at each address before any guard acts on it.
  const [checked, setChecked] = useState(location.pathname);

  useEffect(
    () =>
      store.onSignedOut(() => {
        forgetNameOwed();
        setAccount(undefined);
        go("/sign-in", true);
      }),
    [],
  );
  useEffect(() => {
    let live = true;
    void store.open().then((opened) => {
      if (!live) return;
      setAccount(opened.account);
      setChecked(path);
    });
    return () => {
      live = false;
    };
  }, [path]);

  const invitation = match("/invitations/:invitation", path);
  let screen;
  if (checked !== path) {
    screen = null;
  } else if (!account && !OPEN.includes(path) && !invitation) {
    queueMicrotask(() => go(`/sign-in?next=${encodeURIComponent(path + location.search + location.hash)}`, true));
    screen = null;
  } else if (account && path !== "/name" && !invitation && nameOwed() !== undefined) {
    queueMicrotask(() => go(`/name?next=${encodeURIComponent(path)}`, true));
    screen = null;
  } else {
    screen = route(path, search, account);
  }

  return (
    <div class="app">
      <UpdateRequired state={shell} />
      <UpdateWaiting state={shell} />
      {screen}
    </div>
  );
}

function route(path: string, _search: URLSearchParams, account: string | undefined) {
  const invitation = match("/invitations/:invitation", path);
  if (invitation) return <Invitation id={invitation["invitation"]!} account={account} />;
  if (path === "/sign-in") return account ? (queueMicrotask(() => go("/", true)), null) : <SignIn />;
  if (!account) return null;
  if (path === "/name") return <ChooseName given={nameOwed() ?? ""} />;
  if (path === "/" || path === "") return <Trips />;
  if (path === "/trips/new") return <NewTrip />;
  if (path === "/settings") return <Settings account={account} back={{ href: "/", label: "Trips" }} />;

  const trip = match("/trips/:trip", path) ?? match("/trips/:trip/:screen", path) ?? match("/trips/:trip/:screen/:item", path) ?? match("/trips/:trip/:screen/:item/:action", path);
  if (trip) {
    const id = trip["trip"]!;
    const screen = trip["screen"];
    const item = trip["item"];
    const action = trip["action"];
    const parent = new URLSearchParams(location.search).get("parent") ?? undefined;
    return (
      <TripFrame id={id}>
        {(copy) => {
          if (screen === "calendar" && copy.calendar) return <Calendar copy={copy} account={account} />;
          // A traveller with no calendar in their copy: its address opens the home page (§4.4).
          if (!screen || screen === "calendar") return <Home copy={copy} account={account} />;
          if (screen === "settings") return <Settings account={account} back={{ href: `/trips/${encodeURIComponent(id)}`, label: copy.name }} />;
          if (screen === "members") return item ? <Member copy={copy} account={account} id={item} /> : <Members copy={copy} account={account} />;
          if (screen === "search") return <Search copy={copy} />;
          if (screen === "graveyard") return <Graveyard copy={copy} />;
          if (screen === "pages") {
            if (!item) return <PageTree copy={copy} account={account} />;
            if (item === "new") return parent ? <PageEditor copy={copy} parent={parent} /> : <PageEditor copy={copy} />;
            if (action === "edit") return <PageEditor copy={copy} id={item} />;
            return <PageView copy={copy} account={account} id={item} />;
          }
          if (screen === "bookings") {
            if (!item) return <Bookings copy={copy} account={account} />;
            if (item === "new") return <BookingForm copy={copy} account={account} />;
            if (action === "edit") return <BookingForm copy={copy} account={account} id={item} />;
            return <BookingView copy={copy} account={account} id={item} />;
          }
          return <Home copy={copy} account={account} />;
        }}
      </TripFrame>
    );
  }
  return <Trips />;
}
