# 0003. The default reviewer is MiMo, and a failed call is retried or handed to the owner by its cause

Date: 2026-10-24

## Context
The default was `moonshotai/kimi-k3`; `xiaomi/mimo-v2.6-pro` matched it at a twelfth of the cost ($0.03 against
$0.31 a round), and the kit reviews in repeated rounds.

Only a 429 or 5xx was retried, once: a stalled stream or an error after `200 OK` ended the run. On one large diff
(2026-11-02) MiMo hit the 30-minute cap four times on slow providers, and three replies came back empty: the stream
closed with no finish reason or usage. Making `z-ai/glm-5.3` the default (8–11 minutes, ten times the cost) and
retrying a timeout (up to 90 minutes) were rejected.

## Decision
- **Default reviewer:** MiMo, chosen by the owner without a comparison round. `--model` or `PEER_REVIEW_MODEL` picks
  another.
- **Failures the owner must fix** exit 2 with no retry: an HTTP 401, a 402 (except from OpenRouter's in-flight
  budget) or a 403, and a missing key.
- **Failures worth retrying** get two more attempts (`callModel`, `classifyFailure` in `scripts/peer-review.mjs`):
  - Which: a stall (5 minutes without data), an error sent after `200 OK` (whatever its code), a stream that ends
    with no finish reason, a network failure, and a 408, 429 or 5xx status.
  - Each retry skips the provider that failed (`provider.ignore`); once every one is skipped, the last attempt asks
    them all again.
  - The wait is OpenRouter's `Retry-After`, capped at 60 s, else 5 s, then 20 s.
- **Routing:** every request sets `provider.sort: 'throughput'` (`requestBody`), so the fastest provider goes first.
- **Failures that end the run** (exit 1): any other 4xx, the 30-minute timeout (naming the provider that was
  streaming), and a finished reply that is not a JSON review, which is saved to `.peer-review/<stamp>.raw.json` and
  rerun by hand (04).

## Consequences
- An error sent mid-stream is retried even when it names a key or credit problem, which costs an attempt.
- No balance check runs before the call, because OpenRouter's credits endpoint needs a management key.
- Skipping providers buys less if MiMo's pool (five on 2026-10-24) shrinks to one or two.
- Sorting by throughput gives up load balancing: a failure that names no provider is retried on the same one.
- If MiMo starts missing what a stronger model catches, revisit the default, not the review rounds.
