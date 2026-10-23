# <Project> — notes for Claude Code

<One line: what the app is and the stack. Two at most.>

## Commands
- `<dev>`, `<test>`, `<typecheck>`, `<build>`.
- <Any command that costs money or minutes, with when to run it and when not to.>
- <How the running app is verified without a person: the command, and what to look at.>

## Rules
- <One line per rule that a fresh session would otherwise break, each ending with the ADR that decided it. Ten to
  fifteen lines. A rule with no ADR is an opinion; write the ADR or drop the rule.>

## UI conventions
- <Palette, icons, copy voice: the things that make a diff look wrong before it is wrong. Delete if no UI.>

## Docs
- `docs/handoff.md` — read first: notes on the change in progress, kept current as it goes. Its header holds the
  rules.
- `docs/architecture.md` — the shape of the app and which file to open. Read before working in an unfamiliar
  subsystem; update it when structure moves.
- `docs/adr/README.md` — index of architecture decision records, one row each. Read the row before changing a
  subsystem it covers; open the file when the row is not enough.
- `docs/glossary.md` — what our words mean. Add a term when you coin one.
- <If the map and glossary are deferred (BOOTSTRAP §1), replace their two lines above with one saying they are not
  written yet and what starts them.>
- `docs/spec.md` — the design for what is **not** built yet, plus a one-note record of what is. Built work
  collapses to a `**Built.**` note there; the reasoning goes to an ADR, never back into the spec.
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
Each item is its own change and starts at phase 1 (brainstorm), not at the code.
<Two to five lines: what comes next and in what order, pointing at spec sections. Rewritten at every merge prep. This
is the paragraph the next session reads first, so it must be true on the day it is read.>
