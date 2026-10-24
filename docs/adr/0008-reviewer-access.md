# 0008. Peer review reaches other model families through OpenRouter

Date: 2026-10-24

## Context
Phase 4 needs a reviewer from another model family. The owner chose OpenRouter mainly for ease of use: one key, one
API, and the reviewer changed by a model id, as when kimi-k3 gave way to MiMo (0003). Calling each provider's own API
was rejected: it needs a key and a client per family.

## Decision
`scripts/peer-review.mjs` sends every call to OpenRouter (`API_URL`). The key comes from `OPENROUTER_API_KEY` or
`--key-file`, and `--model` picks the reviewer.

## Consequences
Review depends on one intermediary: an OpenRouter outage or an account problem blocks it, and the problems the owner
must fix exit 2 (0003). Retrying on another provider of the same model (`provider.ignore`) comes with it.
