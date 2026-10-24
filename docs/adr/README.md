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

| # | Decision | Gist |
|---|---|---|
| 0001 | [The kit runs its own system at the root; only fill-in templates live in template/](0001-kit-layout.md) | Verbatim files live once at the root and are edited there; `template/` holds only placeholder files; the kit's own records are never copied. |
| 0002 | [Records stay under 400 words and are named by topic](0002-adr-length-naming.md) | Under 400 words, counted in words; file name is number plus a 2–4 word topic, never the title. |
| 0003 | [The default reviewer is MiMo, and a failed call is retried or handed to the owner by its cause](0003-default-reviewer.md) | `xiaomi/mimo-v2.6-pro` for cost per round; 401/402/403 and no key exit 2; stalls, mid-stream errors, 408/429/5xx retry twice skipping the failed provider. |
| 0004 | [Bootstrap is one idempotent sync, and the script holds the verbatim list](0004-bootstrap-sync.md) | `scripts/bootstrap.mjs <repo>` sets up and re-copies alike, deciding per file; keeps notes, rows, foreign hooks and filled-in files; hands back what it cannot merge safely; `VERBATIM` is the one list. |
