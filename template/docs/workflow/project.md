# Project specifics for the workflow

Everything the phase files defer to, for this repo. This is the only workflow file that names this repo's own paths
or commands; the phase files name only what every repo has (`docs/handoff.md`, Claude Code's plan mode, git). So it
is the only one to rewrite when the kit is copied.

- **Decision records.** `docs/adr/`, index at `docs/adr/README.md`. Read the index row before changing a subsystem it
  covers. Format, length, naming and the bar for a new one are in that README.
- **Structural docs.** `CLAUDE.md` (rules and commands), `docs/architecture.md` (the map), `docs/glossary.md`
  (terms), `docs/spec.md` (design for what is not built; built work collapses to a `**Built.**` note).
- **Checks.** `<typecheck command>` and `<test command>` must pass before implementation ends.
- **Peer review.** `node scripts/peer-review.mjs` reviews the working tree (everything, before a first commit);
  `--base main` reviews a branch, `--model <id>` picks a stronger reviewer, `--effort <level>` sets how hard it
  thinks (default `max`; a run that reports no reasoning, or does not say, prints a warning), `--dry-run`
  prints the file list and token estimate without calling the API, and `--max-tokens <n>` refuses a pack bigger than
  that. It needs Node 18+ and `OPENROUTER_API_KEY`, or `--key-file <path>` to a file holding
  the key alone, as JSON, or as a `.env` line. Pass `--focus "<what the change is and where to look>"`: a focused
  run finds what an unfocused one misses. Its own tests: `node --test scripts/peer-review.test.mjs`.
  Exit 2 means OpenRouter needs the owner (no key, a rejected key, no credits, a refusal): stop and tell them, and
  never skip the review. A stall or a provider failing partway is retried by the script itself; "Gave up after 3
  attempts" can simply be run again.
  <If Node or a key is not available, replace this line with: phase 4 is the lead's own read of the diff, and the
  verdict list says no outside model reviewed it.>
- **Real checks.** <What tests cannot see and how it is checked for real: a prompt change needs a real model call, a
  UI change needs a screenshot, a migration needs an old file. Name the command for each.>
- **Data.** <Where the project writes, how it is read back, and what an added field needs so old files still load.
  Delete this line if the project keeps no data.>
- **Commits.** The owner commits. Never commit without being asked.
