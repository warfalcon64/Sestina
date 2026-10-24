# Glossary

Words that mean something particular here. Alphabetical, with the file the thing lives in.

- **fill-in file** — a file a repo writes for itself from a copy with `<angle-bracket>` placeholders; copied once,
  never overwritten. `template/`.
- **hand-back** — a file the sync leaves untouched because it cannot merge it without losing something, printed as
  `merge by hand: <why>`. `scripts/bootstrap.mjs`.
- **handoff notes** — everything in `docs/handoff.md` from its first `## ` line on; the part above is the header,
  which is verbatim. `notesOf` in `scripts/handoff-hook.mjs`.
- **phase** — one of the six workflow steps every change walks, read from `phase <n>` in the handoff's latest
  heading. `docs/workflow/0N-*.md`.
- **re-copy** — a sync into a repo that already has `docs/workflow/project.md`; it adds no fill-in file.
  `scripts/bootstrap.mjs`.
- **round** — one peer-review run; a run that warns about missing reasoning does not count. `docs/workflow/project.md`.
- **sync** — one run of `scripts/bootstrap.mjs`, the same for a first setup and a re-copy. ADR 0004.
- **verbatim file** — a file copied byte for byte from the kit's root and edited only there. `VERBATIM` in
  `scripts/bootstrap.mjs`.
