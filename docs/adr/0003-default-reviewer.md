# 0003. The default reviewer is MiMo, and a failed call is retried or handed to the owner by its cause

Date: 2026-10-24

## Context
The default was `moonshotai/kimi-k3`. On the kit's first restructure `xiaomi/mimo-v2.6-pro` matched it at a twelfth
of the cost ($0.03 against $0.31 a round), and the kit reviews in repeated rounds. MiMo reasons only when asked; since
the script sends an effort it has reasoned on 17 of 17 runs, at $0.01–0.05 a round.

The script retried only a 429 or 5xx, once: a stalled stream or an error after `200 OK` ended the run (twice, while a
MiMo provider was degraded), and a 402 (out of credits) printed as raw text.

## Decision
- **Default reviewer:** MiMo is every repo's default reviewer, chosen by the owner without a comparison round.
  `--model` or `PEER_REVIEW_MODEL` still picks another.
- **Failures the owner must fix:** an HTTP 401, a 402 or a 403, and a missing key, exit with code 2 and no retry.
  The one exception is a 402 from OpenRouter's in-flight budget.
- **Failures worth retrying** get two more attempts (`callModel`, `classifyFailure` in `scripts/peer-review.mjs`):
  - Which: a stall (5 minutes without data, before or during the stream), an error sent after `200 OK` (whatever
    its code), a network failure, and a 408, 429 or 5xx status.
  - Each retry skips the provider that failed, named in the stream chunks or the error's metadata, via
    `provider.ignore`. When every provider has been skipped, the attempt that remains asks all of them again.
  - The wait is `Retry-After` when OpenRouter sends one, capped at 60 s, and otherwise 5 s, then 20 s.
- **Failures that end the run:** any other 4xx, and the 30-minute overall timeout.

## Consequences
- An error sent mid-stream never tells the owner to act directly. A real key or credit problem comes back as an HTTP
  status on the next attempt, which costs one extra attempt.
- No balance check runs before the call, because OpenRouter's credits endpoint needs a management key.
- MiMo had five providers on OpenRouter on 2026-10-24. If its pool shrinks to one or two, skipping providers buys
  less.
- If MiMo starts missing what a stronger model catches, revisit the default, not the review rounds.
