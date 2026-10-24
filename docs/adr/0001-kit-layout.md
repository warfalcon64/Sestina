# 0001. The kit runs its own system at the root; only fill-in templates live in template/

Date: 2026-10-23

## Context
The kit was both a template and a project, and BOOTSTRAP copied `docs/` wholesale. So the root CLAUDE.md and
`docs/workflow/project.md` were templates, and every session in the kit loaded placeholders as its instructions (the
session-start hook printed `<typecheck command>`). The hooks wrote handoff notes into the very file being copied, and
the kit had no place for its own records. A root `adr/` folder alone was rejected: the placeholders would stay the
instructions. Moving everything copyable to `template/` was rejected: the hook hardcodes `docs/handoff.md` and
`docs/workflow/` (`scripts/handoff-hook.mjs:42` and `:44`), so the root would need symlinks or duplicates that drift.

## Decision
The verbatim files (`VERBATIM` in `scripts/bootstrap.mjs`) live once, at the root, and the kit runs them.
`template/` holds only the files with placeholders: CLAUDE.md, `docs/architecture.md`, `docs/glossary.md`,
`docs/spec.md`, `docs/adr/0001-template.md` and `docs/workflow/project.md`. The bootstrap script copies both, the
handoff's header without the kit's notes and the ADR index's prose; how it merges them is ADR 0004.

## Consequences
A copy is the verbatim list plus `template/`, not one `cp -r`. An edit to a verbatim file is exercised in the kit
first, by its own sessions. The kit's own CLAUDE.md, `docs/workflow/project.md` and records are never copied, and
never hold placeholders. Record length and naming are ADR 0002.
