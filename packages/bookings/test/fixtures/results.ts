// Prints, as JSON, what the bookings list gives for a set of bookings. independence.test.ts runs it
// under two device time zones, and each kind adds its bookings to the set.

import { changeToText, touches, type Booking } from "../../src/index.ts";
import { loadNewestRules } from "../helpers.ts";

loadNewestRules();
const held: Booking = { id: "a", revision: 3, travellers: ["t2", "t1"], details: {}, kind: "flight" };
console.log(
  JSON.stringify({
    touches: touches(held, { op: "remove", id: "a", base: 3 }),
    change: changeToText({ op: "remove", id: "a", base: 3 }),
  }),
);
