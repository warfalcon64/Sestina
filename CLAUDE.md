# doc-system-kit — notes for Claude Code

The documentation system and six-phase workflow that other repos copy: Markdown plus three dependency-free Node 18
scripts.

## Commands
- `node --test scripts/*.test.mjs`: all three suites, and each imports its script, so a syntax error fails it.
- `node scripts/bootstrap.mjs <repo> [--dry-run] [--no-node]` sets the system up in a repo or re-copies it; it writes
  outside the kit, so dry-run first and get the owner's OK. ADR 0004.
- `node scripts/peer-review.mjs --key-file .env` costs money; run it in phase 4, not before. Exit 2 means OpenRouter
  needs the owner. ADR 0003 says why the default reviewer is MiMo.
- `echo '{"session_id":"t","cwd":"."}' | node scripts/handoff-hook.mjs session-start` shows what a session in the kit
  is handed. Delete `.claude/handoff/t.json` afterwards.

## Rules
- Verbatim files (`VERBATIM` in `scripts/bootstrap.mjs` lists them) are edited at the root and nowhere else; fill-in
  templates live only under `template/`; the root's own files never hold placeholders. ADR 0001.
- A new verbatim file goes into `VERBATIM`; the sync never gains a mode flag, and hands back what it cannot merge
  safely rather than overwriting it. ADR 0004.
- A record stays under 400 words and is named by its number and a topic, not its title. ADR 0002.

## Docs
- `docs/handoff.md` — read first: notes on the change in progress, kept current as it goes. Its header holds the
  rules.
- `docs/adr/README.md` — index of architecture decision records, one row each. Read the row before changing a
  subsystem it covers; open the file when the row is not enough.
- `docs/architecture.md` — which file to open: the layers (what is copied and how), the scripts, the sync's flow.
  Update it when structure moves. README.md describes the system and BOOTSTRAP.md how it is copied.
- `docs/glossary.md` — what our words mean. Add a term when you coin one.
- No spec yet; "Next up" is the backlog.
- `docs/workflow/` — the six phases every change walks, one file each. See below.

## Workflow
Every change walks six phases, however small: brainstorm, plan, implement, peer review, harden, merge prep. Each has a
minimum form, so a one-line fix takes minutes. Read `docs/workflow/0N-*.md` when you enter that phase, not before,
and `docs/workflow/project.md` for the commands and paths they defer to.
- Peer review is `node scripts/peer-review.mjs`: an outside model from another family reads the uncommitted diff, and every finding
  is checked against the code before it is acted on.
- The owner steers; work stops for them three times: the design choice (1), the go-ahead (2), the commit (6).
- Through every phase, keep `docs/handoff.md` current as you go, as its header says, so a cleared or compacted
  session can pick up the work.
- Merge prep is where the docs get honest: name the ADRs the work adds, rewrites or leaves alone and write them in the
  same commit, update what the change made stale, delete what stopped being true.

## Next up
Each item is its own change and starts at phase 1 (brainstorm), not at the code. In this order:
1. Backfill the kit's own founding decisions as ADRs in its `docs/adr/` (never copied): how the kit is built and
   shipped, not the README's rules for the repos that adopt it. Candidates, which phase 1 sorts against the record
   bar: copied into each repo rather than a submodule or package; scripts on Node 18+ alone, no `package.json` or
   install; scripts optional, the rest plain Markdown; review through OpenRouter (0003 says which model, not why
   OpenRouter); built for Claude Code's hooks and plan mode; hooks fail silently; the kit holds no project's contents.
   The reasons sit in the script headers, README and git log. 0001–0004 are already recorded.
2. Re-copy into the repos that run the system once the verbatim changes above land, so each is touched once: Campfire,
   FTL, IAF, ISK0, Laze and WebMedTools (New), each `Project <name>` under `~/Documents/Projects`. Run
   `node scripts/bootstrap.mjs <repo>`, dry-run first; it brings the verbatim files, the hook, its settings and the
   `.gitignore` lines. By hand, in each `project.md`: the `--key-file` wording and the exit-2 lines; all but Campfire
   the reworded opening line (the "only workflow file" claim); Campfire, IAF and WebMedTools "length, naming". IAF
   waits until the owner has keys.
