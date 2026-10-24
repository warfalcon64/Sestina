# doc-system-kit — notes for Claude Code

The documentation system and six-phase workflow that other repos copy: Markdown plus two dependency-free Node 18
scripts.

## Commands
- `node --test scripts/*.test.mjs`: both suites, and each imports its script, so a syntax error fails it.
- `node scripts/peer-review.mjs --model xiaomi/mimo-v2.6-pro` costs money and needs `OPENROUTER_API_KEY`; run it in
  phase 4, not before. The kit reviews with that model; `docs/workflow/project.md` says why.
- `echo '{"session_id":"t","cwd":"."}' | node scripts/handoff-hook.mjs session-start` shows what a session in the kit
  is handed. Delete `.claude/handoff/t.json` afterwards.

## Rules
- Verbatim files (README.md lists them) are edited at the root and nowhere else; fill-in templates live only under
  `template/`; the root's own files never hold placeholders. ADR 0001.
- A record stays under 400 words and is named by its number and a topic, not its title. ADR 0002.

## Docs
- `docs/handoff.md` — read first: notes on the change in progress, kept current as it goes. Its header holds the
  rules.
- `docs/adr/README.md` — index of architecture decision records, one row each. Read the row before changing a
  subsystem it covers; open the file when the row is not enough.
- The map and glossary are not written yet: README.md describes the system and BOOTSTRAP.md how it is copied. They
  start when the scripts grow past two.
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
1. `scripts/peer-review.mjs` drops a streamed reply's last `data:` line when no newline follows it: `readStream`
   never flushes `tail` or the decoder after its loop. Fix with a test. Then, as a second change, let `--key-file`
   read a `KEY=value` file such as `.env`.
2. `template/docs/workflow/project.md` lines 3–4 claim it is the only workflow file that names a path or a command;
   reword it as the kit's own `project.md` does. Laze's copy needs the same line by hand.
3. The script's default reviewer is still `moonshotai/kimi-k3`; the kit itself now uses `xiaomi/mimo-v2.6-pro`. Decide
   whether every repo's default moves too, once MiMo has reviewed a code diff here (item 1 is one).
4. Bootstrap by script: copy and generate the files with code as far as possible, with a mode that re-copies into a
   repo already running the system and keeps its handoff notes and ADR rows.
5. Backfill the founding decisions as ADRs: README rules 1–10 are mostly unwritten records.
6. Re-copy into the repos that run the system once the verbatim changes above land, so each is touched once: Campfire,
   FTL, IAF, ISK0, Laze and WebMedTools (New), all under `~/Documents/Projects`. Each gets `.env` in `.gitignore`
   and the script fixes. Campfire, IAF and WebMedTools also lack c823ecd (the ADR length-and-naming paragraph,
   "length, naming" in `project.md`, merge prep's trim line) and the handoff hook. IAF waits until the owner has keys.
