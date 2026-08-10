# Build 1021 — Bounded Quote Reconciliation Operations Queue

Version: `1.5.9`

## Objective

Add a bounded, Administrator-only operational queue that helps authorized users discover Quote execution receipts needing fresh reconciliation inspection, without creating a new authority or mutation path.

## Implementation

- Discovers `initiate-quote` execution candidates from a maximum of 250 recent Workflow_Audit rows.
- Returns at most 50 safe advisory candidates per request.
- Uses an absolute backward cursor so older evidence remains reachable while new audit rows are appended.
- Distinguishes ready, empty, partial, and unavailable source states.
- Adds a protected Quote reconciliation queue API requiring `client360.view`, `quotes.view`, and `quotes.reconcile`.
- Adds an operations queue to the Quote UI with explicit loading, empty, partial, and unavailable states.
- Requires a fresh Build 1020 inspection before offering audit-only reconciliation.

## Security guarantees

- Queue results are advisory and never grant execution or reconciliation authority.
- Actor and all three permissions are derived and enforced server-side.
- Browser input is restricted to bounded numeric cursor and limit fields.
- Malformed, mixed-action, mixed-destination, and unavailable evidence fails closed or is marked partial.
- Sensitive actor, draft, payload, fingerprint, metadata, and Quote business fields are excluded from queue responses.
- Queue listing and inspection are read-only.
- Reconciliation retains Build 1020's locked, validated, audit-only `DESTINATION_COMMITTED` append boundary.
- No Quote create, update, archive, delete, retry-create, bulk action, or force-complete path is introduced.

## Persistence and compatibility

No schema migration or derived authoritative index is included. Workflow_Audit remains append-only with its existing fixed schema; Quotes remain schema v2. Existing Quote CRUD, Client 360 orchestration, and Builds 1013–1020 remain backward-compatible.

## Validation

Build 1021 covers bounded discovery, exact 250-row and 50-candidate limits, stable pagination, malformed and mixed evidence, unavailable storage and row reads, zero-write inspection, permission conjunction, safe responses, stale queue isolation, mutation ownership, and recovery UI behavior. The complete Builds 1013–1020 and Client 360 regression suites, syntax checks, route/render checks, diff validation, and repository safety scans are also run.

## Known limitations

- The queue is deliberately advisory and can become stale immediately after it is returned; every action requires fresh authoritative inspection.
- Pagination is a bounded backward scan over Workflow_Audit rather than an index, so users may need multiple pages to reach older candidates.
- A matching commit outside the scanned window may leave a resolved receipt visible as a candidate; fresh inspection resolves it safely.
- No background processing, notification, assignment, retry creation, bulk reconciliation, or force-complete capability is included.
