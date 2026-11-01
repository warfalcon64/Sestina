<div align="center">

# Sestina

A lightweight harness on top of Claude Code that walks every change through the same six phases.

[![test](https://github.com/warfalcon64/Sestina/actions/workflows/test.yml/badge.svg)](https://github.com/warfalcon64/Sestina/actions/workflows/test.yml) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![node](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org/)

<sub>formerly doc-system-kit</sub>

</div>

Claude Code forgets a lot between sessions. A `/clear` or a compaction drops whatever lived only in the
conversation, and a workflow written down in a file tends to get skipped. Sestina puts the process in front of every
session with hooks, keeps a running handoff file so a fresh session can pick up in the middle of a change, and stops
for you at the three points where your call matters: the design choice, the go-ahead and the commit.

The name comes from the poem: six stanzas whose end words come back in a fixed order. Here every change goes through
the same six phases in the same order, a one-line fix as much as a feature.

## The six phases

| Phase | Done when |
|---|---|
| 1. Brainstorm | you've picked an option, or there was no real choice to make |
| 2. Plan | you've approved the plan |
| 3. Implement | the diff has been read and the tests pass |
| 4. Peer review | a model from another family has read the diff, and every finding has a verdict |
| 5. Harden | it's been checked against the real world, and what wasn't checked is said |
| 6. Merge prep | the docs match the code and the commit is ready for you |

Each phase has a minimum form, so a small fix gets through all six in a couple of minutes. The phase files live in
[docs/workflow/](docs/workflow/README.md).

## What's in it

Four Node scripts and a set of Markdown files. The scripts use Node 18 built-ins only, so there's nothing to install,
and the Markdown works in a repo of any language.

- `scripts/handoff-hook.mjs` hooks into Claude Code. At the start of a session it loads the workflow, the current
  phase and the handoff notes, and it nudges when a turn ends without writing down what happened.
- `scripts/peer-review.mjs` sends the uncommitted diff to a model from a different family through OpenRouter, so the
  change gets read by something that doesn't share Claude's blind spots.
- `scripts/bootstrap.mjs` sets the system up in a repo, or re-copies it into one that already runs it, without
  touching that repo's own notes, decision records or settings.
- `scripts/doc-check.mjs` lints the docs: oversized decision records, dead links, stale `file:line` pointers.

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

Then fill in the templates it copied; [BOOTSTRAP.md](BOOTSTRAP.md) walks through it. From then on, sessions in that
repo get the workflow on their own. When a change reaches phase 4:

```sh
node scripts/peer-review.mjs --key-file .env
```

## Design notes

A few choices worth knowing about, each written up as a decision record:

- No dependencies, so a Python or Rust repo doesn't grow a `package.json` for a few dev tools
  ([0006](docs/adr/0006-script-runtime.md)).
- Setting up and re-copying are the same idempotent run, and anything it can't merge safely is handed back instead
  of overwritten ([0004](docs/adr/0004-bootstrap-sync.md)).
- The reviewer is reached through OpenRouter, so switching models is just a model id. The default is picked for cost
  per round, since a change can take several rounds
  ([0003](docs/adr/0003-default-reviewer.md), [0008](docs/adr/0008-reviewer-access.md)).
- Hooks rather than a command you have to remember: a crash or an idle compaction doesn't wait for you to run
  anything ([0007](docs/adr/0007-target-agent.md)).

The full list is in [docs/adr/](docs/adr/README.md).

## Development

```sh
node --test scripts/*.test.mjs   # 163 tests across four suites
node scripts/doc-check.mjs
```

CI runs both on Node 18 and 24. Sestina is developed with itself: every change to it walks the same six phases.
