# Shared specifications

How each shared component is built. A shared component is one that several systems use, or one
that no system owns.

| Document | Is | Runs |
|---|---|---|
| [doc-check.md](doc-check.md) | The checker that holds every document in the vault to the documentation system | On an author's machine through `just check-docs`, and in continuous integration on every push and pull request |

The folder holds one program, doc-check, and no artefacts.
