# Project specifics for the workflow

Everything the phase files defer to, for this repo. This is the only workflow file that names this repo's own paths
or commands; the phase files name only what every repo has (`docs/handoff.md`, Claude Code's plan mode, git). So it
is the only one to rewrite when the kit is copied.

- **Decision records.** `docs/adr/`, index at `docs/adr/README.md`. Read the index row before changing a subsystem it
  covers. Format, length, naming and the bar for a new one are in that README.
- **Structural docs.** `CLAUDE.md` (rules and commands), `docs/architecture.md` (the map), `docs/glossary.md`
  (terms), `docs/spec.md` (design for what is not built; built work collapses to a `**Built.**` note).
- **Checks.** `<typecheck command>`, `<test command>` and `node scripts/doc-check.mjs` must pass before implementation
  ends.
- **Peer review.** `<the command this repo runs, with how it gets the key>` reviews the working tree, and `--help`
  lists the flags. Its own tests: `node --test scripts/peer-review.test.mjs`. <The model, when not the default; what
  review cannot see here and what stands in for it.>
  <If Node or a key is not available, replace this line with: phase 4 is the lead's own read of the diff, and the
  verdict list says no outside model reviewed it. Without Node, also drop the docs check from Checks.>
- **Real checks.** <What tests cannot see and how it is checked for real: a prompt change needs a real model call, a
  UI change needs a screenshot, a migration needs an old file. Name the command for each.>
- **Data.** <Where the project writes, how it is read back, and what an added field needs so old files still load.
  Delete this line if the project keeps no data.>
- **Commits.** The owner commits. Never commit without being asked.
