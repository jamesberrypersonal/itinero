// The calendar, shown only to a traveller granted it: each day's countries, its stretches drawn
// pencilled, and its firm items and bookings standing apart from them, in the order they happen
// (docs/spec/web/screens.md §4.4, WEB:SCREENS-F3).

import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { extent as bookingExtent, label as bookingLabel } from "@itinero/bookings";
import { changeToText, countries, travelDuration, type Change, type FirmItem, type Stretch, type Way, type When } from "@itinero/itinerary";
import { forPhone, state } from "@itinero/pages";
import { format, formatDuration, type TextStyle, type TripTime } from "@itinero/trip-time";
import * as store from "../store/index.ts";
import { allows } from "./access.ts";
import type { Copy } from "../store/index.ts";
import { calendarDays, type CalendarDay, type Fixed } from "./calendar-days.ts";
import { Link } from "./router.tsx";
import { useCanChange, useStyle } from "./state.ts";
import { draftOf, emptyTime, timeOf, TimeField, TownField, type TimeDraft } from "./time-field.tsx";
import { TripMenu } from "./trip.tsx";
import { Button, Confirm, Empty, Field, Refused, Title } from "./ui.tsx";
import { dateWords } from "./words.ts";

const tripPath = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;
const COUNTRIES = countries();
const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]));
const WAYS: { way: Way; words: string }[] = [
  { way: "flight", words: "Flight" },
  { way: "train", words: "Train" },
  { way: "bus", words: "Bus" },
  { way: "ferry", words: "Ferry" },
  { way: "car", words: "Car" },
  { way: "other", words: "Other" },
];
/** A firm item's time always holds a time: a date alone is a day (spec/planner/itinerary.md §4.4). */
const TIMED: readonly TripTime["kind"][] = ["exact", "approx", "part", "window"];

/** Whether the traveller may change the calendar, from the copy's grants. */
function mayEdit(copy: Copy, account: string): boolean {
  return allows(copy, account, { kind: "change-calendar" });
}

/** A link to a page a stretch or a firm item names, or Not available where the traveller cannot open it (PLN-F11). */
function PageLink({ copy, page, children }: { copy: Copy; page: string | undefined; children: ComponentChildren }) {
  if (page === undefined) return <span class="cal-name">{children}</span>;
  const seen = forPhone(copy.pages).pages.some((p) => p.id === page);
  if (!seen || state(copy.pages, page) !== "tree") {
    return (
      <span class="cal-name">
        {children} <span class="unavailable">Page not available</span>
      </span>
    );
  }
  return (
    <Link class="cal-name" href={tripPath(copy.id, `/pages/${encodeURIComponent(page)}`)} data-page={page}>
      {children}
    </Link>
  );
}

const placeWords = (stretch: Stretch) => stretch.place.name ?? COUNTRY_NAMES.get(stretch.place.country) ?? stretch.place.country;
const whenWords = (when: When, style: TextStyle) => (when.kind === "day" ? "All day" : format(when, style));

type Editing =
  | { kind: "choose"; date: string }
  | { kind: "stretch"; stretch?: Stretch; date: string }
  | { kind: "firm"; item?: FirmItem; date: string };

/** The calendar (§4.4). */
export function Calendar({ copy, account }: { copy: Copy; account: string }) {
  const canChange = useCanChange();
  const style = useStyle();
  const trip = copy.calendar!;
  const days = useMemo(() => calendarDays(trip, copy.dates, copy.bookings), [trip, copy.dates, copy.bookings]);
  const edit = canChange && mayEdit(copy, account);
  const [editing, setEditing] = useState<Editing>();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState<{ stretch: Stretch; end: "first" | "last"; over?: string }>();
  const lead = days.length ? (new Date(`${days[0]!.date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;

  const send = async (change: Change) => {
    const result = await store.send(copy.id, "calendar", changeToText(change));
    if (!result.ok) {
      setError(result.refusal.message);
      return result;
    }
    setError(undefined);
    return result;
  };

  /** A stretch's end dragged to another day: the day under the pointer (PLN-F1). */
  const dragEnd = (event: PointerEvent, stretch: Stretch, end: "first" | "last", phase: "down" | "move" | "up") => {
    if (phase === "down") {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      setDragging({ stretch, end });
      return;
    }
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-date]")?.dataset["date"];
    if (phase === "move") {
      if (dragging && under !== dragging.over) setDragging({ ...dragging, ...(under ? { over: under } : {}) });
      return;
    }
    setDragging(undefined);
    if (!under) return;
    const first = end === "first" ? under : stretch.first;
    const last = end === "last" ? under : stretch.last;
    if (first === stretch.first && last === stretch.last) return;
    if (last < first) return setError("A stretch's last day cannot come before its first.");
    void send({ op: "move", id: stretch.id, first, last });
  };

  const covered = (date: string) => dragging?.over !== undefined && (dragging.end === "first" ? dragging.over <= date && date <= dragging.stretch.last : dragging.stretch.first <= date && date <= dragging.over);

  return (
    <main class="screen wide-screen" data-screen="calendar">
      <Title action={<TripMenu id={copy.id} />}>Calendar</Title>
      <Refused message={error} />
      {days.length === 0 ? <Empty>Nothing on the calendar yet.</Empty> : null}
      <ol class="calendar" aria-label="Days">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`pad-${i}`} class="cal-pad" aria-hidden="true" />
        ))}
        {days.map((day) => (
          <Day
            key={day.date}
            copy={copy}
            day={day}
            style={style}
            edit={edit}
            target={covered(day.date)}
            onAdd={() => setEditing({ kind: "choose", date: day.date })}
            onStretch={(stretch) => setEditing({ kind: "stretch", stretch, date: day.date })}
            onFirm={(item) => setEditing({ kind: "firm", item, date: day.date })}
            onDrag={dragEnd}
          />
        ))}
      </ol>
      {editing?.kind === "choose" ? (
        <Sheet title={`Add to ${dateWords(editing.date, style, { weekday: true })}`} onClose={() => setEditing(undefined)}>
          <div class="sheet-choices">
            <Button kind="plain" onClick={() => setEditing({ kind: "stretch", date: editing.date })} data-action="add-stretch">
              A stretch, pencilled
            </Button>
            <Button kind="plain" onClick={() => setEditing({ kind: "firm", date: editing.date })} data-action="add-firm">
              A firm item
            </Button>
          </div>
        </Sheet>
      ) : null}
      {editing?.kind === "stretch" ? <StretchForm copy={copy} stretch={editing.stretch} date={editing.date} send={send} close={() => setEditing(undefined)} /> : null}
      {editing?.kind === "firm" ? <FirmForm copy={copy} item={editing.item} date={editing.date} close={() => setEditing(undefined)} /> : null}
    </main>
  );
}

function Day({
  copy,
  day,
  style,
  edit,
  target,
  onAdd,
  onStretch,
  onFirm,
  onDrag,
}: {
  copy: Copy;
  day: CalendarDay;
  style: TextStyle;
  edit: boolean;
  target: boolean;
  onAdd: () => void;
  onStretch: (stretch: Stretch) => void;
  onFirm: (item: FirmItem) => void;
  onDrag: (event: PointerEvent, stretch: Stretch, end: "first" | "last", phase: "down" | "move" | "up") => void;
}) {
  const handle = (stretch: Stretch, end: "first" | "last") => (
    <span
      class={`cal-handle cal-handle-${end}`}
      role="button"
      tabIndex={-1}
      aria-label={end === "first" ? `Drag to change when ${placeWords(stretch)} starts` : `Drag to change when ${placeWords(stretch)} ends`}
      data-action="resize-stretch"
      data-end={end}
      onPointerDown={(e) => onDrag(e, stretch, end, "down")}
      onPointerMove={(e) => onDrag(e, stretch, end, "move")}
      onPointerUp={(e) => onDrag(e, stretch, end, "up")}
    />
  );
  return (
    <li class={`cal-day${target ? " cal-target" : ""}`} data-date={day.date}>
      <header class="cal-date">
        <span class="cal-weekday">{dateWords(day.date, style, { weekday: true })}</span>
        {day.countries.length ? (
          <span class="cal-countries" data-countries={day.countries.join(" ")}>
            {day.countries.map((c) => COUNTRY_NAMES.get(c) ?? c).join(", ")}
          </span>
        ) : null}
      </header>
      {day.stretches.map((stretch) => (
        <div key={stretch.id} class="stretch" data-stretch={stretch.id} data-pencilled="">
          {edit && stretch.first === day.date ? handle(stretch, "first") : null}
          <PageLink copy={copy} page={stretch.page}>
            {placeWords(stretch)}
          </PageLink>
          {edit ? (
            <button type="button" class="cal-edit" aria-label={`Change ${placeWords(stretch)}`} data-action="edit-stretch" onClick={() => onStretch(stretch)}>
              <Pencil />
            </button>
          ) : null}
          {edit && stretch.last === day.date ? handle(stretch, "last") : null}
        </div>
      ))}
      {day.fixed.map((fixed) => (
        <FixedCard key={fixed.kind === "firm" ? `f-${fixed.item.id}` : `b-${fixed.booking.id}`} copy={copy} fixed={fixed} style={style} edit={edit} onFirm={onFirm} />
      ))}
      {edit ? (
        <button type="button" class="cal-add" data-action="add-to-day" aria-label={`Add to ${dateWords(day.date, style)}`} onClick={onAdd}>
          +
        </button>
      ) : null}
    </li>
  );
}

function FixedCard({ copy, fixed, style, edit, onFirm }: { copy: Copy; fixed: Fixed; style: TextStyle; edit: boolean; onFirm: (item: FirmItem) => void }) {
  if (fixed.kind === "booking") {
    const booking = fixed.booking;
    const { starts } = bookingExtent(booking);
    return (
      <Link class="fixed fixed-booking" href={tripPath(copy.id, `/bookings/${encodeURIComponent(booking.id)}`)} data-booking={booking.id}>
        <span class="fixed-title">{bookingLabel(booking)}</span>
        <span class="fixed-when">{format(starts, style)}</span>
      </Link>
    );
  }
  const item = fixed.item;
  const took = travelDuration(item);
  return (
    <div class="fixed" data-firm={item.id}>
      <PageLink copy={copy} page={item.page}>
        <span class="fixed-title">{item.title}</span>
      </PageLink>
      <span class="fixed-when">
        {whenWords(item.when, style)}
        {item.travel ? ` · ${COUNTRY_NAMES.get(item.travel.from.country) ?? ""}${item.travel.from.name ? ` (${item.travel.from.name})` : ""} to ${item.travel.to.name ?? COUNTRY_NAMES.get(item.travel.to.country) ?? ""}` : ""}
        {took ? ` · ${formatDuration(took)}` : ""}
      </span>
      {edit ? (
        <button type="button" class="cal-edit" aria-label={`Change ${item.title}`} data-action="edit-firm" onClick={() => onFirm(item)}>
          <Pencil />
        </button>
      ) : null}
    </div>
  );
}

function Pencil() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  );
}

/** A form drawn over the calendar, closed with Escape, a tap outside, or Cancel. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  // Listened for on the window, since Safari leaves the focus where it was when a button is clicked.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // A dialog asking first, drawn over the sheet, takes its own Escape.
      if (event.key === "Escape" && !document.querySelector('[role="alertdialog"]')) onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div class="scrim" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div class="dialog sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="title-row">
          <h2>{title}</h2>
          <Button kind="plain" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CountrySelect({ label, value, onChange, name }: { label: string; value: string; onChange: (code: string) => void; name: string }) {
  return (
    <Field label={label}>
      <select name={name} value={value} onChange={(e) => onChange(e.currentTarget.value)} required>
        <option value="" disabled>
          Choose a country
        </option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PageSelect({ copy, value, onChange }: { copy: Copy; value: string; onChange: (page: string) => void }) {
  const pages = [...forPhone(copy.pages).pages].sort((a, b) => a.title.localeCompare(b.title));
  return (
    <Field label="Page">
      <select name="page" value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        <option value="">No page</option>
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </Field>
  );
}

type Send = (change: Change) => Promise<{ ok: boolean }>;

/** Pencilling a stretch, or changing its place or dates, from a day (PLN-F1). */
function StretchForm({ copy, stretch, date, send, close }: { copy: Copy; stretch: Stretch | undefined; date: string; send: Send; close: () => void }) {
  const [country, setCountry] = useState(stretch?.place.country ?? copy.calendar?.stretches.at(-1)?.place.country ?? "");
  const [name, setName] = useState(stretch?.place.name ?? "");
  const [first, setFirst] = useState(stretch?.first ?? date);
  const [last, setLast] = useState(stretch?.last ?? date);
  const [page, setPage] = useState(stretch?.page ?? "");
  const [asking, setAsking] = useState(false);
  const place = () => (name.trim() ? { country, name: name.trim() } : { country });

  const save = async (event: Event) => {
    event.preventDefault();
    if (!stretch) {
      const made: Stretch = { id: `s-${crypto.randomUUID().slice(0, 12)}`, place: place(), first, last, ...(page ? { page } : {}) };
      if ((await send({ op: "pencil", stretch: made })).ok) close();
      return;
    }
    const placed = place();
    if (placed.country !== stretch.place.country || placed.name !== stretch.place.name) {
      if (!(await send({ op: "re-place", id: stretch.id, place: placed })).ok) return;
    }
    if (first !== stretch.first || last !== stretch.last) {
      if (!(await send({ op: "move", id: stretch.id, first, last })).ok) return;
    }
    close();
  };

  return (
    <Sheet title={stretch ? `Change ${placeWords(stretch)}` : "Pencil a stretch"} onClose={close}>
      <form class="form" onSubmit={save} data-form="stretch">
        <CountrySelect label="Country" name="country" value={country} onChange={setCountry} />
        <TownField label="Place in it (optional)" name="place" value={name} onChange={setName} onPlace={(found) => (setName(found.name), setCountry(found.country))} />
        <div class="field-pair">
          <Field label="First day">
            <input type="date" name="first" value={first} onInput={(e) => setFirst(e.currentTarget.value)} required />
          </Field>
          <Field label="Last day">
            <input type="date" name="last" value={last} min={first} onInput={(e) => setLast(e.currentTarget.value)} required />
          </Field>
        </div>
        {stretch ? null : <PageSelect copy={copy} value={page} onChange={setPage} />}
        <Button type="submit" data-action="save-stretch">
          {stretch ? "Save" : "Pencil it in"}
        </Button>
        {stretch ? (
          <Button kind="plain" class="danger-text" onClick={() => setAsking(true)} data-action="remove-stretch">
            Remove the stretch
          </Button>
        ) : null}
      </form>
      {asking && stretch ? (
        <Confirm
          title={`Remove ${placeWords(stretch)}?`}
          message={`The stretch from ${stretch.first} to ${stretch.last} will be removed from the calendar.`}
          confirm="Remove"
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            if ((await send({ op: "remove-stretch", id: stretch.id })).ok) close();
          }}
        />
      ) : null}
    </Sheet>
  );
}

type FirmDraft = {
  title: string;
  allDay: boolean;
  day: string;
  when: TimeDraft;
  travel: boolean;
  by: Way;
  fromCountry: string;
  fromName: string;
  toCountry: string;
  toName: string;
  hasArrival: boolean;
  arrive: TimeDraft;
  page: string;
};

function firmDraft(item: FirmItem | undefined, date: string): FirmDraft {
  const time = (when: When | undefined, fallback: string): TimeDraft => (when && when.kind !== "day" ? draftOf(when) : { ...emptyTime(), date: when?.kind === "day" ? when.date : fallback });
  return {
    title: item?.title ?? "",
    allDay: item ? item.when.kind === "day" : false,
    day: item?.when.kind === "day" ? item.when.date : (item?.when as TripTime | undefined)?.date ?? date,
    when: time(item?.when, date),
    travel: item?.travel !== undefined,
    by: item?.travel?.by ?? "train",
    fromCountry: item?.travel?.from.country ?? "",
    fromName: item?.travel?.from.name ?? "",
    toCountry: item?.travel?.to.country ?? "",
    toName: item?.travel?.to.name ?? "",
    hasArrival: item?.travel?.arrive !== undefined,
    arrive: time(item?.travel?.arrive, date),
    page: item?.page ?? "",
  };
}

const zoned = (time: TimeDraft, zone: string): TimeDraft => (time.zone.trim() ? time : { ...time, zone });

/**
 * Adding a firm item from a day, or changing one. Travel asks how it goes, and for each end its
 * place and its time, with the zone filled in from the town (PLN-F3, PLN-F4). A change made from
 * an older revision shows the item as it now stands (PLN:ITINERARY-F11).
 */
function FirmForm({ copy, item, date, close }: { copy: Copy; item: FirmItem | undefined; date: string; close: () => void }) {
  const [draft, setDraft] = useState(() => firmDraft(item, date));
  const [base, setBase] = useState(item?.revision ?? 0);
  const [theirs, setTheirs] = useState<string>();
  const [error, setError] = useState<string>();
  const [asking, setAsking] = useState(false);
  const id = useRef(item?.id ?? `f-${crypto.randomUUID().slice(0, 12)}`);
  const set = (patch: Partial<FirmDraft>) => setDraft({ ...draft, ...patch });

  const save = async (event: Event) => {
    event.preventDefault();
    const when: When = draft.allDay ? { kind: "day", date: draft.day } : timeOf(draft.when);
    const made: FirmItem = {
      id: id.current,
      revision: item ? base : 0,
      title: draft.title.trim(),
      when,
      ...(draft.travel
        ? {
            travel: {
              by: draft.by,
              from: draft.fromName.trim() ? { country: draft.fromCountry, name: draft.fromName.trim() } : { country: draft.fromCountry },
              to: draft.toName.trim() ? { country: draft.toCountry, name: draft.toName.trim() } : { country: draft.toCountry },
              ...(draft.hasArrival ? { arrive: draft.allDay ? { kind: "day" as const, date: draft.arrive.date } : timeOf(draft.arrive) } : {}),
            },
          }
        : {}),
      ...(draft.page ? { page: draft.page } : {}),
    };
    const result = await store.send(copy.id, "calendar", changeToText(item ? { op: "change-firm", item: made, base } : { op: "add-firm", item: made }));
    if (result.ok) return close();
    if (result.refusal.code === "stale") {
      setTheirs(result.refusal.details?.["item"]);
      setBase(Number(result.refusal.details?.["revision"] ?? base));
      return setError("Another traveller changed this item while you were. It is shown as it now stands: change yours to match, and save again.");
    }
    setError(result.refusal.message);
  };

  return (
    <Sheet title={item ? `Change ${item.title}` : "Add a firm item"} onClose={close}>
      <form class="form" onSubmit={save} data-form="firm">
        <Field label="What">
          <input name="title" value={draft.title} onInput={(e) => set({ title: e.currentTarget.value })} required />
        </Field>
        <label class="check">
          <input type="checkbox" name="all-day" checked={draft.allDay} onChange={(e) => set({ allDay: e.currentTarget.checked })} />
          All day, with no time
        </label>
        {draft.allDay ? (
          <Field label="Day">
            <input type="date" name="day" value={draft.day} onInput={(e) => set({ day: e.currentTarget.value })} required />
          </Field>
        ) : (
          <TimeField label={draft.travel ? "Leaves" : "When"} name="when" kinds={TIMED} value={draft.when} onChange={(when) => set({ when })} />
        )}
        <label class="check">
          <input type="checkbox" name="travel" checked={draft.travel} onChange={(e) => set({ travel: e.currentTarget.checked })} />
          This is travel
        </label>
        {draft.travel ? (
          <fieldset class="group-form">
            <legend class="group-heading">Travel</legend>
            <Field label="By">
              <select name="by" value={draft.by} onChange={(e) => set({ by: e.currentTarget.value as Way })}>
                {WAYS.map((w) => (
                  <option key={w.way} value={w.way}>
                    {w.words}
                  </option>
                ))}
              </select>
            </Field>
            <CountrySelect label="From country" name="from-country" value={draft.fromCountry} onChange={(fromCountry) => set({ fromCountry })} />
            <TownField
              label="From"
              name="from"
              value={draft.fromName}
              onChange={(fromName) => set({ fromName })}
              onPlace={(place) => set({ fromName: place.name, fromCountry: place.country, when: zoned(draft.when, place.zone) })}
            />
            <CountrySelect label="To country" name="to-country" value={draft.toCountry} onChange={(toCountry) => set({ toCountry })} />
            <TownField
              label="To"
              name="to"
              value={draft.toName}
              onChange={(toName) => set({ toName })}
              onPlace={(place) => set({ toName: place.name, toCountry: place.country, arrive: zoned(draft.arrive, place.zone) })}
            />
            <label class="check">
              <input type="checkbox" name="has-arrival" checked={draft.hasArrival} onChange={(e) => set({ hasArrival: e.currentTarget.checked })} />
              It arrives at a known time
            </label>
            {draft.hasArrival ? (
              draft.allDay ? (
                <Field label="Arrives on">
                  <input type="date" name="arrive-day" value={draft.arrive.date} onInput={(e) => set({ arrive: { ...draft.arrive, date: e.currentTarget.value } })} required />
                </Field>
              ) : (
                <TimeField label="Arrives" name="arrive" kinds={TIMED} value={draft.arrive} onChange={(arrive) => set({ arrive })} />
              )
            ) : null}
          </fieldset>
        ) : null}
        <PageSelect copy={copy} value={draft.page} onChange={(page) => set({ page })} />
        {theirs ? (
          <section class="theirs" data-theirs>
            <h2 class="group-heading">The item as it now stands</h2>
            <pre>{theirs}</pre>
          </section>
        ) : null}
        <Refused message={error} />
        <Button type="submit" disabled={!draft.title.trim()} data-action="save-firm">
          {item ? "Save" : "Add it"}
        </Button>
        {item ? (
          <Button kind="plain" class="danger-text" onClick={() => setAsking(true)} data-action="remove-firm">
            Remove the item
          </Button>
        ) : null}
      </form>
      {asking && item ? (
        <Confirm
          title={`Remove ${item.title}?`}
          message={`${item.title} will be removed from the calendar.`}
          confirm="Remove"
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            const result = await store.send(copy.id, "calendar", changeToText({ op: "remove-firm", id: item.id }));
            if (result.ok) close();
            else setError(result.refusal.message);
          }}
        />
      ) : null}
    </Sheet>
  );
}
