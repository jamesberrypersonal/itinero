// newTrip (spec §4.1), apply (§4.2), and a trip's dates and each traveller's (§4.9).

import { buildDates, buildFirm, buildPlace, buildStretch, buildTrip, fields, text, withRevision } from "./build.ts";
import { checkDates, checkFirm, checkId, checkPlace, checkStretch, checkStretchDates, checkText, readCallerWhen } from "./check.ts";
import { firmToJson } from "./text.ts";
import { attempt, fail, type Change, type Dates, type Id, type Result, type Stretch, type Trip } from "./types.ts";

export function newTrip(id: Id, name: string): Result<Trip> {
  return attempt(() => {
    checkId(text(id, "trip's identifier"), "trip's identifier");
    checkText(text(name, "trip's name"), "trip's name");
    return buildTrip({ id, name, revision: 1, dates: undefined, travellers: [], stretches: [], firm: [] });
  });
}

export function travellerDates(trip: Trip, traveller: Id): Dates | undefined {
  return trip.travellers.find((t) => t.traveller === traveller)?.dates ?? trip.dates;
}

const OPS: Record<Change["op"], { required: readonly string[]; optional?: readonly string[] }> = {
  rename: { required: ["name"] },
  "trip-dates": { required: ["dates"] },
  "traveller-dates": { required: ["traveller"], optional: ["dates"] },
  pencil: { required: ["stretch"] },
  move: { required: ["id", "first", "last"] },
  "re-place": { required: ["id", "place"] },
  "remove-stretch": { required: ["id"] },
  "add-firm": { required: ["item"] },
  "change-firm": { required: ["item", "base"] },
  "remove-firm": { required: ["id"] },
};

export function apply(trip: Trip, change: Change): Result<Trip> {
  return attempt(() => applyChecked(trip, change));
}

function applyChecked(trip: Trip, input: Change): Trip {
  const op = (input as { op?: unknown } | null)?.op;
  if (typeof op !== "string" || !(op in OPS)) fail("malformed", `The change ${JSON.stringify(op)} is not one the itinerary makes.`);
  const shape = OPS[op as Change["op"]];
  const r = fields(input, `change ${op}`, ["op", ...shape.required], shape.optional ?? []);

  let { name, dates, travellers, stretches, firm } = {
    name: trip.name,
    dates: trip.dates,
    travellers: [...trip.travellers],
    stretches: [...trip.stretches],
    firm: [...trip.firm],
  };
  const holds = (id: Id) => stretches.some((s) => s.id === id) || firm.some((f) => f.id === id);
  const stretchAt = (id: unknown) => {
    const at = stretches.findIndex((s) => s.id === text(id, "stretch's identifier"));
    if (at < 0) fail("unknown-id", `The trip holds no stretch ${JSON.stringify(id)}.`);
    return at;
  };
  const firmAt = (id: unknown) => {
    const at = firm.findIndex((f) => f.id === text(id, "firm item's identifier"));
    if (at < 0) fail("unknown-id", `The trip holds no firm item ${JSON.stringify(id)}.`);
    return at;
  };

  switch (op as Change["op"]) {
    case "rename":
      name = text(r.name, "trip's name");
      checkText(name, "trip's name");
      break;

    case "trip-dates": {
      const next = buildDates(r.dates, "trip's dates");
      checkDates(next, "trip's dates");
      const outside = travellers.filter((t) => t.dates.first < next.first || t.dates.last > next.last).map((t) => t.traveller);
      if (outside.length > 0) {
        fail("travellers-outside", `The trip's new dates would leave the dates of ${outside.join(", ")} outside them.`, {
          travellers: outside.join(","),
        });
      }
      dates = next;
      break;
    }

    case "traveller-dates": {
      const traveller = text(r.traveller, "traveller");
      checkId(traveller, "traveller");
      travellers = travellers.filter((t) => t.traveller !== traveller);
      if (r.dates !== undefined) {
        const own = buildDates(r.dates, "traveller's dates");
        checkDates(own, "traveller's dates");
        if (!dates) fail("outside-trip", "The trip has no dates yet, so no traveller's dates can be set within them.");
        if (own.first < dates.first || own.last > dates.last) {
          fail(
            "outside-trip",
            `The traveller's dates, ${own.first} to ${own.last}, fall outside the trip's, ${dates.first} to ${dates.last}.`,
          );
        }
        travellers.push(Object.freeze({ traveller, dates: own }));
      }
      break;
    }

    case "pencil": {
      const stretch = buildStretch(r.stretch);
      if (holds(stretch.id)) duplicate(stretch.id);
      checkStretch(stretch);
      stretches.push(stretch);
      break;
    }

    case "move": {
      const at = stretchAt(r.id);
      const first = text(r.first, "stretch's first day");
      const last = text(r.last, "stretch's last day");
      checkStretchDates(first, last);
      stretches[at] = Object.freeze({ ...stretches[at]!, first, last }) as Stretch;
      break;
    }

    case "re-place": {
      const at = stretchAt(r.id);
      const place = buildPlace(r.place);
      checkPlace(place);
      stretches[at] = Object.freeze({ ...stretches[at]!, place }) as Stretch;
      break;
    }

    case "remove-stretch":
      stretches.splice(stretchAt(r.id), 1);
      break;

    case "add-firm": {
      const item = buildFirm(r.item, readCallerWhen);
      if (holds(item.id)) duplicate(item.id);
      checkFirm(item);
      firm.push(withRevision(item, 1));
      break;
    }

    case "change-firm": {
      if (!Number.isSafeInteger(r.base)) fail("malformed", "The change's base is not a whole number.");
      const idOf = (r.item as { id?: unknown } | null)?.id;
      const at = firmAt(idOf);
      const current = firm[at]!;
      if (r.base !== current.revision) {
        fail(
          "stale",
          `The firm item ${current.id} has changed since revision ${String(r.base)}, and is now at revision ${current.revision}.`,
          { item: JSON.stringify(firmToJson(current)), revision: String(current.revision) },
        );
      }
      const item = buildFirm(r.item, readCallerWhen);
      checkFirm(item);
      firm[at] = withRevision(item, current.revision + 1);
      break;
    }

    case "remove-firm":
      firm.splice(firmAt(r.id), 1);
      break;
  }

  return buildTrip({ id: trip.id, name, revision: trip.revision + 1, dates, travellers, stretches, firm });
}

function duplicate(id: Id): never {
  fail("duplicate-id", `The trip already holds a stretch or a firm item with the identifier ${JSON.stringify(id)}.`);
}

