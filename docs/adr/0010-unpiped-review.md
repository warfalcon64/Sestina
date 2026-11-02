# 0010. A hook refuses a peer review whose output is piped, redirected or captured

Date: 2026-10-30

## Context
Sessions ran `peer-review.mjs` through `tail`, into a file, or in `$(…)`, so for its 10–16 minutes the owner saw
nothing: the per-minute `still working` lines are the review's only progress. A line in `04-peer-review.md` was
rejected (sessions skim the phase files), and so was shorter output from the script (the `tail` is a habit, not a
response to length). The script cannot tell for itself: under Claude Code its stdout is a pipe either way.

## Decision
- A `PreToolUse` hook on Bash runs `scripts/handoff-hook.mjs pre-tool`, wired in `.claude/settings.json`. When
  `reviewPiped` finds `node … peer-review.mjs` with stdout piped (`|`), redirected (`>`, `>>`, `1>`, `&>`) or
  captured (`$(…)`, backticks, `<(…)`), it denies with `REVIEW_REASON`: run the same command without it. Stdout
  is read up to the run's own list operator (`;`, `&&`, `||`, `&`, newline), and an enclosing `( )` or `{ }` is
  followed to its own pipe or redirect. `2>`, `2>&1`, `>&2`, `--help`, `-h` and `--dry-run` pass; heredoc bodies
  and quoted text are data, not runs.
- It lives in `handoff-hook.mjs`, not a script of its own: `bootstrap.mjs` knows the kit's settings entries by
  `HOOK_NAME`, so a new script's entry would be appended again on every re-copy unless the sync changed too (0004).

## Consequences
- Best effort: it reads the command's text, not the shell's grammar. A miss is the old behaviour; a false refusal
  blocks real work, so refusals stay narrow. Known misses, left on purpose: the run wrapped in `bash -c '…'` or a
  heredoc fed to a shell, a keyword compound (`if`, `while`, `until`, `for`) piped as a whole, a function whose
  body holds the run piped where it is called, an `exec >` before it, `2>file >&2` and a `<<` in quotes opening a
  phantom heredoc. One false refusal is left: a `case` pattern's `)` after the run, read as a group's close.
- Claude Code shows the deny as "PreToolUse:Bash hook error"; the command never runs and the session reads the reason.
- The hook runs on every Bash call and must stay silent and exit 0 on any failure, like the rest of the script.
- Every repo gets the settings entry and the script by re-copy, announced at session start (0009).
