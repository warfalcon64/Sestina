# Architecture decision records

Why this project is built the way it is, so a later session does not quietly undo it. One decision per file, Nygard
shape: context, decision, consequences. The bar is simple: a later session could plausibly undo this and nothing in
the code would tell them not to. Prefer extending a related record to adding a file; past ~40 records, merge or prune.

This library holds **live** decisions only. Edit a record in place when it is refined or its file pointers move; when a
decision is reversed, rewrite that record under its own number with the old approach folded into Context (that sentence
is what stops the old idea coming back); when it stops applying at all, delete the file and its row. Git keeps history.
Read the row you need here before changing a subsystem, and open the file only if the row is not enough.

| # | Decision | Gist |
|---|---|---|
| 0001 | [<Title as a sentence>](0001-<slug>.md) | <One line: the rule, and what it forbids.> |
