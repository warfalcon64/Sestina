# 0004. Bootstrap is one idempotent sync, and the script holds the verbatim list

Date: 2026-10-24

## Context
BOOTSTRAP §2 was a block of `cp` commands. Its `cp -r template/.` overwrote a repo's filled-in CLAUDE.md and docs, so
a repo already running the system was re-copied by hand, and the six downstream repos drifted: three lacked the
handoff and hook entirely, and every one had a stale peer-review script. The verbatim list lived in README prose, which
no code could read. An `--update` flag was rejected: forgetting it on a running repo overwrites what it filled in. Two
scripts (set up, re-copy) were rejected: they share nearly all their logic.

## Decision
`scripts/bootstrap.mjs <repo>` is one command for a new repo and a re-copy alike, and it decides per file from what
the repo holds, never from a mode. Verbatim files are overwritten when their bytes differ. The handoff keeps the repo's
notes under the kit's header; the ADR index keeps the repo's table under the kit's prose; the kit's hook commands
replace the repo's in `.claude/settings.json`, beside any others; missing `.gitignore` lines are appended. Fill-in
files are copied only while the repo has no `docs/workflow/project.md`, and never over a different file. Whatever it
cannot merge without losing something (notes off the header, a chained hook command, a malformed settings file) is
left untouched and reported for a merge by hand. `VERBATIM` in the script is the one list; the README describes the
files and points there. The script is the kit's own and is never copied.

## Consequences
A re-copy is the same command as a setup, and `--dry-run` previews either. Adding a verbatim file means adding it to
`VERBATIM`; a test fails when a phase file or script is missing from it. A re-copy never adds a fill-in file the repo
lacks, so a deferred map stays deferred. Prose a repo added to a verbatim file (FTL's ADR index paragraph) is replaced:
it shows in `git diff`, and keeping it means proposing it to the kit.
