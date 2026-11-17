// The settings: the traveller's name, the clock and date order, the places the device holds, and
// signing out (docs/spec/web/screens.md §4.8, §4.1).

import { useEffect, useMemo, useState } from "preact/hooks";
import { countries } from "@itinero/itinerary";
import * as places from "../places/index.ts";
import { About } from "../shell/notices.tsx";
import * as store from "../store/index.ts";
import { setName } from "./auth.ts";
import { go } from "./router.tsx";
import { useCanChange, useShellState, useStyle } from "./state.ts";
import { chooseStyle } from "./style.ts";
import { Button, Group, Refused, Row, Title } from "./ui.tsx";

const NAMES = new Map(countries().map((c) => [c.code, c.name]));

/** The traveller's name, as the members of their trips give it. */
async function myName(account: string): Promise<string> {
  for (const summary of await store.trips()) {
    const member = (await store.trip(summary.id))?.members.find((m) => m.account === account);
    if (member) return member.name;
  }
  return "";
}

export function Settings({ account, back }: { account: string; back: { href: string; label: string } }) {
  const style = useStyle();
  const shell = useShellState();
  const canChange = useCanChange();
  const [name, setNameText] = useState("");
  const [saved, setSaved] = useState<string>();
  const [error, setError] = useState<string>();
  const [held, setHeld] = useState<readonly string[]>([]);
  const [fetching, setFetching] = useState("");
  const [fetchError, setFetchError] = useState<string>();

  useEffect(() => {
    // The name read fills the field only where the traveller has not begun typing.
    void myName(account).then((read) => setNameText((typed) => (typed === "" ? read : typed)));
    void places.held().then(setHeld);
  }, [account]);

  const others = useMemo(() => countries().filter((c) => !held.includes(c.code)), [held]);

  return (
    <main class="screen narrow" data-screen="settings">
      <Title back={back}>Settings</Title>

      <Group heading="Your name" note="Other travellers on your trips see you by this name.">
        <form
          class="row row-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await setName(name);
            if (!result.ok) return setError(result.refusal.message);
            setError(undefined);
            setSaved("Saved.");
          }}
        >
          <input aria-label="Your name" name="name" value={name} maxLength={60} disabled={!canChange} onInput={(e) => setNameText(e.currentTarget.value)} />
          {canChange ? (
            <Button type="submit" kind="plain">
              Save
            </Button>
          ) : null}
        </form>
      </Group>
      <Refused message={error} />
      {saved ? <p class="footnote" role="status">{saved}</p> : null}

      <Group heading="Times">
        <div class="row segmented-row">
          <span class="row-main">Clock</span>
          <div class="segmented" role="radiogroup" aria-label="Clock">
            {(["24h", "12h"] as const).map((clock) => (
              <button type="button" role="radio" aria-checked={style.clock === clock} key={clock} onClick={() => chooseStyle({ ...style, clock })}>
                {clock === "24h" ? "24-hour" : "12-hour"}
              </button>
            ))}
          </div>
        </div>
        <div class="row segmented-row">
          <span class="row-main">Dates</span>
          <div class="segmented" role="radiogroup" aria-label="Dates">
            {(["day-first", "month-first"] as const).map((dateOrder) => (
              <button type="button" role="radio" aria-checked={style.dateOrder === dateOrder} key={dateOrder} onClick={() => chooseStyle({ ...style, dateOrder })}>
                {dateOrder === "day-first" ? "9 Dec" : "Dec 9"}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group heading="Places on this device" note="Place names from GeoNames, under CC BY 4.0.">
        {held.map((code) => (
          <Row key={code}>{NAMES.get(code) ?? code}</Row>
        ))}
        {canChange ? (
          <form
            class="row row-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const code = others.find((c) => c.name === fetching)?.code;
              if (!code) return setFetchError("Choose a country from the list.");
              const result = await places.fetchCountry(code);
              if (!result.ok) return setFetchError(result.refusal.message);
              setFetchError(undefined);
              setFetching("");
              setHeld(await places.held());
            }}
          >
            <input aria-label="Fetch another country" name="country" list="settings-countries" placeholder="Fetch another country" value={fetching} onInput={(e) => setFetching(e.currentTarget.value)} />
            <datalist id="settings-countries">
              {others.map((c) => (
                <option key={c.code} value={c.name} />
              ))}
            </datalist>
            <Button type="submit" kind="plain">
              Fetch
            </Button>
          </form>
        ) : null}
      </Group>
      <Refused message={fetchError} />

      <Group>
        <Row
          onClick={async () => {
            await store.signOut();
            go("/sign-in", true);
          }}
        >
          <span class="danger-text" data-action="sign-out">
            Sign out
          </span>
        </Row>
      </Group>
      <About state={shell} />
    </main>
  );
}

