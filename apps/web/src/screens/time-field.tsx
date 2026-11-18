// A time in a booking's form: its precision, its date, its clock times and its zone
// (docs/spec/web/screens.md §4.5). The zone is filled in from web/places where the form knows the
// place, and the traveller may choose another from trip-time's zones (WEB-F9).

import { useEffect, useState } from "preact/hooks";
import type { PartOfDay, TripTime } from "@itinero/trip-time";
import * as places from "../places/index.ts";
import type { Place } from "../places/index.ts";
import { zoneNames } from "../shell/index.ts";
import { Field } from "./ui.tsx";

export type TimeDraft = {
  kind: TripTime["kind"];
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  part: PartOfDay;
  zone: string;
};

export const emptyTime = (zone = "", kind: TripTime["kind"] = "exact"): TimeDraft => ({ kind, date: "", time: "", endDate: "", endTime: "", part: "morning", zone });

/** The draft of a time held, to change it. */
export function draftOf(value: TripTime | undefined, fallbackKind: TripTime["kind"] = "exact"): TimeDraft {
  if (!value) return emptyTime("", fallbackKind);
  const draft = emptyTime(value.zone, value.kind);
  draft.date = value.date;
  if (value.kind === "exact" || value.kind === "approx") draft.time = value.at.time;
  if (value.kind === "part") draft.part = value.part;
  if (value.kind === "window") {
    draft.time = value.from.time;
    draft.endDate = value.endDate;
    draft.endTime = value.to.time;
  }
  return draft;
}

/** The time a draft gives, for the bookings package to check. */
export function timeOf(draft: TimeDraft): TripTime {
  const base = { zone: draft.zone.trim(), date: draft.date };
  switch (draft.kind) {
    case "exact":
      return { kind: "exact", ...base, at: { time: draft.time } };
    case "approx":
      return { kind: "approx", ...base, at: { time: draft.time } };
    case "part":
      return { kind: "part", ...base, part: draft.part };
    case "window":
      return { kind: "window", ...base, from: { time: draft.time }, endDate: draft.endDate || draft.date, to: { time: draft.endTime } };
    case "date":
      return { kind: "date", ...base };
    case "tbd":
      return { kind: "tbd", ...base };
  }
}

const KINDS: { kind: TripTime["kind"]; words: string }[] = [
  { kind: "exact", words: "At a time" },
  { kind: "approx", words: "At about" },
  { kind: "part", words: "In the" },
  { kind: "window", words: "Between" },
  { kind: "date", words: "On the date" },
  { kind: "tbd", words: "Time to be decided" },
];

/** The zones a traveller may choose from, typing part of a city's name. */
function ZoneList() {
  const [zones, setZones] = useState<readonly string[]>([]);
  useEffect(() => {
    void zoneNames().then(setZones);
  }, []);
  return (
    <datalist id="zones">
      {zones.map((zone) => (
        <option key={zone} value={zone} />
      ))}
    </datalist>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  name,
  kinds,
}: {
  label: string;
  value: TimeDraft;
  onChange: (next: TimeDraft) => void;
  name: string;
  /** The precisions offered, where not every one is: a firm item's time always holds a time. */
  kinds?: readonly TripTime["kind"][];
}) {
  const set = (patch: Partial<TimeDraft>) => onChange({ ...value, ...patch });
  return (
    <fieldset class="time-field" data-time={name}>
      <legend class="field-label">{label}</legend>
      <ZoneList />
      <select aria-label={`${label}: precision`} name={`${name}-kind`} value={value.kind} onChange={(e) => set({ kind: e.currentTarget.value as TripTime["kind"] })}>
        {KINDS.filter((k) => !kinds || kinds.includes(k.kind)).map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.words}
          </option>
        ))}
      </select>
      <div class="field-pair">
        <input aria-label={`${label}: date`} type="date" name={`${name}-date`} value={value.date} onInput={(e) => set({ date: e.currentTarget.value })} required />
        {value.kind === "exact" || value.kind === "approx" || value.kind === "window" ? (
          <input aria-label={`${label}: time`} type="time" name={`${name}-time`} value={value.time} onInput={(e) => set({ time: e.currentTarget.value })} required />
        ) : null}
        {value.kind === "part" ? (
          <select aria-label={`${label}: part of the day`} name={`${name}-part`} value={value.part} onChange={(e) => set({ part: e.currentTarget.value as PartOfDay })}>
            {(["morning", "afternoon", "evening", "night"] as const).map((part) => (
              <option key={part} value={part}>
                {part}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {value.kind === "window" ? (
        <div class="field-pair">
          <input aria-label={`${label}: until date`} type="date" name={`${name}-end-date`} value={value.endDate || value.date} onInput={(e) => set({ endDate: e.currentTarget.value })} />
          <input aria-label={`${label}: until time`} type="time" name={`${name}-end-time`} value={value.endTime} onInput={(e) => set({ endTime: e.currentTarget.value })} required />
        </div>
      ) : null}
      <input
        aria-label={`${label}: time zone`}
        class="zone"
        name={`${name}-zone`}
        list="zones"
        placeholder="Time zone, such as America/Santiago"
        autocomplete="off"
        autocapitalize="none"
        value={value.zone}
        onInput={(e) => set({ zone: e.currentTarget.value })}
        required
      />
    </fieldset>
  );
}

/** A town typed, with the towns the device holds suggested as the traveller types; choosing one gives its zone. */
export function TownField({ label, value, onChange, onPlace, name }: { label: string; value: string; onChange: (text: string) => void; onPlace: (place: Place) => void; name: string }) {
  const [found, setFound] = useState<readonly Place[]>([]);
  return (
    <Field label={label}>
      <input
        name={name}
        value={value}
        autocomplete="off"
        onInput={async (e) => {
          const text = e.currentTarget.value;
          onChange(text);
          setFound(text.trim().length >= 2 ? await places.towns(text, 5) : []);
        }}
      />
      {found.length ? (
        <div class="suggestions" role="listbox">
          {found.map((place) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              class="suggestion"
              key={`${place.country}-${place.name}-${place.region}`}
              onClick={() => {
                onChange(place.name);
                onPlace(place);
                setFound([]);
              }}
            >
              {place.name}
              <span class="suggestion-detail">
                {place.region ? `${place.region}, ` : ""}
                {place.country}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </Field>
  );
}
