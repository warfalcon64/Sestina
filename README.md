# Sestina

<sub>formerly doc-system-kit</sub>

A lightweight harness that sits on top of Claude Code and keeps every change on a six-phase workflow, with a
documentation system the agent keeps honest.

[![CI](https://github.com/warfalcon64/Sestina/actions/workflows/test.yml/badge.svg)](https://github.com/warfalcon64/Sestina/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org/)

A sestina is a poem of six stanzas whose end words return in a fixed order. Every change here walks the same six
phases in the same order, and the name sits beside Claude's own poetic model names: Haiku, Sonnet, Opus.

## Why

AI coding sessions lose context on `/clear` and compaction, and they skip process when it lives only in a file on
disk. Sestina writes the process down, then has Claude Code hooks put it in front of every session: the workflow, the
phase in progress and the notes on the change so far. The owner steers, and work stops for them at three points.

## Features

- **Six phases, three owner stops.** Brainstorm, plan, implement, peer review, harden, merge prep. Work stops for the
  owner at the design choice, the go-ahead and the commit.
- **Hooks that carry the context.** `scripts/handoff-hook.mjs` loads the workflow, the current phase file and the
  handoff notes at each session start, and nudges when a turn ends without writing them down.
- **Cross-family peer review.** `scripts/peer-review.mjs` sends the uncommitted diff to a model from another family
  through OpenRouter; every finding is checked against the code before it is acted on.
- **One idempotent sync.** `scripts/bootstrap.mjs` sets the system up in a repo or re-copies it into one that already
  runs it, keeping that repo's own notes, records and settings.
- **A docs linter.** `scripts/doc-check.mjs` fails oversized decision records, dead links, stale `path:line`
  pointers and rules that cite no decision.
- **Zero dependencies.** Node 18 built-ins only: no `package.json`, nothing to install.

## How it works

| Phase | Ends with |
|---|---|
| 1. Brainstorm | the owner's choice, or "no open design question" |
| 2. Plan | a plan the owner approves |
| 3. Implement | a diff the lead has read, tests green |
| 4. Peer review | a verdict per outside finding |
| 5. Harden | what was checked for real, and what was not |
| 6. Merge prep | the ready-to-commit summary |

Each phase has a minimum form, so a one-line fix walks all six in minutes. The phase files are in
[docs/workflow/](docs/workflow/README.md).

## Quick start

Requirements: [Claude Code](https://code.claude.com/docs/en/overview), Node 18 or later, and an
OpenRouter key if you want peer review.

```sh
git clone https://github.com/warfalcon64/Sestina.git && cd Sestina
node scripts/bootstrap.mjs <repo> --dry-run   # shows what it would write
node scripts/bootstrap.mjs <repo>             # sets it up, or re-copies it
```

Then fill in the placeholders the sync copied, following [BOOTSTRAP.md](BOOTSTRAP.md). In phase 4, inside the repo:

```sh
node scripts/peer-review.mjs --key-file .env
```

## Repository layout

```
scripts/                the sync, the hook, the reviewer, the docs check, and a test suite for each
docs/workflow/          the six phase files and the workflow's index
docs/adr/               architecture decision records, one row each in the index
template/               fill-in files a repo gets once, placeholders and all
SYSTEM.md               the documentation system and its rules
BOOTSTRAP.md            how to set the system up in a repo
.claude/settings.json   the hooks, wired into Claude Code
```

## Design decisions

- **No dependencies.** The scripts use Node built-ins alone, and the Markdown works without them.
  [ADR 0006](docs/adr/0006-script-runtime.md)
- **One idempotent sync.** Setting up and re-copying are the same run; what cannot merge safely is handed back,
  never overwritten. [ADR 0004](docs/adr/0004-bootstrap-sync.md)
- **A reviewer from another model family.** Reached through OpenRouter, so the reviewer is a model id.
  [ADR 0003](docs/adr/0003-default-reviewer.md), [ADR 0008](docs/adr/0008-reviewer-access.md)
- **Hooks, not a command to remember.** The workflow is put in front of the session rather than left on disk.
  [ADR 0007](docs/adr/0007-target-agent.md), rules 9 and 10 in [SYSTEM.md](SYSTEM.md)

Every record is indexed in [docs/adr/README.md](docs/adr/README.md).

## Development

```sh
node --test scripts/*.test.mjs   # four suites, 163 tests
node scripts/doc-check.mjs       # the docs against their own rules
```

CI runs both on Node 18 and 24.

## How it's built

Sestina is developed by Claude Code sessions running this same system, with the owner steering each change.

## The rules

The documentation system and the rules that make it work are in [SYSTEM.md](SYSTEM.md).

## License

MIT. See [LICENSE](LICENSE).
