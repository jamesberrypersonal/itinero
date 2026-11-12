# Shared requirements

What each shared component promises. A shared component is one that several systems use, or one
that no system owns.

| Document | Promises about | Verified |
|---|---|---|
| [doc-check.md](doc-check.md) | The checker that holds every document in the vault to the documentation system | Against a copy of the vault built to break one rule at a time, and against a generated vault of 1,000 documents for speed |
| [doc-scaffold.md](doc-scaffold.md) | The scaffolder that starts a new component, system, decision record or guide, and the missing documents of a registered component | Against copies of the vault, with the checker run after every command |
| [trip-time.md](trip-time.md) | Dates and times in the local time of the place they happen, and the time zones between places | Against chosen dates in Paris, New York and Tokyo, including the days their clocks change, and on a phone with no connection |
