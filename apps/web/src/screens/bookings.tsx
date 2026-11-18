// A trip's bookings: the list, one booking's screen, and the form of each kind
// (docs/spec/web/screens.md §4.5, WEB:SCREENS-F4, WEB:SCREENS-F8).

import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  changeToText,
  connections,
  extent,
  journeyDuration,
  label,
  legDurations,
  nights,
  notOver,
  order,
  type ActivityBooking,
  type Booking,
  type Details,
  type FlightBooking,
  type JourneyBooking,
  type Sort,
  type StayBooking,
  type Way,
} from "@itinero/bookings";
import { format, formatDuration, type TripTime } from "@itinero/trip-time";
import * as places from "../places/index.ts";
import * as store from "../store/index.ts";
import { allows } from "./access.ts";
import type { Copy } from "../store/index.ts";
import { utcNow } from "./day.ts";
import { go } from "./router.tsx";
import { useCanChange, useNow, useStyle } from "./state.ts";
import { draftOf, emptyTime, timeOf, TimeField, TownField, type TimeDraft } from "./time-field.tsx";
import { BookingRow, nameOf, TripMenu } from "./trip.tsx";
import { Button, Confirm, Empty, Field, Group, Refused, Row, Title } from "./ui.tsx";
import { dateWords } from "./words.ts";

const tripPath = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;
const bookingPath = (copy: Copy, id: string, rest = "") => tripPath(copy.id, `/bookings/${encodeURIComponent(id)}${rest}`);

/** Whether the copy lets the traveller change a booking naming these travellers. */
function mayChange(copy: Copy, account: string, travellers: readonly string[]): boolean {
  return allows(copy, account, { kind: "change-booking", travellers });
}

/** The bookings page: every booking under the date it starts, opening at the first not yet over (BKG-F3). */
export function Bookings({ copy, account }: { copy: Copy; account: string }) {
  const canChange = useCanChange();
  const style = useStyle();
  const now = useNow();
  const ordered = useMemo(() => order(copy.bookings), [copy]);
  const next = useMemo(() => notOver(ordered, utcNow(now))[0], [ordered, now]);
  const nextRow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    nextRow.current?.scrollIntoView({ block: "start" });
  }, [next?.id]);

  const groups: { heading: string; bookings: Booking[] }[] = [];
  for (const booking of ordered) {
    const { first, last } = extent(booking);
    const heading = first === last ? dateWords(first, style, { weekday: true }) : `${dateWords(first, style, { weekday: true })} – ${dateWords(last, style)}`;
    const group = groups.at(-1);
    if (group && group.heading === heading) group.bookings.push(booking);
    else groups.push({ heading, bookings: [booking] });
  }

  return (
    <main class="screen" data-screen="bookings">
      <Title action={<TripMenu id={copy.id} />}>Bookings</Title>
      {ordered.length === 0 ? <Empty>No bookings yet.</Empty> : null}
      {groups.map((group) => (
        <div key={group.heading} ref={group.bookings.includes(next!) ? nextRow : null} class="booking-day" data-next={group.bookings.includes(next!) ? "" : undefined}>
          <Group heading={group.heading}>
            {group.bookings.map((booking) => (
              <BookingRow key={booking.id} copy={copy} booking={booking} />
            ))}
          </Group>
        </div>
      ))}
      {canChange && mayChange(copy, account, [account]) ? (
        <Button kind="plain" class="wide" onClick={() => go(tripPath(copy.id, "/bookings/new"))} data-action="new-booking">
          Add a booking
        </Button>
      ) : null}
    </main>
  );
}

const when = (value: TripTime | undefined, style: ReturnType<typeof useStyle>) => (value ? format(value, style) : undefined);

/** One booking, with every detail, its durations, and its reference copied in one tap (BKG-F4). */
export function BookingView({ copy, account, id }: { copy: Copy; account: string; id: string }) {
  const canChange = useCanChange();
  const style = useStyle();
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const booking = copy.bookings.find((b) => b.id === id);
  if (!booking) {
    return (
      <main class="screen narrow" data-screen="booking">
        <Title back={{ href: tripPath(copy.id, "/bookings"), label: "Bookings" }}>Booking not available</Title>
        <p class="lead">This booking has been removed, or no longer names you.</p>
      </main>
    );
  }
  const may = canChange && mayChange(copy, account, booking.travellers);
  const details = booking.details;
  const page = details.page ? copy.pages.pages.find((p) => p.id === details.page) : undefined;
  return (
    <main class="screen" data-screen="booking">
      <Title
        back={{ href: tripPath(copy.id, "/bookings"), label: "Bookings" }}
        action={
          may ? (
            <Button kind="plain" onClick={() => go(bookingPath(copy, id, "/edit"))} data-action="edit-booking">
              Edit
            </Button>
          ) : undefined
        }
      >
        {label(booking)}
      </Title>

      {booking.kind === "flight" ? <FlightDetails booking={booking} style={style} /> : null}
      {booking.kind === "stay" ? (
        <Group>
          <Row detail={when(booking.checkIn, style)}>Check in</Row>
          <Row detail={when(booking.checkOut, style)}>Check out</Row>
          <Row detail={nights(booking) === 1 ? "1 night" : `${nights(booking)} nights`}>Stay</Row>
          {booking.address ? <Row detail={booking.address}>Address</Row> : null}
        </Group>
      ) : null}
      {booking.kind === "journey" ? (
        <Group>
          <Row detail={when(booking.leaves, style)}>Leaves {booking.from}</Row>
          {booking.arrives ? <Row detail={when(booking.arrives, style)}>Arrives {booking.to}</Row> : null}
          {journeyDuration(booking) ? <Row detail={formatDuration(journeyDuration(booking)!)}>Takes</Row> : null}
          {booking.operator ? <Row detail={booking.operator}>With</Row> : null}
          {booking.service ? <Row detail={booking.service}>Service</Row> : null}
          {booking.seat ? <Row detail={booking.seat}>Seat</Row> : null}
        </Group>
      ) : null}
      {booking.kind === "activity" ? (
        <Group>
          <Row detail={when(booking.starts, style)}>Starts</Row>
          {booking.ends ? <Row detail={when(booking.ends, style)}>Ends</Row> : null}
          {booking.where ? <Row detail={booking.where}>Where</Row> : null}
        </Group>
      ) : null}

      <Group heading="Details">
        {details.reference ? (
          <button
            type="button"
            class="row row-link"
            data-action="copy-reference"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(details.reference!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError("The reference could not be copied.");
              }
            }}
          >
            <span class="row-main">Reference</span>
            <span class="row-detail reference">{copied ? "Copied" : details.reference}</span>
          </button>
        ) : null}
        {details.provider ? <Row detail={details.provider}>Booked with</Row> : null}
        {details.link ? (
          <a class="row row-link" href={details.link} target="_blank" rel="noopener noreferrer">
            <span class="row-main">Booking's page</span>
            <span class="row-detail">Opens in a new tab</span>
          </a>
        ) : null}
        {page ? (
          <Row href={tripPath(copy.id, `/pages/${encodeURIComponent(page.id)}`)} detail={page.title}>
            Page
          </Row>
        ) : details.page ? (
          // A page the traveller may not see, or deleted: no title (ACC-F8).
          <Row detail={<span class="unavailable">Not available</span>}>Page</Row>
        ) : null}
        <Row detail={booking.travellers.map((t) => nameOf(copy, t)).join(", ")}>For</Row>
      </Group>
      {details.notes ? (
        <Group heading="Notes">
          <p class="row notes">{details.notes}</p>
        </Group>
      ) : null}
      <Refused message={error} />
      {may ? (
        <Button kind="plain" class="wide danger-text" onClick={() => setAsking(true)} data-action="remove-booking">
          Remove booking
        </Button>
      ) : null}
      {asking ? (
        <Confirm
          title="Remove this booking?"
          message={`${label(booking)} will be removed for everyone it names.`}
          confirm="Remove"
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            const result = await store.send(copy.id, "bookings", changeToText({ op: "remove", id, base: booking.revision }));
            if (!result.ok) return setError(result.refusal.message);
            go(tripPath(copy.id, "/bookings"), true);
          }}
        />
      ) : null}
    </main>
  );
}

/** Each leg of a flight with how long it takes, and each connection between them (BKG:FLIGHT-F3). */
function FlightDetails({ booking, style }: { booking: FlightBooking; style: ReturnType<typeof useStyle> }) {
  const legs = legDurations(booking);
  const waits = connections(booking);
  return (
    <>
      {booking.legs.map((leg, i) => (
        <div key={i}>
          <Group heading={`${leg.flight}, ${leg.from.name ?? leg.from.code} to ${leg.to.name ?? leg.to.code}`}>
            <Row detail={format(leg.leaves, style)}>Leaves {leg.from.code}</Row>
            <Row detail={format(leg.arrives, style)}>Arrives {leg.to.code}</Row>
            <Row detail={<span data-leg-duration={i}>{formatDuration(legs[i]!)}</span>}>Flight</Row>
            {booking.seats.filter((s) => s.leg === i).map((seat) => (
              <Row key={seat.traveller} detail={seat.seat}>
                Seat
              </Row>
            ))}
          </Group>
          {i < waits.length ? (
            <p class="connection" data-connection={i}>
              Connection in {leg.to.name ?? leg.to.code}: {formatDuration(waits[i]!)}
            </p>
          ) : null}
        </div>
      ))}
    </>
  );
}

// --- The form of each kind (§4.5, BKG-F1) ---

type Kind = Booking["kind"];
const KIND_WORDS: Record<Kind, string> = { flight: "Flight", stay: "Stay", journey: "Journey", activity: "Activity" };

type LegDraft = { flight: string; from: string; fromName: string; to: string; toName: string; leaves: TimeDraft; arrives: TimeDraft };
const emptyLeg = (): LegDraft => ({ flight: "", from: "", fromName: "", to: "", toName: "", leaves: emptyTime(), arrives: emptyTime() });

type Draft = {
  kind: Kind;
  travellers: string[];
  details: Details;
  legs: LegDraft[];
  name: string;
  address: string;
  town: string;
  checkIn: TimeDraft;
  checkOut: TimeDraft;
  by: Way;
  from: string;
  to: string;
  leaves: TimeDraft;
  arrives: TimeDraft;
  hasArrival: boolean;
  operator: string;
  service: string;
  seat: string;
  sort: Sort;
  title: string;
  where: string;
  starts: TimeDraft;
  ends: TimeDraft;
  hasEnd: boolean;
};

function newDraft(kind: Kind, account: string): Draft {
  return {
    kind,
    travellers: [account],
    details: {},
    legs: [emptyLeg()],
    name: "",
    address: "",
    town: "",
    checkIn: emptyTime("", "date"),
    checkOut: emptyTime("", "date"),
    by: "train",
    from: "",
    to: "",
    leaves: emptyTime(),
    arrives: emptyTime(),
    hasArrival: false,
    operator: "",
    service: "",
    seat: "",
    sort: "tour",
    title: "",
    where: "",
    starts: emptyTime(),
    ends: emptyTime(),
    hasEnd: false,
  };
}

function draftOfBooking(booking: Booking): Draft {
  const draft = newDraft(booking.kind, "");
  draft.travellers = [...booking.travellers];
  draft.details = { ...booking.details };
  if (booking.kind === "flight") {
    draft.legs = booking.legs.map((leg) => ({
      flight: leg.flight,
      from: leg.from.code,
      fromName: leg.from.name ?? "",
      to: leg.to.code,
      toName: leg.to.name ?? "",
      leaves: draftOf(leg.leaves),
      arrives: draftOf(leg.arrives),
    }));
  } else if (booking.kind === "stay") {
    Object.assign(draft, { name: booking.name, address: booking.address ?? "", checkIn: draftOf(booking.checkIn), checkOut: draftOf(booking.checkOut) });
  } else if (booking.kind === "journey") {
    Object.assign(draft, {
      by: booking.by,
      from: booking.from,
      to: booking.to,
      leaves: draftOf(booking.leaves),
      arrives: draftOf(booking.arrives),
      hasArrival: booking.arrives !== undefined,
      operator: booking.operator ?? "",
      service: booking.service ?? "",
      seat: booking.seat ?? "",
    });
  } else {
    Object.assign(draft, { sort: booking.sort, title: booking.title, where: booking.where ?? "", starts: draftOf(booking.starts), ends: draftOf(booking.ends), hasEnd: booking.ends !== undefined });
  }
  return draft;
}

/** The booking a draft gives, for the bookings package to check online. */
function bookingOf(draft: Draft, id: string, revision: number): Booking {
  const details: Details = {};
  for (const key of ["reference", "provider", "link", "notes", "page"] as const) {
    const value = draft.details[key]?.trim();
    if (value) details[key] = value;
  }
  const common = { id, revision, travellers: [...draft.travellers].sort(), details };
  const optional = <K extends string>(key: K, value: string) => (value.trim() ? ({ [key]: value.trim() } as Record<K, string>) : {});
  switch (draft.kind) {
    case "flight":
      return {
        ...common,
        kind: "flight",
        seats: [],
        legs: draft.legs.map((leg) => ({
          flight: leg.flight.trim().toUpperCase(),
          from: { code: leg.from.trim().toUpperCase(), ...optional("name", leg.fromName) },
          to: { code: leg.to.trim().toUpperCase(), ...optional("name", leg.toName) },
          leaves: timeOf(leg.leaves),
          arrives: timeOf(leg.arrives),
        })),
      } as FlightBooking;
    case "stay":
      return { ...common, kind: "stay", name: draft.name.trim(), ...optional("address", draft.address), checkIn: timeOf(draft.checkIn), checkOut: timeOf(draft.checkOut) } as StayBooking;
    case "journey":
      return {
        ...common,
        kind: "journey",
        by: draft.by,
        from: draft.from.trim(),
        to: draft.to.trim(),
        leaves: timeOf(draft.leaves),
        ...(draft.hasArrival ? { arrives: timeOf(draft.arrives) } : {}),
        ...optional("operator", draft.operator),
        ...optional("service", draft.service),
        ...optional("seat", draft.seat),
      } as JourneyBooking;
    case "activity":
      return {
        ...common,
        kind: "activity",
        sort: draft.sort,
        title: draft.title.trim(),
        ...optional("where", draft.where),
        starts: timeOf(draft.starts),
        ...(draft.hasEnd ? { ends: timeOf(draft.ends) } : {}),
      } as ActivityBooking;
  }
}

/** Fills a time's zone from a place, where the traveller has not chosen one. */
const zoned = (time: TimeDraft, zone: string): TimeDraft => (time.zone.trim() ? time : { ...time, zone });

/** Adding or changing a booking: its kind first, then that kind's form (BKG-F1, §4.5). */
export function BookingForm({ copy, account, id }: { copy: Copy; account: string; id?: string }) {
  const canChange = useCanChange();
  const held = id ? copy.bookings.find((b) => b.id === id) : undefined;
  const [draft, setDraft] = useState<Draft | undefined>(held ? draftOfBooking(held) : undefined);
  const [base, setBase] = useState(held?.revision ?? 0);
  const [theirs, setTheirs] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const back = held ? bookingPath(copy, held.id) : tripPath(copy.id, "/bookings");
  const members = copy.members.filter((m) => !m.removed);

  if (!draft) {
    return (
      <main class="screen narrow" data-screen="booking-kind">
        <Title back={{ href: back, label: "Bookings" }}>Add a booking</Title>
        <Group heading="What is it?">
          {(["flight", "stay", "journey", "activity"] as const).map((kind) => (
            <Row key={kind} onClick={() => setDraft(newDraft(kind, account))}>
              <span data-kind={kind}>{KIND_WORDS[kind]}</span>
            </Row>
          ))}
        </Group>
      </main>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setLeg = (at: number, patch: Partial<LegDraft>) => set({ legs: draft.legs.map((leg, i) => (i === at ? { ...leg, ...patch } : leg)) });

  const save = async (event: Event) => {
    event.preventDefault();
    setSaving(true);
    const booking = bookingOf(draft, held?.id ?? `b-${crypto.randomUUID().slice(0, 12)}`, held ? base : 0);
    const change = held ? changeToText({ op: "change", booking, base }) : changeToText({ op: "add", booking });
    const result = await store.send(copy.id, "bookings", change);
    setSaving(false);
    if (result.ok) return go(bookingPath(copy, booking.id), true);
    if (result.refusal.code === "stale") {
      setTheirs(result.refusal.details?.["booking"]);
      setBase(Number(result.refusal.details?.["revision"] ?? base));
      return setError("Another traveller changed this booking while you were. It is shown as it now stands: change yours to match, and save again.");
    }
    setError(result.refusal.message);
  };

  return (
    <main class="screen narrow" data-screen="booking-form" data-kind={draft.kind}>
      <Title back={{ href: back, label: "Cancel" }}>{held ? `Edit ${KIND_WORDS[draft.kind].toLowerCase()}` : KIND_WORDS[draft.kind]}</Title>
      <form class="form" onSubmit={save}>
        {draft.kind === "flight"
          ? draft.legs.map((leg, i) => (
              <fieldset class="group-form" key={i} data-leg={i}>
                <legend class="group-heading">{draft.legs.length > 1 ? `Flight ${i + 1}` : "Flight"}</legend>
                <Field label="Flight number">
                  <input name={`leg-${i}-flight`} value={leg.flight} placeholder="LA 800" autocapitalize="characters" onInput={(e) => setLeg(i, { flight: e.currentTarget.value })} required />
                </Field>
                <div class="field-pair">
                  <Field label="From">
                    <input
                      name={`leg-${i}-from`}
                      value={leg.from}
                      maxLength={3}
                      placeholder="SCL"
                      autocapitalize="characters"
                      onInput={async (e) => {
                        const code = e.currentTarget.value.toUpperCase();
                        const airport = code.length === 3 ? await places.airport(code) : undefined;
                        setLeg(i, { from: code, ...(airport ? { fromName: airport.town ?? airport.name, leaves: zoned(leg.leaves, airport.zone) } : {}) });
                      }}
                      required
                    />
                  </Field>
                  <Field label="To">
                    <input
                      name={`leg-${i}-to`}
                      value={leg.to}
                      maxLength={3}
                      placeholder="PUQ"
                      autocapitalize="characters"
                      onInput={async (e) => {
                        const code = e.currentTarget.value.toUpperCase();
                        const airport = code.length === 3 ? await places.airport(code) : undefined;
                        setLeg(i, { to: code, ...(airport ? { toName: airport.town ?? airport.name, arrives: zoned(leg.arrives, airport.zone) } : {}) });
                      }}
                      required
                    />
                  </Field>
                </div>
                <TimeField label="Leaves" name={`leg-${i}-leaves`} value={leg.leaves} onChange={(leaves) => setLeg(i, { leaves })} />
                <TimeField label="Arrives" name={`leg-${i}-arrives`} value={leg.arrives} onChange={(arrives) => setLeg(i, { arrives })} />
                {draft.legs.length > 1 ? (
                  <Button kind="plain" class="danger-text" onClick={() => set({ legs: draft.legs.filter((_, at) => at !== i) })}>
                    Remove this flight
                  </Button>
                ) : null}
              </fieldset>
            ))
          : null}
        {draft.kind === "flight" && draft.legs.length < 8 ? (
          <Button kind="plain" onClick={() => set({ legs: [...draft.legs, emptyLeg()] })} data-action="add-leg">
            Add a connecting flight
          </Button>
        ) : null}

        {draft.kind === "stay" ? (
          <>
            <Field label="Name">
              <input name="name" value={draft.name} placeholder="Hostal Lady Florence" onInput={(e) => set({ name: e.currentTarget.value })} required />
            </Field>
            <TownField
              label="Town"
              name="town"
              value={draft.town}
              onChange={(town) => set({ town })}
              onPlace={(place) => set({ town: place.name, checkIn: zoned(draft.checkIn, place.zone), checkOut: zoned(draft.checkOut, place.zone) })}
            />
            <Field label="Address">
              <input name="address" value={draft.address} onInput={(e) => set({ address: e.currentTarget.value })} />
            </Field>
            <TimeField label="Check in" name="check-in" value={draft.checkIn} onChange={(checkIn) => set({ checkIn })} />
            <TimeField label="Check out" name="check-out" value={draft.checkOut} onChange={(checkOut) => set({ checkOut })} />
          </>
        ) : null}

        {draft.kind === "journey" ? (
          <>
            <Field label="How">
              <select name="by" value={draft.by} onChange={(e) => set({ by: e.currentTarget.value as Way })}>
                <option value="train">Train</option>
                <option value="bus">Bus</option>
                <option value="ferry">Ferry</option>
                <option value="car">Hired car</option>
              </select>
            </Field>
            <TownField label="From" name="from" value={draft.from} onChange={(from) => set({ from })} onPlace={(place) => set({ from: place.name, leaves: zoned(draft.leaves, place.zone) })} />
            <TownField label="To" name="to" value={draft.to} onChange={(to) => set({ to })} onPlace={(place) => set({ to: place.name, arrives: zoned(draft.arrives, place.zone) })} />
            <TimeField label="Leaves" name="leaves" value={draft.leaves} onChange={(leaves) => set({ leaves })} />
            <label class="check">
              <input type="checkbox" name="has-arrival" checked={draft.hasArrival} onChange={(e) => set({ hasArrival: e.currentTarget.checked })} />
              It has an arrival time
            </label>
            {draft.hasArrival ? <TimeField label="Arrives" name="arrives" value={draft.arrives} onChange={(arrives) => set({ arrives })} /> : null}
            <Field label="With">
              <input name="operator" value={draft.operator} placeholder="Bus-Sur" onInput={(e) => set({ operator: e.currentTarget.value })} />
            </Field>
            <div class="field-pair">
              <Field label="Service">
                <input name="service" value={draft.service} onInput={(e) => set({ service: e.currentTarget.value })} />
              </Field>
              <Field label="Seat">
                <input name="seat" value={draft.seat} onInput={(e) => set({ seat: e.currentTarget.value })} />
              </Field>
            </div>
          </>
        ) : null}

        {draft.kind === "activity" ? (
          <>
            <Field label="What">
              <select name="sort" value={draft.sort} onChange={(e) => set({ sort: e.currentTarget.value as Sort })}>
                <option value="tour">Tour</option>
                <option value="ticket">Ticket</option>
                <option value="table">Table</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Title">
              <input name="title" value={draft.title} placeholder="Torres del Paine full day" onInput={(e) => set({ title: e.currentTarget.value })} required />
            </Field>
            <TownField label="Where" name="where" value={draft.where} onChange={(where) => set({ where })} onPlace={(place) => set({ where: place.name, starts: zoned(draft.starts, place.zone), ends: zoned(draft.ends, place.zone) })} />
            <TimeField label="Starts" name="starts" value={draft.starts} onChange={(starts) => set({ starts })} />
            <label class="check">
              <input type="checkbox" name="has-end" checked={draft.hasEnd} onChange={(e) => set({ hasEnd: e.currentTarget.checked })} />
              It has an end time
            </label>
            {draft.hasEnd ? <TimeField label="Ends" name="ends" value={draft.ends} onChange={(ends) => set({ ends })} /> : null}
          </>
        ) : null}

        <fieldset class="group-form">
          <legend class="group-heading">For</legend>
          {members.map((member) => (
            <label class="check" key={member.account}>
              <input
                type="checkbox"
                name="traveller"
                value={member.account}
                checked={draft.travellers.includes(member.account)}
                onChange={(e) =>
                  set({ travellers: e.currentTarget.checked ? [...draft.travellers, member.account] : draft.travellers.filter((t) => t !== member.account) })
                }
              />
              {member.name}
            </label>
          ))}
        </fieldset>

        <fieldset class="group-form">
          <legend class="group-heading">Details</legend>
          <div class="field-pair">
            <Field label="Reference">
              <input name="reference" value={draft.details.reference ?? ""} autocapitalize="characters" autocomplete="off" onInput={(e) => set({ details: { ...draft.details, reference: e.currentTarget.value } })} />
            </Field>
            <Field label="Booked with">
              <input name="provider" value={draft.details.provider ?? ""} onInput={(e) => set({ details: { ...draft.details, provider: e.currentTarget.value } })} />
            </Field>
          </div>
          <Field label="Link">
            <input name="link" type="url" inputMode="url" value={draft.details.link ?? ""} placeholder="https://" onInput={(e) => set({ details: { ...draft.details, link: e.currentTarget.value } })} />
          </Field>
          <Field label="Notes">
            <textarea name="notes" rows={3} value={draft.details.notes ?? ""} onInput={(e) => set({ details: { ...draft.details, notes: e.currentTarget.value } })} />
          </Field>
        </fieldset>

        {theirs ? (
          <section class="theirs" data-theirs>
            <h2 class="group-heading">The booking as it now stands</h2>
            <pre>{theirs}</pre>
          </section>
        ) : null}
        <Refused message={error} />
        <Button type="submit" disabled={!canChange || saving} data-action="save-booking">
          {held ? "Save" : "Add booking"}
        </Button>
      </form>
    </main>
  );
}

