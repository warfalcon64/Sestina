# 0009. Each repo learns at session start that a re-copy is due, and its own session runs it

Date: 2026-10-28

## Context
Re-copies were pushed from the kit's session: a change to a verbatim file named the repos in "Next up", and they
drifted until someone ran `bootstrap.mjs` into each. A per-repo record of the kit's path was rejected: a fresh clone
or another machine stays silent until bootstrapped there. A commit stamp compared with the kit's HEAD was rejected
too: it needs a second list of what is copied and flags kit commits that copy nothing.

## Decision
- **Where the kit is:** `DOC_SYSTEM_KIT`, set once per machine (`env` in `~/.claude/settings.json`, or the shell
  profile). Unset, or with no `scripts/bootstrap.mjs` there, the hook says nothing.
- **When a re-copy is due:** exactly when the sync would write something. At `session-start`, `handoff-hook.mjs`
  imports the kit's `bootstrap.mjs` and calls `drift(repo)`, a dry run of `sync` that returns the paths it would
  write and the files it would hand back. Hand-backs alone are not due: no sync clears them. The sync stays the one
  judge of what a copy holds (0004).
- **When it is said:** only at a clean point: the repo's handoff has no notes, git says its tree is clean, and the
  kit has no uncommitted change to a tracked file; and the session is neither a compaction, a resume nor in plan mode,
  where phases 1–2 run before any note can be written. So a change in progress is not interrupted, and the kit's
  unfinished work is not offered. Never in the kit itself.
- **Who copies:** never the hook. `recopyText` tells the session to tell the owner, and on their go to run the dry
  run, the sync and `git diff` from the repo, finishing what it hands back.

## Consequences
- The hook runs the kit's code at session start; any failure there, an older kit without `drift` included, is silent
  like every other hook failure.
- A repo only hears of re-copies once a re-copy has brought it this hook, and only on a machine that sets the variable.
- "Next up" still names the by-hand follow-ups a sync cannot do (a fill-in file that lags `template/`), since the
  notice reports only what the sync would write.
