// The templates each traveller's library starts with (docs/spec/planner/library.md §4.6,
// PLN:LIBRARY-F6). They are ordinary templates once made: the traveller changes or deletes them as
// any other, and a library is given them only once, when it is made.

import { apply, newChecklist, type Checklist } from "@itinero/checklists";
import type { AccountId } from "./accounts.ts";

/** Each default template's identifier, title and items, in the order the library lists them. */
export const DEFAULT_TEMPLATES: readonly { id: string; title: string; items: readonly string[] }[] = [
  {
    id: "default-before-leaving",
    title: "Before leaving",
    items: [
      "Passport valid for six months after you return",
      "Visas and entry forms",
      "Travel insurance",
      "Tell your bank you're travelling",
      "Copies of your passport and bookings",
      "Download offline maps",
      "Check in online",
    ],
  },
  {
    id: "default-packing",
    title: "Packing",
    items: [
      "Phone and charger",
      "Plug adaptor",
      "Medication",
      "Toiletries",
      "Glasses or contact lenses",
      "Clothes for the weather",
      "Keys for home",
    ],
  },
];

/** The default templates, made with planner/checklists for the account, each after the one before. */
export function defaultTemplates(account: AccountId): Checklist[] {
  const made: Checklist[] = [];
  for (const { id, title, items } of DEFAULT_TEMPLATES) {
    const started = newChecklist(id, account, title, made);
    if (!started.ok) throw new Error(started.refusal.message);
    let template = started.value;
    let after: string | undefined;
    items.forEach((text, n) => {
      const item = `item-${n + 1}`;
      const next = apply(template, after === undefined ? { op: "add", checklist: id, item, text } : { op: "add", checklist: id, item, text, after });
      if (!next.ok) throw new Error(next.refusal.message);
      template = next.value;
      after = item;
    });
    made.push(template);
  }
  return made;
}
