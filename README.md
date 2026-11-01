<div align="center">

# Sestina

A lightweight harness on top of Claude Code that walks every change through the same six phases.

[![test](https://github.com/warfalcon64/Sestina/actions/workflows/test.yml/badge.svg)](https://github.com/warfalcon64/Sestina/actions/workflows/test.yml) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![node](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org/)

<sub>formerly doc-system-kit</sub>

</div>

Claude Code can forget a lot between sessions. A `/clear` or a compaction drops whatever lived solely in the
conversation, and workflows written down in files tend to get skipped. Sestina keeps the process in front of every
session with hooks, maintains a running handoff file for fresh sessions to resume in the middle of a change, and stops
for you at the three points where your input matters most: the design choice, the start of implementation, and the commit.

## The six phases

| Phase | Done when |
|---|---|
| 1. Brainstorm | you've picked an idea/goal, or there was no real choice to make |
| 2. Plan | you've approved the plan |
| 3. Implement | the diff has been read and the tests pass |
| 4. Peer review | another model has read the diff with a verdict for every finding |
| 5. Harden | it's been checked against the real world, and what wasn't checked is explicitly said |
| 6. Merge prep | the docs match the code, the commit is ready for you, and the handoff file is cleared |

Each phase can be minimal, so a small fix gets through all six in a couple of minutes. The phase files live in
[docs/workflow/](docs/workflow/README.md).

## What's in it

Four Node scripts and a set of Markdown files. The scripts use Node 18 built-ins only. There's nothing to install
and the Markdown works in a repo regardless of language.

- `scripts/handoff-hook.mjs` hooks into Claude Code. At the start of a session it loads the workflow, the current
  phase and the handoff notes, and it nudges when a turn ends without writing down what happened into the handoff file.
- `scripts/peer-review.mjs` sends the uncommitted diff to a model through OpenRouter.
- `scripts/bootstrap.mjs` sets the system up in a repo, or re-copies it into one that already runs it, without
  touching that repo's own notes, decision records, or settings.
- `scripts/doc-check.mjs` lints the docs by checking oversized decision records, dead links, and stale `file:line` pointers.

The rest is the docs themselves: the phase files, a template for each file a repo fills in, and
[SYSTEM.md](SYSTEM.md), which describes how the docs fit together.

## Getting started

You'll need [Claude Code](https://code.claude.com/docs/en/overview) and Node 18 or later. Peer review also needs an
OpenRouter key.

```sh
git clone https://github.com/warfalcon64/Sestina.git && cd Sestina
node scripts/bootstrap.mjs ../your-repo --dry-run   # see what it would write
node scripts/bootstrap.mjs ../your-repo
```

Then fill in the templates it copied. [BOOTSTRAP.md](BOOTSTRAP.md) walks through it. From then on, sessions in that
repo get the workflow on their own. When a change reaches phase 4:

```sh
node scripts/peer-review.mjs --key-file .env
```

## Design notes

There are a few choices worth knowing about. Each is written up as a decision record.

- No dependencies, so a Python or Rust repo doesn't grow a `package.json` for a few dev tools
  ([0006](docs/adr/0006-script-runtime.md)).
- Setting up and re-copying are the same idempotent run. Anything it can't merge safely is handed back instead
  of overwritten ([0004](docs/adr/0004-bootstrap-sync.md)).
- Switching the reviewer only requires a model id as the model is reached through OpenRouter. The default is picked for cost
  per round to account for a change taking several rounds while also having different blindspots than Claude for better coverage.
  ([0003](docs/adr/0003-default-reviewer.md), [0008](docs/adr/0008-reviewer-access.md)).
- Hooks are used in lieu of a command you have to remember so a crash or an idle compaction doesn't wait for you to run
  anything ([0007](docs/adr/0007-target-agent.md)). 

The full list is in [docs/adr/](docs/adr/README.md).

## Development

```sh
node --test scripts/*.test.mjs   # 163 tests across four suites
node scripts/doc-check.mjs
```

CI runs both on Node 18 and 24. Sestina is developed with itself. Every change to it walks the same six phases.
