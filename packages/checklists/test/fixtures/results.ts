// Prints, as JSON, what a set of changes gives. independence.test.ts runs it under two languages
// and two time zones.

import { checklistToText, ordered, placeAfter, progress } from "../../src/index.ts";
import { applyAll, ok, onTrip } from "../helpers.ts";

const c = applyAll(
  onTrip(),
  { op: "rename", checklist: "trip-before", title: "  İstanbul, then Kadıköy  " },
  { op: "add", checklist: "trip-before", item: "tr", text: "  ISTANBUL kartı, ıstanbul  ", after: "i1" },
  { op: "move", checklist: "trip-before", item: "i3" },
  { op: "tick", checklist: "trip-before", item: "tr", ticked: true },
  { op: "write", checklist: "trip-before", item: "i2", text: "Pesos — about 50 000 CLP" },
);
const list = [{ id: "b", order: "V" }, { id: "a", order: "V" }, { id: "c", order: "k" }];
console.log(JSON.stringify([checklistToText(c), progress(c), ordered(list), ok(placeAfter(list, "c"))]));
