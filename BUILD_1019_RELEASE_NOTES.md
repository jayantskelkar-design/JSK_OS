# Build 1019 — Controlled Quote Draft Execution

Version: `1.5.7`

## Objective

Introduce the first narrowly controlled post-confirmation business action: creation of exactly one Draft Quote from a valid `initiate-quote` workflow receipt.

## Implementation

- Keeps Client 360 orchestration-only and Quote CRUD destination-owned.
- Revalidates actor, permissions, receipt lifecycle, action, destination, relationships, context, and payload on the server.
- Recomputes the Workflow Intent plus context, draft, and destination-bound correlation fingerprints inside the execution lock before any Quote lookup or write.
- Forces `Draft` status and `Pending` client decision.
- Accepts zero or one Policy ID and fails closed for lossy or multi-policy context.
- Adds destination-owned workflow receipt idempotency.
- Adds precise `EXECUTION_STARTED` and `DESTINATION_COMMITTED` audit evidence.
- Supports safe reconciliation when the Quote write succeeds but final audit append fails.
- Permits audit-only reconciliation at or after receipt expiry only when a valid pre-expiry execution start and exactly one matching immutable Quote already exist.

## Schema

Quotes schema version 2 additively appends `Workflow Receipt ID`. Migration now recognizes only the exact v1 or v2 layout, preserves every business row, rejects missing, duplicate, reordered, and partial incompatible headers, and is lock-protected and idempotent. No column is deleted, reordered, or rewritten.

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

Build 1019 includes 24 core and 24 integrated checks covering authorization, authoritative fingerprint tampering, lifecycle integrity, exact-expiry and post-expiry audit-only reconciliation, policy bounds, mass assignment, idempotency, deterministic lock contenders, duplicate evidence, write failure, and faithful Quote v1-v2 migration fixtures.

## Known limitations

- Only `initiate-quote` can execute.
- Only one Draft Quote can be created per receipt.
- Automated background reconciliation is not included.
- Google Sheets cannot provide cross-sheet transactions; the immutable destination receipt enables deterministic recovery.
