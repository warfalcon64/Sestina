# Architecture

The shape of the code, not its contents: the code is the source of truth, and this page is here so you know which file
to open. Why things are this way lives in `docs/adr/`; terms are defined in `docs/glossary.md`.

## Processes and layers

| Layer | Path | May import |
|---|---|---|
| <layer> | `<path>` | <what it may depend on> |

<One or two sentences on the rule the table encodes, with the ADR number that decided it.>

## <Subsystem>
- <One bullet per file or module that matters: what it owns, and the ADR that constrains it. Paths in backticks.>

## <A key flow, numbered>
1. <Entry point> parses the input.
2. <Next step, with the file.>
3. <...>

## Where things live
- <Data on disk, config, fixtures, scripts: one line each with its path.>

## Not built
- <Designed but not built: pointer to the spec section. One line each. Delete the line when it ships.>
