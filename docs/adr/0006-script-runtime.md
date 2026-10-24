# 0006. The scripts need Node 18+ and nothing else, and the system works without them

Date: 2026-10-24

## Context
The repos that run the system are in any language. An install step, or a `node_modules` in a repo that is not
JavaScript, is a cost every one of them would pay for a few development tools.

## Decision
The scripts use Node built-ins alone (`fetch`, `node:test`, `node:fs` and the like), and the kit has no
`package.json`: both the copied scripts and `scripts/bootstrap.mjs`, whose headers say so. `--no-node` leaves the
copied scripts out; the rest of the system is Markdown, and BOOTSTRAP §1 says what stands in for each script when it
is missing.

## Consequences
What a library would give is written by hand: the streamed reply is parsed in `readStream`
(`scripts/peer-review.mjs`), and each script parses its own arguments. No API newer than Node 18 goes into a script;
the test suites already need 18.6, for `describe` in `node:test`. Adding one dependency reopens this record.
