// Every check in the verification of each requirement the itinerary claims (spec §4.8, §7).
// PLN:ITINERARY-NFR1 is proven in independence.test.ts, since it needs runs of its own.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  apply,
  extent,
  layout,
  travelDuration,
  travellerDates,
  tripFromText,
  tripToText,
  type Change,
  type Trip,
} from "../src/index.ts";
import { NEW_YORK, PARIS, addFirm, applyAll, day, exact, item, loadFixture, loadNewestRules, ok, pencil, refusal, stretch, time, trip } from "./helpers.ts";

before(() => {
  loadNewestRules();
});

const june = (d: number) => `2026-06-${String(d).padStart(2, "0")}`;

describe("PLN:ITINERARY-F1 — a trip holds any arrangement of stretches, each changed freely", () => {
  const france = stretch("france", "FR", june(1), june(5));
  const newYork = stretch("new-york", "US", june(5), june(8), "New York");

  test("France from 1 to 5 June and New York from 5 to 8 June read back unchanged", () => {
    const t = applyAll(trip(), pencil(france), pencil(newYork));
    assert.deepEqual(t.stretches, [france, newYork]);
  });

  test("moving New York to 10 to 12 June leaves a gap from 6 to 9 June, which is accepted", () => {
    const t = applyAll(trip(), pencil(france), pencil(newYork), { op: "move", id: "new-york", first: june(10), last: june(12) });
    assert.deepEqual(t.stretches[1], { ...newYork, first: june(10), last: june(12) });
  });

  test("Paris from 3 to 5 June overlaps France, which is accepted", () => {
    const t = applyAll(trip(), pencil(france), pencil(stretch("paris", "FR", june(3), june(5), "Paris")));
    assert.equal(t.stretches.length, 2);
  });

  test("a stretch from 5 to 3 June, and one on 30 February, are refused with the reason", () => {
    const backwards = refusal(apply(trip(), pencil(stretch("s", "FR", june(5), june(3)))));
    assert.equal(backwards.code, "stretch-order");
    assert.match(backwards.message, /before its first/);
    const february = refusal(apply(trip(), pencil(stretch("s", "FR", "2026-02-30", "2026-02-30"))));
    assert.equal(february.code, "invalid-date");
    assert.match(february.message, /2026-02-30/);
  });

  test("a trip with no stretches is a trip", () => {
    assert.deepEqual(trip().stretches, []);
  });
});

describe("PLN:ITINERARY-F2 — every place names a country, and each day gives the countries covering it", () => {
  const t = () =>
    applyAll(
      trip(),
      pencil(stretch("france", "FR", june(1), june(5))),
      pencil(stretch("lyon", "FR", june(1), june(3), "Lyon")),
      pencil(stretch("new-york", "US", june(5), june(8), "New York")),
    );
  const countriesOn = (date: string) => ok(layout(t(), date, date))[0]!.countries;

  test("2 June gives France, once", () => assert.deepEqual(countriesOn(june(2)), ["FR"]));
  test("5 June gives France, then the United States", () => assert.deepEqual(countriesOn(june(5)), ["FR", "US"]));
  test("9 June gives no country", () => assert.deepEqual(countriesOn(june(9)), []));
  test("a stretch in a country that does not exist is refused, with the reason", () => {
    const refused = refusal(apply(t(), pencil(stretch("atlantis", "XA", june(9), june(10)))));
    assert.equal(refused.code, "unknown-country");
    assert.match(refused.message, /XA/);
  });
});

describe("PLN:ITINERARY-F3 — a firm item has a title, and a date or a time in local time", () => {
  const moveOn = item("move-on", "Move on from Lyon", day("2026-06-03"));
  const museum = () => item("museum", "Museum visit", time({ kind: "part", zone: PARIS, date: "2026-06-04", part: "afternoon" }));

  test("3 June, the day to move on from Lyon, with no time, reads back unchanged", () => {
    const t = applyAll(trip(), addFirm(moveOn));
    assert.deepEqual(t.firm, [{ ...moveOn, revision: 1 }]);
  });

  test("a museum visit on the afternoon of 4 June, Paris time, reads back unchanged", () => {
    const t = applyAll(trip(), addFirm(museum()));
    assert.deepEqual(t.firm, [{ ...museum(), revision: 1 }]);
  });

  test("a dinner at 02:30 on 29 March 2026, Paris time, is refused with trip-time's reason", () => {
    const dinner = item("dinner", "Dinner", { kind: "exact", zone: PARIS, date: "2026-03-29", at: { time: "02:30" } });
    const refused = refusal(apply(trip(), addFirm(dinner)));
    assert.equal(refused.code, "skipped-time");
    assert.equal(refused.details?.before, "01:59");
    assert.equal(refused.details?.after, "03:00");
  });

  test("a removed museum visit is no longer held", () => {
    const t = applyAll(trip(), addFirm(museum()), { op: "remove-firm", id: "museum" });
    assert.deepEqual(t.firm, []);
  });
});

describe("PLN:ITINERARY-F4 — a firm item of travel holds where it goes, how, and when it leaves and arrives", () => {
  const paris = { country: "FR", name: "Paris" };
  const newYork = { country: "US", name: "New York" };

  test("a flight from Paris at 10:00 to New York at 12:30 on 5 June 2026 lasts 8 hours 30 minutes", () => {
    const flight = item("flight", "Flight to New York", exact(PARIS, june(5), "10:00"), {
      travel: { from: paris, to: newYork, by: "flight", arrive: exact(NEW_YORK, june(5), "12:30") },
    });
    const t = applyAll(trip(), addFirm(flight));
    assert.deepEqual(travelDuration(t.firm[0]!), { shortest: 510, longest: 510 });
  });

  test("a train from Lyon to Paris on 3 June, with no times, is accepted, with no duration", () => {
    const train = item("train", "Train to Paris", day(june(3)), { travel: { from: { country: "FR", name: "Lyon" }, to: paris, by: "train" } });
    const t = applyAll(trip(), addFirm(train));
    assert.equal(travelDuration(t.firm[0]!), undefined);
  });

  test("a flight leaving at 10:00 and arriving at 03:00 the same day, Paris time, is refused with the reason", () => {
    const flight = item("flight", "Flight", exact(PARIS, june(5), "10:00"), {
      travel: { from: paris, to: newYork, by: "flight", arrive: exact(PARIS, june(5), "03:00") },
    });
    const refused = refusal(apply(trip(), addFirm(flight)));
    assert.equal(refused.code, "travel-order");
    assert.match(refused.message, /arrives before it leaves/);
  });
});

describe("PLN:ITINERARY-F5 — the itinerary lays out a range of days, each with its stretches and firm items in order", () => {
  const base = () => applyAll(trip(), pencil(stretch("france", "FR", june(1), june(5))), pencil(stretch("new-york", "US", june(5), june(8), "New York")));

  test("4 to 6 June gives three days: France, France and New York, then New York", () => {
    const days = ok(layout(base(), june(4), june(6)));
    assert.deepEqual(
      days.map((d) => [d.date, d.stretches.map((s) => s.id)]),
      [
        [june(4), ["france"]],
        [june(5), ["france", "new-york"]],
        [june(6), ["new-york"]],
      ],
    );
  });

  test("5 June lists coffee, flight, check-in, whatever time zone each is in", () => {
    const t = applyAll(
      base(),
      addFirm(item("check-in", "Check in", time({ kind: "window", zone: NEW_YORK, date: june(5), from: { time: "14:00" }, endDate: june(5), to: { time: "16:00" } }))),
      addFirm(item("flight", "Flight", exact(PARIS, june(5), "10:00"))),
      addFirm(item("coffee", "Coffee", exact(PARIS, june(5), "08:00"))),
    );
    assert.deepEqual(ok(layout(t, june(5), june(5)))[0]!.firm.map((f) => f.id), ["coffee", "flight", "check-in"]);
  });

  test("a bus from New York at 22:30 on 8 June to Montreal at 07:00 on 9 June is listed on both days", () => {
    const bus = item("bus", "Bus to Montreal", exact(NEW_YORK, june(8), "22:30"), {
      travel: { from: { country: "US", name: "New York" }, to: { country: "CA", name: "Montreal" }, by: "bus", arrive: exact("America/Toronto", june(9), "07:00") },
    });
    const days = ok(layout(applyAll(base(), addFirm(bus)), june(8), june(9)));
    assert.deepEqual(days.map((d) => d.firm.map((f) => f.id)), [["bus"], ["bus"]]);
  });

  test("the first and last dates any stretch or firm item covers", () => {
    assert.deepEqual(extent(base()), { first: june(1), last: june(8) });
    const bus = item("bus", "Bus", exact(NEW_YORK, june(8), "22:30"), {
      travel: { from: { country: "US" }, to: { country: "CA" }, by: "bus", arrive: exact("America/Toronto", june(9), "07:00") },
    });
    assert.deepEqual(extent(applyAll(base(), addFirm(bus))), { first: june(1), last: june(9) });
    assert.equal(extent(trip()), undefined);
  });

  test("items that have only a date come first", () => {
    const t = applyAll(base(), addFirm(item("early", "Early", exact(PARIS, june(5), "00:00"))), addFirm(item("day", "Day", day(june(5)))));
    assert.deepEqual(ok(layout(t, june(5), june(5)))[0]!.firm.map((f) => f.id), ["day", "early"]);
  });
});

describe("PLN:ITINERARY-F6 — the same changes, applied in the same order, give the same trip", () => {
  const changes: Change[] = [
    { op: "rename", name: "Summer" },
    { op: "trip-dates", dates: { first: june(1), last: june(20) } },
    { op: "traveller-dates", traveller: "u-1", dates: { first: june(3), last: june(8) } },
    pencil(stretch("france", "FR", june(1), june(5))),
    pencil(stretch("japan", "JP", june(6), june(12))),
    { op: "move", id: "japan", first: june(7), last: june(14) },
    { op: "re-place", id: "japan", place: { country: "JP", name: "Kyoto" } },
    addFirm(item("flight", "Flight", exact(PARIS, june(6), "11:00"))),
    { op: "change-firm", item: item("flight", "Flight to Osaka", exact(PARIS, june(6), "11:30")), base: 1 },
    { op: "remove-stretch", id: "france" },
  ];

  test("two copies that apply the same ten changes in the same order are equal", () => {
    const a = applyAll(trip(), ...changes);
    const b = applyAll(trip(), ...changes);
    assert.deepEqual(a, b);
    assert.equal(tripToText(a), tripToText(b));
  });

  test("each revision is ten more than it was", () => {
    const start = trip();
    assert.equal(applyAll(start, ...changes).revision, start.revision + 10);
  });

  test("of two moves of one stretch, the second stands", () => {
    const t = applyAll(
      trip(),
      pencil(stretch("france", "FR", june(1), june(5))),
      { op: "move", id: "france", first: june(2), last: june(6) },
      { op: "move", id: "france", first: june(9), last: june(11) },
    );
    assert.deepEqual([t.stretches[0]!.first, t.stretches[0]!.last], [june(9), june(11)]);
  });
});

describe("PLN:ITINERARY-F7 — a refused change leaves the trip as it was, and says why", () => {
  const one = (): Trip => applyAll(trip(), pencil(stretch("france", "FR", june(1), june(5))));

  test("moving a stretch the trip does not hold is refused, with the reason, and changes nothing", () => {
    const t = one();
    const before = tripToText(t);
    const refused = refusal(apply(t, { op: "move", id: "spain", first: june(1), last: june(2) }));
    assert.equal(refused.code, "unknown-id");
    assert.match(refused.message, /spain/);
    assert.equal(tripToText(t), before);
  });

  test("adding the trip's stretch a second time, under its identifier, is refused, and changes nothing", () => {
    const t = one();
    const before = tripToText(t);
    const refused = refusal(apply(t, pencil(stretch("france", "FR", june(7), june(9)))));
    assert.equal(refused.code, "duplicate-id");
    assert.match(refused.message, /france/);
    assert.equal(tripToText(t), before);
    assert.equal(t.revision, 2);
  });
});

describe("PLN:ITINERARY-F8 — a trip is written as text, and read back unchanged", () => {
  const everything = (): Trip =>
    applyAll(
      trip(),
      { op: "trip-dates", dates: { first: "2026-03-01", last: "2026-10-31" } },
      { op: "traveller-dates", traveller: "u-2", dates: { first: "2026-03-05", last: "2026-06-01" } },
      pencil(stretch("france", "FR", "2026-03-01", "2026-06-05", undefined, "page-france")),
      pencil(stretch("paris", "FR", "2026-03-28", "2026-03-30", "Paris")),
      addFirm(item("move-on", "Move on", day("2026-06-03"), { page: "page-lyon" })),
      addFirm(item("dinner", "Dinner", exact(PARIS, "2026-03-29", "01:30"))),
      addFirm(item("late", "Late", exact(PARIS, "2026-03-29", "03:00"))),
      addFirm(item("repeat", "Night bus", time({ kind: "exact", zone: PARIS, date: "2026-10-25", at: { time: "02:30", second: true } }))),
      addFirm(item("afternoon", "Museum", time({ kind: "part", zone: PARIS, date: "2026-06-04", part: "afternoon" }))),
      addFirm(item("approx", "Picnic", time({ kind: "approx", zone: PARIS, date: "2026-06-04", at: { time: "12:00" } }))),
      addFirm(
        item("flight", "Flight", exact(PARIS, "2026-06-05", "10:00"), {
          travel: { from: { country: "FR", name: "Paris" }, to: { country: "US", name: "New York" }, by: "flight", arrive: exact(NEW_YORK, "2026-06-05", "12:30") },
        }),
      ),
      addFirm(
        item("ferry", "Ferry", time({ kind: "window", zone: PARIS, date: "2026-06-06", from: { time: "23:00" }, endDate: "2026-06-07", to: { time: "01:00" } }), {
          travel: { from: { country: "FR" }, to: { country: "GB" }, by: "ferry", arrive: day("2026-06-07") },
        }),
      ),
    );

  test("a trip holding every kind of stretch and firm item reads back equal", () => {
    const t = everything();
    const read = ok(tripFromText(tripToText(t)));
    assert.deepEqual(read, t);
    assert.equal(tripToText(read), tripToText(t));
  });

  test("a trip written under one copy of the rules reads back with every local time unchanged under another", () => {
    loadFixture("no-summer-time.json");
    const t = applyAll(trip(), addFirm(item("dinner", "Dinner", exact(PARIS, "2026-03-29", "02:30"))));
    const text = tripToText(t);
    loadFixture("summer-time.json");
    const read = ok(tripFromText(text));
    assert.deepEqual(read, t);
    loadNewestRules();
  });

  test("text that is not a trip is refused, with the reason", () => {
    for (const text of ["", "[]", "{}", '{"format":1}', "a trip"]) {
      const refused = refusal(tripFromText(text));
      assert.equal(refused.code, "malformed", text);
      assert.ok(refused.message.length > 0);
    }
  });
});

describe("PLN:ITINERARY-F9 — a stretch or a firm item names at most one page of its trip", () => {
  test("a stretch naming a page reads back naming it, and naming none once changed", () => {
    const t = applyAll(trip(), pencil(stretch("france", "FR", june(1), june(5), undefined, "page-1")));
    assert.equal(t.stretches[0]!.page, "page-1");
    const t2 = applyAll(t, { op: "remove-stretch", id: "france" }, pencil(stretch("france", "FR", june(1), june(5))));
    assert.equal(t2.stretches[0]!.page, undefined);
    assert.ok(!("page" in t2.stretches[0]!));
  });

  test("a firm item naming a page names it in its day's layout", () => {
    const t = applyAll(trip(), addFirm(item("bus", "Bus", day(june(4)), { page: "page-bus" })));
    assert.equal(ok(layout(t, june(4), june(4)))[0]!.firm[0]!.page, "page-bus");
  });

  test("a firm item changed to name no page names none", () => {
    const t = applyAll(trip(), addFirm(item("bus", "Bus", day(june(4)), { page: "page-bus" })), {
      op: "change-firm",
      item: item("bus", "Bus", day(june(4))),
      base: 1,
    });
    assert.equal(t.firm[0]!.page, undefined);
  });
});

describe("PLN:ITINERARY-F10 — a trip holds its own dates, and each traveller's within them", () => {
  const december = () => applyAll(trip(), { op: "trip-dates", dates: { first: "2026-12-01", last: "2026-12-20" } });

  test("the trip's dates, 1 to 20 December 2026, read back", () => {
    assert.deepEqual(december().dates, { first: "2026-12-01", last: "2026-12-20" });
  });

  test("a traveller's dates read back, and a traveller with none has the trip's", () => {
    const t = applyAll(december(), { op: "traveller-dates", traveller: "u-1", dates: { first: "2026-12-06", last: "2026-12-13" } });
    assert.deepEqual(travellerDates(t, "u-1"), { first: "2026-12-06", last: "2026-12-13" });
    assert.deepEqual(travellerDates(t, "u-2"), { first: "2026-12-01", last: "2026-12-20" });
  });

  test("a traveller's dates from 28 November to 3 December are refused, with the reason", () => {
    const refused = refusal(apply(december(), { op: "traveller-dates", traveller: "u-1", dates: { first: "2026-11-28", last: "2026-12-03" } }));
    assert.equal(refused.code, "outside-trip");
    assert.match(refused.message, /outside the trip's/);
  });

  test("the trip's dates set to 8 to 20 December are refused, naming the traveller", () => {
    const t = applyAll(december(), { op: "traveller-dates", traveller: "u-1", dates: { first: "2026-12-06", last: "2026-12-13" } });
    const refused = refusal(apply(t, { op: "trip-dates", dates: { first: "2026-12-08", last: "2026-12-20" } }));
    assert.equal(refused.code, "travellers-outside");
    assert.equal(refused.details?.travellers, "u-1");
    assert.match(refused.message, /u-1/);
  });
});

describe("PLN:ITINERARY-F11 — a change to a firm item made from an older version is refused, with the item as it stands", () => {
  const museum = (at: string, title = "Museum visit") => item("museum", title, exact(PARIS, june(4), at));
  const start = () => applyAll(trip(), addFirm(museum("14:00")));

  test("changing its time from its current revision is accepted", () => {
    const t = applyAll(start(), { op: "change-firm", item: museum("15:00"), base: 1 });
    assert.equal(t.firm[0]!.revision, 2);
    assert.equal(t.firm[0]!.when.kind === "exact" && t.firm[0]!.when.at.time, "15:00");
  });

  test("changing its title from the revision before is refused, with the item as it now stands", () => {
    const t = applyAll(start(), { op: "change-firm", item: museum("15:00"), base: 1 });
    const refused = refusal(apply(t, { op: "change-firm", item: museum("14:00", "Louvre"), base: 1 }));
    assert.equal(refused.code, "stale");
    assert.equal(refused.details?.revision, "2");
    const standing = JSON.parse(refused.details!.item!);
    assert.equal(standing.title, "Museum visit");
    assert.equal(standing.when, "2026-06-04T15:00[Europe/Paris]");
  });

  test("a stretch moved again from a copy that has not seen the first move: the second move stands", () => {
    const t = applyAll(trip(), pencil(stretch("france", "FR", june(1), june(5))));
    const seen = applyAll(t, { op: "move", id: "france", first: june(2), last: june(6) });
    const second: Change = { op: "move", id: "france", first: june(3), last: june(7) };
    const result = ok(apply(seen, second));
    assert.deepEqual([result.stretches[0]!.first, result.stretches[0]!.last], [june(3), june(7)]);
  });
});
