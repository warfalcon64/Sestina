# Documentation system kit

The shape of Campfire's docs, without Campfire's contents. Copy it into a repo, then follow BOOTSTRAP.md. The
system is five files with one job each, plus a workflow that says when each file is touched.

| File | Job | Answers | Touched when |
|---|---|---|---|
| `CLAUDE.md` | the front door | what commands exist, which rules a fresh session would break, what is next | merge prep, and whenever a command or rule changes |
| `docs/architecture.md` | the map | which file to open | structure moves |
| `docs/adr/` | the why | why it is this way, so nobody undoes it | a decision is made, refined, reversed or dropped |
| `docs/glossary.md` | the words | what a coined term means and where it lives | a term is coined |
| `docs/spec.md` | the not-yet | what is designed but unbuilt, and in what order | a section ships (it collapses) or a design changes |
| `docs/workflow/` | the how | what each phase of a change requires | rarely; `project.md` when a command or path changes |

Copied verbatim, no edits needed: `docs/workflow/01-06*.md`, `docs/workflow/README.md`, `scripts/peer-review.mjs`
and its test. The script is the only piece with a runtime (Node 18+, nothing to install) and is optional; the rest is
plain Markdown for a repo in any language. Written fresh per repo: everything else. The templates here keep the wording of the rules and replace
every fact with an `<angle-bracket>` placeholder; a placeholder left in place is a bug.

## The rules that make it work

These are what a session is actually following. The files are just where the rules put things.

1. **One fact, one place.** A command lives in CLAUDE.md, a path in architecture.md, a reason in an ADR, a term in
   the glossary, a plan in the spec. A fact written twice drifts, and the next session trusts the stale copy.
2. **CLAUDE.md points; it does not explain.** Every rule line ends with the ADR that decided it. A rule with no ADR
   is an opinion: write the record or drop the rule. Keep it short enough to read every session.
3. **An ADR is a live decision, not a diary.** Edit in place when refined; rewrite under the same number when
   reversed, with the old approach folded into Context; delete when it stops applying. The bar for a new one: a later
   session could plausibly undo this and nothing in the code would tell them not to.
4. **The spec only holds what is not built.** When a section ships, it collapses to a `**Built.**` note and the
   reasoning moves to an ADR. Section numbers are referenced from code and ADRs, so they are never renumbered.
5. **Delete what stopped being true.** Git keeps history; a stale line costs every future session.
6. **The docs get honest at merge prep, in the same commit as the code.** Name the ADRs the change adds, rewrites or
   leaves alone; update what it made stale; rewrite "Next up".
7. **The owner steers.** Work stops for them at the design choice, the go-ahead and the commit.
8. **Peer review is advisory and verified.** An outside model from another family reads the diff; every finding is
   checked against the code and given a verdict; style notes are ignored.
