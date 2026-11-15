// Prints, as JSON, a trip's layout and its text. independence.test.ts runs it under two device time zones.

import { layout, tripToText } from "../../src/index.ts";
import { addFirm, applyAll, day, exact, item, loadNewestRules, ok, pencil, stretch, time, trip } from "../helpers.ts";

loadNewestRules();
const t = applyAll(
  trip(),
  pencil(stretch("france", "FR", "2026-06-01", "2026-06-05")),
  pencil(stretch("japan", "JP", "2026-06-05", "2026-06-12", "Tokyo")),
  addFirm(item("a", "Coffee", exact("Europe/Paris", "2026-06-05", "08:00"))),
  addFirm(item("b", "Landing", exact("Asia/Tokyo", "2026-06-05", "23:30"))),
  addFirm(item("c", "Dinner", time({ kind: "part", zone: "Asia/Tokyo", date: "2026-06-05", part: "evening" }))),
  addFirm(item("d", "Leave", day("2026-06-05"))),
  addFirm(item("e", "Night", exact("Europe/London", "2026-06-05", "23:59"))),
);
console.log(JSON.stringify({ layout: ok(layout(t, "2026-06-01", "2026-06-12")), text: tripToText(t) }));
