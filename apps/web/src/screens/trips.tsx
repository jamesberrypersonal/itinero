// The list of trips, and a new trip (docs/spec/web/screens.md §4.2).

import { useMemo, useState } from "preact/hooks";
import { countries } from "@itinero/itinerary";
import { About, InstallSuggestion } from "../shell/notices.tsx";
import * as store from "../store/index.ts";
import { go, Link } from "./router.tsx";
import { useCanChange, useShellState, useStyle, useTrips } from "./state.ts";
import { Button, Empty, Field, Group, Refused, Row, Title } from "./ui.tsx";
import { datesWords } from "./words.ts";

export function Trips() {
  const trips = useTrips();
  const shell = useShellState();
  const style = useStyle();
  const canChange = useCanChange();
  return (
    <main class="screen" data-screen="trips">
      <Title
        action={
          <Link class="icon-button" href="/settings" aria-label="Settings">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8" />
              <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </Link>
        }
      >
        Trips
      </Title>
      <InstallSuggestion state={shell} />
      {trips === undefined ? null : trips.length === 0 ? (
        <Empty>No trips yet. {canChange ? "Start one, or open an invitation from your email." : "Connect to start one."}</Empty>
      ) : (
        <Group>
          {trips.map((trip) => (
            <Row key={trip.id} href={`/trips/${encodeURIComponent(trip.id)}`} detail={datesWords(trip.dates, style)}>
              {trip.name}
            </Row>
          ))}
        </Group>
      )}
      {canChange ? (
        <Button kind="plain" class="wide" onClick={() => go("/trips/new")} data-action="new-trip">
          New trip
        </Button>
      ) : null}
      <Group>
        <Row href="/library">Your templates</Row>
      </Group>
      <About state={shell} />
    </main>
  );
}

const ALL = countries();

/** Starting a trip: its name, its dates, and its countries, each of which gets a page (PLN-F10). */
export function NewTrip() {
  const canChange = useCanChange();
  const [name, setName] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const suggestions = useMemo(() => {
    const words = fold(typed.trim());
    if (words === "") return [];
    return ALL.filter((c) => !chosen.includes(c.code) && fold(c.name).split(/\s+/).some((w) => w.startsWith(words))).slice(0, 6);
  }, [typed, chosen]);

  return (
    <main class="screen narrow" data-screen="new-trip">
      <Title back={{ href: "/", label: "Trips" }}>New trip</Title>
      <form
        class="form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          const made = await store.create(name, { first, last }, chosen);
          setSaving(false);
          if (!made.ok) return setError(made.refusal.message);
          go(`/trips/${encodeURIComponent(made.value.trip)}`, true);
        }}
      >
        <Field label="Name">
          <input name="name" value={name} maxLength={200} onInput={(e) => setName(e.currentTarget.value)} required />
        </Field>
        <div class="field-pair">
          <Field label="First day">
            <input name="first" type="date" value={first} onInput={(e) => setFirst(e.currentTarget.value)} required />
          </Field>
          <Field label="Last day">
            <input name="last" type="date" value={last} min={first} onInput={(e) => setLast(e.currentTarget.value)} required />
          </Field>
        </div>
        <Field label="Countries" hint="Each country gets a page of its own for your research.">
          <input
            name="country"
            value={typed}
            placeholder="Type a country"
            autocomplete="off"
            onInput={(e) => setTyped(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions[0]) {
                e.preventDefault();
                setChosen([...chosen, suggestions[0].code]);
                setTyped("");
              }
            }}
          />
        </Field>
        {suggestions.length ? (
          <div class="suggestions" role="listbox">
            {suggestions.map((c) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={c.code}
                class="suggestion"
                onClick={() => {
                  setChosen([...chosen, c.code]);
                  setTyped("");
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
        {chosen.length ? (
          <div class="chips">
            {chosen.map((code) => (
              <button type="button" class="chip" key={code} aria-label={`Remove ${ALL.find((c) => c.code === code)?.name}`} onClick={() => setChosen(chosen.filter((c) => c !== code))}>
                {ALL.find((c) => c.code === code)?.name} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}
        <Refused message={error} />
        <Button type="submit" disabled={!canChange || saving || !name.trim() || !first || !last}>
          Start the trip
        </Button>
      </form>
    </main>
  );
}
