# 0002. Records stay under 400 words and are named by topic

Date: 2026-10-23

## Context
A count of 78 records across six projects found medians of 129–280 words; 18 ran over 300, 7 over 400 and 4 over 500.
The worst were 1,271 words (a 12-day trial log in Context) and 890 (a recipe in Decision). Both already broke "not a
diary"; a cap gives that rule a measurable trigger. 500 was rejected: it lets the recipe-style records through. 300
was rejected: it flags 18 records, many of them fine. Records were named by a slug of their title, which states the
opposite once a reversed decision is rewritten under the same number.

## Decision
A record stays under 400 words, about twice the typical one, counted in words rather than lines because wrap width
varies. `scripts/doc-check.mjs` fails a record at 400 and warns past 40 records; merge prep step 1
(`docs/workflow/06-merge-prep.md`) trims. The ~40-record cap stays: it bounds the index, read every time, while the
word cap bounds one file, opened rarely, and the count cap stops records being split just to dodge the word cap. A
file name is the number plus a topic of two to four words; the title stays a sentence. Both are in
`docs/adr/README.md`, paragraph 2.

## Consequences
Existing records in other repos are not renamed. Trimming keeps each "X was tried and failed because Y" sentence; if
trimmed records start losing them, this decision is wrong and should be reversed.
