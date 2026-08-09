# Build 1019 — Controlled Quote Draft Execution

Version: `1.5.7`

## Objective

Introduce the first narrowly controlled post-confirmation business action: creation of exactly one Draft Quote from a valid `initiate-quote` workflow receipt.

## Implementation

- Keeps Client 360 orchestration-only and Quote CRUD destination-owned.
- Revalidates actor, permissions, receipt lifecycle, action, destination, relationships, context, and payload on the server.
- Forces `Draft` status and `Pending` client decision.
- Accepts zero or one Policy ID and fails closed for lossy or multi-policy context.
- Adds destination-owned workflow receipt idempotency.
- Adds precise `EXECUTION_STARTED` and `DESTINATION_COMMITTED` audit evidence.
- Supports safe reconciliation when the Quote write succeeds but final audit append fails.

## Schema

Quotes schema version 2 additively appends `Workflow Receipt ID`. Existing rows and CRUD behavior are preserved. No column is deleted, reordered, or rewritten.

## Security guarantees

- Receipts remain evidence and never grant authorization.
- Execution requires fresh `client360.view` and `quotes.create` checks.
- Actor and authoritative context are server-derived.
- Browser payloads use a strict field allowlist.
- Unknown and authority-owned fields are rejected.
- Execution is bounded by one authoritative script lock.
- Client 360 never instantiates `QuoteRepository`.

## Compatibility

Normal Quote CRUD remains independent and backward-compatible. Builds 1013–1018 contracts remain supported.

## Tests

Build 1019 includes core and integrated coverage for authorization, lifecycle integrity, policy bounds, mass assignment, idempotency, concurrency lock coverage, duplicate evidence, write failure, and audit reconciliation.

## Known limitations

- Only `initiate-quote` can execute.
- Only one Draft Quote can be created per receipt.
- Automated background reconciliation is not included.
- Google Sheets cannot provide cross-sheet transactions; the immutable destination receipt enables deterministic recovery.
