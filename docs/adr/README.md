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
| 0001 | [<Title as a sentence>](0001-<topic>.md) | <One line: the rule, and what it forbids.> |
