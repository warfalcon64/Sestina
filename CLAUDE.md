# doc-system-kit — notes for Claude Code

The documentation system and six-phase workflow that other repos copy: Markdown plus four dependency-free Node 18
scripts.

## Commands
- `node --test scripts/*.test.mjs`: all four suites, and each imports its script, so a syntax error fails it.
- `node scripts/doc-check.mjs` checks the docs against ADR 0002 and each other; it runs beside the tests.
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
- Verbatim files name no project; a project's facts go in its fill-in files. ADR 0005.
- Scripts use Node 18+ built-ins alone: no `package.json`, no dependency. ADR 0006.

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
1. Re-copy into the two repos that run the system without the hook that announces verbatim changes (ADR 0009),
   each `Project <name>` under `~/Documents/Projects`, deferred by the owner: Campfire once its uncommitted
   `docs/adr/README.md` is committed, IAF once the owner has keys. Run `node scripts/bootstrap.mjs <repo>`, dry-run
   first. By hand, in Campfire's and IAF's `project.md`: the Peer review bullet cut down to the template's shape,
   keeping the repo's own command, key and model; "length, naming"; the Checks line gains
   `node scripts/doc-check.mjs`; IAF also the reworded opening line (the "only workflow file" claim). In their
   CLAUDE.md, the template's `docs/handoff.md` line under Docs and its bullet under Workflow. Campfire's 0014 and
   0032 trimmed under 400 words. WebMedTools' re-copy had no outside review (OpenRouter rejected its key): review
   that commit with `--base` once the key works.
