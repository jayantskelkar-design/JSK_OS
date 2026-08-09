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
- Rechecks trusted server time before execution-start evidence and again inside the destination-owned append boundary; exact expiry never permits a new Quote.
- Returns `EXECUTION_UNCERTAIN` after an indeterminate write or read-back and never treats an absent row as permission to create again.
- Distinguishes explicitly classified audit-storage failures from integrity failures; contradictory evidence always fails closed.

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

Build 1019 includes 27 core and 27 integrated checks covering authorization, authoritative fingerprint tampering, lifecycle integrity, fresh exact-expiry mutation boundaries, post-expiry audit-only reconciliation, integrity-versus-storage error handling, uncertain-write recovery, policy bounds, mass assignment, idempotency, deterministic post-lookup lock contenders, duplicate evidence, and faithful Quote v1-v2 migration plus runtime CRUD fixtures.

## Known limitations

- Only `initiate-quote` can execute.
- Only one Draft Quote can be created per receipt.
- Automated background reconciliation is not included.
- An uncertain execution with no visible destination remains fail-closed and requires later visibility or manual investigation; it never creates another Quote automatically.
- Google Sheets cannot provide cross-sheet transactions; the immutable destination receipt enables deterministic recovery.
