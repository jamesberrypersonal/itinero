// A trip's frame, its bar and its offline line, and its home page (docs/spec/web/screens.md §3.1,
// §4, §4.3).

import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { extent, label, notOver, onDate, type Booking } from "@itinero/bookings";
import { changeToText as calendarChange, type Dates } from "@itinero/itinerary";
import { countryPage, forPhone } from "@itinero/pages";
import { format } from "@itinero/trip-time";
import { countries } from "@itinero/itinerary";
import * as store from "../store/index.ts";
import type { Copy } from "../store/index.ts";
import { countryAt, loadBorders } from "./country.ts";
import { dayOf, dayWords, localToday, utcNow } from "./day.ts";
import { go, Link, useLocation } from "./router.tsx";
import { useCanChange, useNow, useOnline, useShellState, useStyle } from "./state.ts";
import { Button, Empty, Field, Group, Refused, Row } from "./ui.tsx";
import { datesWords, momentWords } from "./words.ts";
import { checklistPath, progressWords } from "./checklists.tsx";
import { progress } from "@itinero/checklists";

/** A traveller's name, with a former member marked (§4.7). */
export function nameOf(copy: Copy, account: string): string {
  const member = copy.members.find((m) => m.account === account);
  if (!member) return "A former traveller";
  return member.removed ? `${member.name} (left the trip)` : member.name;
}

const tripPath = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;

/** The line every screen of a trip shows while offline, or while a new version is required (§4). */
function OfflineLine({ copy }: { copy: Copy }) {
  const online = useOnline();
  const shell = useShellState();
  const style = useStyle();
  const now = useNow();
  if (shell.updateRequired || online) return null;
  return (
    <p class="offline-line" role="status" data-offline>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13">
        <path d="M2 6.5a9 9 0 0 1 12 0M4.5 9a5.5 5.5 0 0 1 7 0M7 11.5a2 2 0 0 1 2 0M2 2l12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      Offline · brought up to date {momentWords(copy.caughtUp, style, now.getTime())}
    </p>
  );
}

const BAR = [
  { rest: "", label: "Home", icon: "M4 11l8-7 8 7v9h-5v-6h-6v6H4z" },
  { rest: "/calendar", label: "Calendar", icon: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h2M14 14h2M8 17h2" },
  { rest: "/bookings", label: "Bookings", icon: "M4 7h16v12H4zM8 4v6M16 4v6M4 11h16" },
  { rest: "/pages", label: "Pages", icon: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7" },
  { rest: "/checklists", label: "Checklists", icon: "M4 6.5l1.6 1.6L8.5 5M4 12.5l1.6 1.6 2.9-3.1M4 18.5l1.6 1.6 2.9-3.1M11 7h9M11 13h9M11 19h9" },
  { rest: "/members", label: "Members", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c.8-3.5 3-5.5 6-5.5s5.2 2 6 5.5M16 4.5a3.2 3.2 0 0 1 0 6.3M17.5 14.6c1.8.7 3 2.4 3.5 5.4" },
] as const;

/** The frame every screen of a trip is drawn in: its bar along the foot on a phone, and down the side on a computer. */
export function TripFrame({ id, children }: { id: string; children: (copy: Copy) => ComponentChildren }) {
  const [copy, setCopy] = useState<Copy | null | undefined>(undefined);
  const { path } = useLocation();
  useEffect(
    () =>
      store.watch(id, (next) => {
        // The timing tests read the time from this mark to the home page's (§4.9).
        performance.mark("itinero-copy-given");
        setCopy(next ?? null);
      }),
    [id],
  );
  const held = copy !== undefined && copy !== null;
  // The trip opened is the one Itinero opens with next time (§4.2).
  useEffect(() => {
    if (held) void store.opened(id);
  }, [id, held]);
  if (copy === undefined) return <main class="screen" aria-busy="true" />;
  if (copy === null) {
    return (
      <main class="screen narrow" data-screen="no-trip">
        <h1 class="title">Trip not on this device</h1>
        <p class="lead">You may have left this trip, or it may not have reached this device yet.</p>
        <Button onClick={() => go("/")}>Your trips</Button>
      </main>
    );
  }
  const here = path.replace(/\/+$/, "");
  return (
    <div class="trip">
      <nav class="trip-bar" aria-label={copy.name}>
        <p class="trip-bar-name">{copy.name}</p>
        {BAR.filter((item) => item.rest !== "/calendar" || copy.calendar).map((item) => {
          const href = tripPath(id, item.rest);
          const current = item.rest === "" ? here === href : here.startsWith(href);
          return (
            <Link key={item.label} href={href} class="trip-bar-item" aria-current={current ? "page" : undefined}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
                <path d={item.icon} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" />
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link href="/" class="trip-bar-item trip-bar-trips">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
            <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
          <span>All trips</span>
        </Link>
      </nav>
      <div class="trip-body">
        <OfflineLine copy={copy} />
        {children(copy)}
      </div>
    </div>
  );
}

/** A trip's menu: the trip's settings, the library, the list of trips, and signing out (WEB:SCREENS-F9, WEB:SCREENS-F12). */
export function TripMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="menu">
      <button type="button" class="icon-button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} data-action="trip-menu">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
          <circle cx="5" cy="12" r="1.8" fill="currentColor" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <circle cx="19" cy="12" r="1.8" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div class="menu-list" role="menu">
          <Link role="menuitem" href={tripPath(id, "/settings")}>
            Settings
          </Link>
          <Link role="menuitem" href="/library">
            Your templates
          </Link>
          <Link role="menuitem" href="/">
            All trips
          </Link>
          <button
            type="button"
            role="menuitem"
            class="danger-text"
            data-action="sign-out"
            onClick={async () => {
              await store.signOut();
              go("/sign-in", true);
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** A booking's row: what it is, when it starts, and its screen. */
export function BookingRow({ copy, booking }: { copy: Copy; booking: Booking }) {
  const style = useStyle();
  return (
    <Row href={tripPath(copy.id, `/bookings/${encodeURIComponent(booking.id)}`)} sub={format(extent(booking).starts, style)}>
      {label(booking)}
    </Row>
  );
}

const COUNTRY_NAMES = new Map(countries().map((c) => [c.code, c.name]));
const FIND = "itinero-find-country";

/** Finds the country the phone is in, on the phone, once the traveller asks (§4.3, WEB-F6). */
function Country({ copy }: { copy: Copy }) {
  const [asked, setAsked] = useState(() => {
    try {
      return localStorage.getItem(FIND) === "allowed";
    } catch {
      return false;
    }
  });
  const [found, setFound] = useState<{ code?: string } | undefined>(undefined);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!asked) return;
    if (!("geolocation" in navigator)) return setError("This device cannot say where it is.");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          localStorage.setItem(FIND, "allowed");
        } catch {
          // Asked again next time.
        }
        const borders = await loadBorders();
        const code = countryAt(borders, position.coords.longitude, position.coords.latitude);
        setFound(code === undefined ? {} : { code });
      },
      () => {
        setError("Itinero was not allowed to read where this phone is.");
        setAsked(false);
      },
      { maximumAge: 600_000, enableHighAccuracy: false, timeout: 30_000 },
    );
  }, [asked]);

  if (!asked) {
    return (
      <Group heading="Where you are">
        <Row onClick={() => setAsked(true)}>
          <span data-action="find-country">Find the country I'm in</span>
        </Row>
        {error ? <p class="group-note">{error}</p> : null}
      </Group>
    );
  }
  if (!found) return null;
  if (!found.code) return <Group heading="Where you are">{<Row>Not in any country</Row>}</Group>;
  const page = countryPage(forPhone(copy.pages), found.code);
  const name = COUNTRY_NAMES.get(found.code) ?? found.code;
  return (
    <Group heading="Where you are">
      {page ? (
        <Row href={tripPath(copy.id, `/pages/${encodeURIComponent(page.id)}`)}>
          <span data-country={found.code}>{name}</span>
        </Row>
      ) : (
        <Row>
          <span data-country={found.code}>{name}</span>
        </Row>
      )}
    </Group>
  );
}

/** Setting the traveller's own dates, and, for the creator, the trip's (PLN-F14). */
function Dates({ copy, account }: { copy: Copy; account: string }) {
  const canChange = useCanChange();
  const style = useStyle();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<Dates>(copy.mine);
  const [trip, setTrip] = useState<Dates>(copy.dates);
  const [error, setError] = useState<string>();
  const send = async (change: string) => {
    const result = await store.send(copy.id, "calendar", change);
    if (!result.ok) return setError(result.refusal.message);
    setError(undefined);
    setOpen(false);
  };
  return (
    <Group heading="Dates">
      <Row detail={datesWords(copy.mine, style)}>Your dates</Row>
      {copy.you.creator || copy.mine.first !== copy.dates.first || copy.mine.last !== copy.dates.last ? <Row detail={datesWords(copy.dates, style)}>The trip</Row> : null}
      {canChange && !open ? (
        <Row onClick={() => setOpen(true)}>
          <span class="accent-text">Change dates</span>
        </Row>
      ) : null}
      {open ? (
        <div class="row row-stack">
          <div class="field-pair">
            <Field label="You arrive">
              <input type="date" name="mine-first" value={mine.first} min={copy.dates.first} max={copy.dates.last} onInput={(e) => setMine({ ...mine, first: e.currentTarget.value })} />
            </Field>
            <Field label="You leave">
              <input type="date" name="mine-last" value={mine.last} min={copy.dates.first} max={copy.dates.last} onInput={(e) => setMine({ ...mine, last: e.currentTarget.value })} />
            </Field>
          </div>
          <Button onClick={() => send(calendarChange({ op: "traveller-dates", traveller: account, dates: mine }))}>Save your dates</Button>
          {copy.you.creator ? (
            <>
              <div class="field-pair">
                <Field label="Trip starts">
                  <input type="date" name="trip-first" value={trip.first} onInput={(e) => setTrip({ ...trip, first: e.currentTarget.value })} />
                </Field>
                <Field label="Trip ends">
                  <input type="date" name="trip-last" value={trip.last} onInput={(e) => setTrip({ ...trip, last: e.currentTarget.value })} />
                </Field>
              </div>
              <Button kind="plain" onClick={() => send(calendarChange({ op: "trip-dates", dates: trip }))}>
                Save the trip's dates
              </Button>
            </>
          ) : null}
          <Refused message={error} />
        </div>
      ) : null}
    </Group>
  );
}

/** Before the traveller's first date, their checklists with an item not yet ticked (§4.3, WEB:SCREENS-F13). */
function NotDone({ copy }: { copy: Copy }) {
  const left = copy.checklists.filter((c) => {
    const { ticked, of } = progress(c);
    return of > 0 && ticked < of;
  });
  if (left.length === 0) return null;
  return (
    <Group heading="Before you go">
      {left.map((c) => (
        <Row key={c.id} href={checklistPath(copy.id, c.id)} detail={progressWords(c)}>
          <span data-not-done={c.id}>{c.title}</span>
        </Row>
      ))}
    </Group>
  );
}

/** A trip's home page, for the traveller looking (§4.3, WEB:SCREENS-F2). */
export function Home({ copy, account }: { copy: Copy; account: string }) {
  const now = useNow();
  const today = localToday(now);
  const day = dayOf(today, copy.mine);
  const theirs = copy.bookings.filter((b) => b.travellers.includes(account));
  const todays = onDate(theirs, today);
  const next = notOver(theirs, utcNow(now))
    .filter((b) => extent(b).first > today)
    .slice(0, 3);
  useLayoutEffect(() => {
    performance.mark("itinero-home-drawn");
  });
  return (
    <main class="screen" data-screen="home">
      <header class="title-bar">
        <div class="title-row">
          <h1 class="title">{copy.name}</h1>
          <TripMenu id={copy.id} />
        </div>
        <p class="day" data-day>
          {dayWords(day)}
        </p>
      </header>
      <Group heading="Today">
        {todays.length ? todays.map((b) => <BookingRow key={b.id} copy={copy} booking={b} />) : <Row>Nothing booked today</Row>}
      </Group>
      {next.length ? (
        <Group heading="Next">
          {next.map((b) => (
            <BookingRow key={b.id} copy={copy} booking={b} />
          ))}
        </Group>
      ) : null}
      {today < copy.mine.first ? <NotDone copy={copy} /> : null}
      <Country copy={copy} />
      <Dates copy={copy} account={account} />
      {copy.bookings.length === 0 && copy.pages.pages.length === 0 ? <Empty>Nothing in this trip yet.</Empty> : null}
    </main>
  );
}
