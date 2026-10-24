# Project specifics for the workflow

Everything the phase files defer to, for the kit itself. This is the only workflow file that names this repo's own
paths or commands; the phase files name only the kit's fixed pieces (`docs/handoff.md`, Claude Code's plan mode). It
is never copied: a repo fills in `template/docs/workflow/project.md` instead.

- **Decision records.** `docs/adr/`, index at `docs/adr/README.md`. Read the index row before changing a subsystem it
  covers. Format, length, naming and the bar for a new one are in that README.
- **Structural docs.** `CLAUDE.md` (rules and commands), `README.md` (the system, and the list of verbatim files),
  `BOOTSTRAP.md` (how the kit is copied), `template/` (the files a repo fills in).
- **Checks.** `node --test scripts/*.test.mjs` must pass before implementation ends. There is no typecheck: the
  scripts are plain `.mjs`, and each suite imports its script, so a syntax error fails it. (`node --check` parses
  only the first file it is given, so it is not used on a glob.)
- **Peer review.** `node scripts/peer-review.mjs` reviews the working tree (everything, before a first commit);
  `--base main` reviews a branch, `--model <id>` picks a stronger reviewer, `--effort <level>` sets how hard it
  thinks (default `max`; a run that reports no reasoning, or does not say, prints a warning), `--dry-run`
  prints the file list and token estimate without calling the API, and `--max-tokens <n>` refuses a pack bigger than
  that. It needs Node 18+ and `OPENROUTER_API_KEY`, or `--key-file <path>` to a file holding
  the key alone, as JSON, or as a `.env` line. Pass `--focus "<what the change is and where to look>"`: a focused
  run finds what an unfocused one misses. Its own tests: `node --test scripts/peer-review.test.mjs`.
  Every repo copies this kit, so a bug here ships to all of them: once the lead and the owner agree the change is
  stable, review it again after each round of fixes, until a round comes back with no confirmed findings.
  The kit passes `--model xiaomi/mimo-v2.6-pro`: on this repo's first restructure it matched `moonshotai/kimi-k3`,
  the script's default, at a twelfth of the cost ($0.03 against $0.31 a round), and repeated rounds make cost count.
  MiMo only thinks when asked, so it needs an effort sent; before the script sent one, it skipped reasoning on half
  its runs. Which level makes no difference: low, high and max each reasoned 15–20k tokens on the same diff. A run
  the script warns about does not count as a round.
- **Real checks.** A change to the hook or a phase file: run
  `echo '{"session_id":"t","cwd":"."}' | node scripts/handoff-hook.mjs session-start` and read what a session is
  handed, then delete `.claude/handoff/t.json`. A change to what gets copied: run BOOTSTRAP §2 into an empty
  `git init` directory and inspect the result.
- **Data.** The hook writes `.claude/handoff/<session>.json`; records written before a hook change must still load
  after it.
- **Downstream.** A change to a verbatim file names, in CLAUDE.md's "Next up", the repos to re-copy it into.
- **Commits.** The owner commits. Never commit without being asked.
