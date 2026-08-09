# Build 1020 — Quote Execution Operational Hardening and Reconciliation Control

Version: `1.5.8`

## Objective

Add a controlled, server-authoritative recovery path for Build 1019 Quote execution outcomes without introducing another business mutation.

## Implementation

- Adds the Administrator-only `quotes.reconcile` permission.
- Adds bounded exact Workflow Receipt lifecycle lookup with a maximum of four valid authority events.
- Adds read-only reconciliation inspection and audit-only reconciliation APIs.
- Distinguishes verified, uncertain, conflict, expired, lookup-unavailable, and audit-pending outcomes.
- Adds bounded, redacted operational diagnostics using stable status and reason codes.
- Adds an explicit inspect-then-confirm recovery flow to the Quote UI.
- Keeps zero-match execution outcomes fail-closed and never retries Quote creation.

## Immutable reconciliation identity

Reconciliation authority is based only on the immutable Workflow Receipt ID, canonical destination Quote ID, canonical actor/action/destination authority, Company/Person/Policy relationship identity, server-recomputed WorkflowIntent and fingerprints, and valid pre-existing lifecycle evidence.

Mutable Quote fields—including insurer, product, coverage, notes, status, client decision, assignment, and other normal business content—are not reconciliation authority. Normal authorized Quote updates remain independent. Reconciliation never restores or overwrites current Quote content.

## Security guarantees

- Only `initiate-quote` remains executable.
- Reconciliation cannot create, update, archive, or delete a Quote.
- Receipt evidence never grants authorization.
- Actor, permissions, relationships, intent, and fingerprints are freshly verified.
- Multiple, malformed, mismatched, or contradictory evidence fails closed.
- Post-expiry processing is audit-only and requires valid pre-expiry execution evidence plus exactly one verified Quote.
- Normal Quote CRUD cannot inject or modify Workflow Receipt ID.
- Generic Workflow_Audit append remains prohibited.
- Client 360 remains orchestration-only.

## Schema and compatibility

No schema migration is included. Quotes remain schema v2 and Workflow_Audit retains its existing fixed 15-column schema. Builds 1013–1019 and normal Quote CRUD remain backward-compatible.

## Tests

Build 1020 includes adversarial coverage for destination cardinality, delayed or unavailable lookup, audit outage, authority tampering, immutable identity, mutable business-field independence, exact expiry behavior, post-expiry audit-only recovery, idempotency, unauthorized access, malformed lifecycle evidence, safe diagnostics, strict payloads, destination ownership, permission boundaries, and bounded audit lookup.

## Known limitations

- Google Sheets cannot prove that an uncertain prior append did not occur. Zero matching Quotes after EXECUTION_STARTED therefore remain unresolved and cannot authorize retry creation.
- Receipt lookup is bounded by valid lifecycle cardinality, but underlying TextFinder search cost still grows with the Workflow_Audit sheet.
- Automatic or background reconciliation is not included.
- Conflicting or multiple destination evidence requires manual investigation outside the application; no force-complete control exists.
