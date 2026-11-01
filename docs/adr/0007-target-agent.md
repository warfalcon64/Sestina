# 0007. The kit is built for Claude Code, the only agent its owner uses

Date: 2026-10-24

## Context
Prose alone does not make a session act on it. Claude Code's hooks and plan mode enforce what the docs ask: the
handoff gets written, the phase files are put in context, and phases 1 and 2 are read-only in fact, not only by
instruction (265ef55; SYSTEM.md rules 9 and 10). Other agents are not excluded, in the owner's words; none is in use.

## Decision
The hooks in `.claude/settings.json` run `scripts/handoff-hook.mjs`, and phases 1 and 2 happen in plan mode
(`docs/workflow/01-brainstorm.md`, `02-plan.md`).

## Consequences
Another agent gets the Markdown without the enforcement. Supporting one is a new decision, made once such an agent is
in use; until then nothing Claude-specific is stripped for a portability nobody uses.
