# Bootstrapping the system in a new repo

Do this yourself, or hand this file to a session with "set up the doc system from this kit". Either way, the order
matters: each file is filled from the ones before it, and the assumptions in the last section have to be true first.

## 1. Check the assumptions

The system leans on these. Where one is false, fix it first or the docs describe a process that cannot run.

- **There is a test command and a typecheck command** (or the language's static check: a compiler, a linter), and
  they pass on a clean checkout. Phase 3 ends on them. Without them "green" means nothing and the harden phase has
  nothing to rerun. A repo with no code yet has neither: say so in `project.md`, and the stack choice names them.
- **Git, with the owner committing.** The workflow stops at the commit for the owner. If commits are automated, the
  merge-prep phase loses its checkpoint; say so in `project.md` rather than pretending.
- **A second model family is reachable for review.** `peer-review.mjs` needs Node 18+ (nothing else: no
  `package.json`, no install, whatever the repo's language) and OpenRouter (`OPENROUTER_API_KEY`, or `--key-file`;
  `PEER_REVIEW_MODEL` changes the default reviewer). Without either, phase 4 is the lead's own read of the diff; say
  so in `project.md` and keep the verdict-per-finding discipline for whatever review does happen.
- **The code is the source of truth.** The architecture page and the ADRs point at files; they never restate what a
  file does. If the project has no stable file layout yet (a prototype rewritten weekly), start with CLAUDE.md, the
  ADR index and the workflow only, and add the map and glossary once paths stop moving.
- **One owner.** "The owner steers" assumes one person's choices settle a fork. With several, name who decides in
  `project.md`.

## 2. Copy

```
cp -r <kit>/docs <repo>/docs
cp <kit>/scripts/peer-review.mjs <kit>/scripts/peer-review.test.mjs <repo>/scripts/
cp <kit>/CLAUDE.md <repo>/CLAUDE.md          # or merge into an existing one, keeping its facts
```

Add `.peer-review/` to `.gitignore`. The review runs as `node scripts/peer-review.mjs` from anywhere in the repo,
including one with no commits yet, and its tests as `node --test scripts/peer-review.test.mjs`. Without Node, skip
the two script files; nothing else in the kit needs it.

## 3. Fill, in this order

Each step reads the code, never memory or another project's docs. A fact you are not sure of is a question for the
owner, not a guess; a wrong path in the map or a wrong rule in CLAUDE.md is worse than a missing one, because the next
session will trust it.

1. **`docs/workflow/project.md`.** The commands and paths the phases defer to. Every line must be a command you have
   run in this repo today.
2. **`docs/adr/`.** Walk the code for decisions that a fresh session would plausibly undo: a dependency chosen over
   the obvious one, a layer that may not import another, a thing deliberately not done. Ask the owner for the ones
   the code cannot show (what was tried and abandoned). Write those, and only those, with `0001-template.md` as the
   shape. Five to ten records is a normal start; forty is the ceiling. Delete the template file.
3. **`CLAUDE.md`.** Commands from step 1; rules from step 2, each ending with its ADR number; the docs section as
   given; "Next up" from the owner. If a rule has no ADR behind it, either write the ADR now or leave the rule out.
4. **`docs/architecture.md`.** The layer table and import rules first, then one section per subsystem that matters,
   then the key flow numbered. Every path checked to exist. Add a "Not built" list pointing at spec sections.
5. **`docs/glossary.md`.** Only terms the project coined or uses in a particular sense. Ordinary words do not go in.
6. **`docs/spec.md`.** What is designed and not built, with the "where to pick up" section last. If nothing is
   designed ahead yet, keep the header and §0 and leave the rest empty; it fills at the first brainstorm.

## 4. Run one change through it

Pick a small real change and walk the six phases, reading each phase file on entry. The first pass finds what the
project-specific pages got wrong (a command that does not exist, a check that cannot run) and the fix goes into
`project.md` or CLAUDE.md before anything else does. A dry run of `node scripts/peer-review.mjs --dry-run` confirms the pack
size is sane before the first paid review.

## 5. What not to carry over

- **Campfire's rules.** Nothing about narrators, engines, providers or emoji applies anywhere else. If a rule reads
  as sensible for the new project, it still needs its own ADR with the new project's context.
- **Its ADR numbers.** Start at 0001. A record that says "see ADR 0021" from another repo is a broken pointer.
- **Its "Next up".** That paragraph is the most perishable line in the system; it is rewritten every merge prep and
  must be true on the day it is read.
- **Its memory rules.** Session memory (what the assistant keeps between sessions) is separate from the repo docs and
  is not part of this kit; anything the repo already records does not belong in memory.
