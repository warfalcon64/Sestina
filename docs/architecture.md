# Architecture

The shape of the kit, not its contents: the files are the source of truth, and this page is here so you know which
file to open. Why things are this way lives in `docs/adr/`; terms are defined in `docs/glossary.md`.

## Layers

| Layer | Path | Copied into a repo (ADR 0005) |
|---|---|---|
| The system, as the kit runs it | `docs/workflow/`, `docs/handoff.md`, `docs/adr/README.md`, `.claude/settings.json` | verbatim (handoff: header only; index: prose only) |
| Copied tools | `scripts/peer-review.mjs`, `scripts/handoff-hook.mjs` and their tests | verbatim, unless `--no-node` |
| Fill-in files | `template/` | once, on a first setup, placeholders and all |
| The kit's own | `CLAUDE.md`, `README.md`, `BOOTSTRAP.md`, `docs/workflow/project.md`, `docs/adr/0*.md`, this page, the glossary, `scripts/bootstrap.mjs` | never |

Verbatim files live once, at the root, and are edited only there (ADR 0001); `VERBATIM` in `scripts/bootstrap.mjs` is
the exact list (ADR 0004).

## Scripts
- `scripts/bootstrap.mjs` — copies the system into a repo or re-copies it, one idempotent sync. ADR 0004.
- `scripts/peer-review.mjs` — sends the uncommitted diff to an outside model through OpenRouter. ADRs 0003 and 0008.
- `scripts/handoff-hook.mjs` — Claude Code hooks that put the handoff and the current phase file in context, and nudge
  when a turn ends without writing the handoff. Wired in `.claude/settings.json`; README rules 9 and 10. ADR 0007.

## The bootstrap sync
1. `main()` checks the target (exists, not the kit or inside it); `sync()` decides a first setup by the absence of the
   repo's `docs/workflow/project.md`, before writing anything.
2. `sync()` overwrites the `VERBATIM` files, merges the handoff (`joinHandoff`, guarded by `looseNotes`), the ADR index
   (`splitIndex`), the settings (`mergeSettings`, guarded by `mergeableSettings` and `chainsHandoffHook`) and
   `.gitignore` (`gitignoreAdditions`).
3. On a first setup it copies `template/`, `project.md` last; on a re-copy it only reports each fill-in file.
4. One line per path; anything it cannot merge safely is left untouched and reported for a merge by hand.

## Where things live
- `.peer-review/` — saved review results, gitignored.
- `.claude/handoff/<session>.json` — the hook's per-session records, gitignored.
- `.env` — the OpenRouter key for `--key-file`, gitignored.
