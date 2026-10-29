# 0005. Each repo gets its own copy of the system: its shape, with no project's contents

Date: 2026-10-24

## Context
Claude Code reads `CLAUDE.md` and `.claude/settings.json` at a repo's root, and the hook hardcodes `docs/handoff.md`
and `docs/workflow/` (`HANDOFF` and `WORKFLOW` in `scripts/handoff-hook.mjs`), so the system's files must sit at fixed
paths in each repo. Four of them, the handoff, the ADR index, the settings file and `.gitignore`, are each half kit
and half repo. A git submodule does not fit today's layout: its files sit under one subdirectory, so the fixed paths
would need symlinks (rejected in 0001), it cannot own half a file, and it would bring the kit's own records. A package
does not fit either: the repos are in many languages, and a package installs into a folder its manager owns.

## Decision
Each repo holds a plain copy, made and refreshed by `scripts/bootstrap.mjs` (0004). The verbatim files name no
project; a project's facts live in its fill-in files (`template/`), as eb16a03 made them.

## Consequences
The repos drift between copies, and a re-copy is the price: each repo's hook says when one is due (0009), and a
change to a verbatim file names in CLAUDE.md's "Next up" the repos without that hook yet (`docs/workflow/project.md`,
Downstream). An example taken from one project goes into a
placeholder, never into a verbatim file.
