# Architecture decision records

Why this project is built the way it is, so a later session does not quietly undo it. One decision per file, Nygard
shape: context, decision, consequences. The bar is simple: a later session could plausibly undo this and nothing in
the code would tell them not to. Prefer extending a related record to adding a file; past ~40 records, merge or prune.

A record stays under 400 words. Past that it has usually become a diary or a recipe: fold each rejected approach to
one sentence, leave the trial history to git and the parameters to the code the record points at, and split a record
that holds two decisions. Its title is a sentence stating the decision; its file name is the number and a topic of
two to four words (`0007-cache-layout.md`), which stays true when the decision is refined or reversed.

This library holds **live** decisions only. Edit a record in place when it is refined or its file pointers move; when a
decision is reversed, rewrite that record under its own number with the old approach folded into Context (that sentence
is what stops the old idea coming back); when it stops applying at all, delete the file and its row. Git keeps history.
Read the row you need here before changing a subsystem, and open the file only if the row is not enough.

Each record is `NNNN-<topic>.md` with a `Date:` line and three sections: Context (include the rejected approach in one
sentence), Decision (with file pointers), Consequences (what it forbids and costs).

| # | Decision | Gist |
|---|---|---|
| 0001 | [The kit runs its own system at the root; only fill-in templates live in template/](0001-kit-layout.md) | Verbatim files live once at the root and are edited there; `template/` holds only placeholder files, which hold only a repo's own facts (a kit tool's flags are in its `--help`); the kit's own records are never copied. |
| 0002 | [Records stay under 400 words and are named by topic](0002-adr-length-naming.md) | Under 400 words, counted in words; file name is number plus a 2–4 word topic, never the title. |
| 0003 | [The default reviewer is MiMo, and a failed call is retried or handed to the owner by its cause](0003-default-reviewer.md) | `xiaomi/mimo-v2.6-pro` for cost per round; 401/402/403 and no key exit 2; stalls, mid-stream errors, 408/429/5xx retry twice skipping the failed provider. |
| 0004 | [Bootstrap is one idempotent sync, and the script holds the verbatim list](0004-bootstrap-sync.md) | `scripts/bootstrap.mjs <repo>` sets up and re-copies alike, deciding per file; keeps notes, rows, foreign hooks and filled-in files; hands back what it cannot merge safely; `VERBATIM` is the one list. |
| 0005 | [Each repo gets its own copy of the system: its shape, with no project's contents](0005-kit-distribution.md) | Copied by `bootstrap.mjs`, not a submodule or package: fixed paths and half-kit files; verbatim files name no project; drift is paid for by re-copies. |
| 0006 | [The scripts need Node 18+ and nothing else, and the system works without them](0006-script-runtime.md) | Built-ins only, no `package.json`; `--no-node` skips the copied scripts; parsing is hand-written; one dependency reopens it. |
| 0007 | [The kit is built for Claude Code, the only agent its owner uses](0007-target-agent.md) | Hooks and plan mode enforce the handoff and phases 1–2; other agents get the Markdown, not excluded but unused. |
| 0008 | [Peer review reaches other model families through OpenRouter](0008-reviewer-access.md) | One key and API, reviewer chosen by model id (`API_URL`, `--model`); an OpenRouter outage blocks review. |
