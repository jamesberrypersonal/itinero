# Shared requirements

What each shared component promises. A shared component is one that several systems use, or one
that no system owns.

| Document | Promises about | Verified |
|---|---|---|
| [doc-check.md](doc-check.md) | The checker that holds every document in the vault to the documentation system | Against a copy of the vault built to break one rule at a time, and against a generated vault of 1,000 documents for speed |
| [doc-scaffold.md](doc-scaffold.md) | The scaffolder that starts a new component, system, decision record or guide | Against copies of the vault, with the checker run after every command |
