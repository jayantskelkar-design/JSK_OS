# JSK OS Build 1018 - Workflow Confirmation & Audit Receipt Foundation

Version: `1.5.6`

## Objective

Convert freshly revalidated Workflow Intents into durable, append-only confirmation evidence without executing destination business mutations.

## Architecture

`JSKOS.WorkflowConfirmation` recomputes reviewed intent state, validates an allowlisted draft fingerprint, derives the authenticated actor, creates an unpredictable receipt, and revalidates the receipt before handoff. Confirmation receipts never grant authorization; destination permissions are checked again through the existing Workflow Intent boundary.

## Workflow_Audit

The explicitly approved additive `Workflow_Audit` sheet stores workflow-control evidence only. Its fixed columns contain receipt/correlation identifiers, timestamp, actor, action and destination, bounded lifecycle state, normalized Company/Person/Policy context, deterministic fingerprints, expiry, parent receipt, and safe metadata. Events are append-only; handoff adds an event rather than updating confirmation history.

## Replay and safety

Confirmation uses locking, deterministic actor/action/context/draft correlation, bounded reverse lookup, duplicate receipt reuse, ambiguity rejection, 30-minute expiry, explicit state allowlists, and maximum 50 Policy IDs. Audit-write failure prevents confirmation success.

The corrective validation pass makes correlation check-and-append and the `CONFIRMED` → `HANDED_OFF` lifecycle transition atomic repository operations. Both re-read evidence while holding one bounded script lock, append at most one authoritative event, reuse an existing safe event, and fail closed on ambiguous or contradictory history. Existing `Workflow_Audit` sheets must match the complete canonical header exactly; initialization is locked, creates the additive sheet once, and never repairs or overwrites incompatible schemas.

Final hardening treats `expiry <= trusted server time` as expired everywhere and replaces the former 500-row evidence assumption with case-sensitive exact-key searches across the complete Correlation ID or Receipt ID column while the transaction lock is held. Lookup cost therefore grows with `Workflow_Audit` size; only matching rows are materialized in full, prioritizing correctness without scanning unrelated data columns. Deterministic barrier tests exercise contenders at the locked lookup boundary for confirmation, handoff, and first-time initialization.

Complete correlation histories now validate every `HANDED_OFF` event against exactly one structurally consistent `CONFIRMED` parent before new authority can be created. Audit policy context is validated without truncation: canonical unique Policy IDs are limited to 50, malformed or over-bounded stored evidence fails closed, and all repository write paths reject invalid policy lists.

Persisted authority fields now retain their raw sheet types and must match their canonical production formats: `WFR-` plus 24 uppercase hexadecimal receipt characters, lowercase 64-character hashes, millisecond UTC ISO timestamps, canonical actor/action/module and Company/Person identifiers, exact lifecycle states, and validated Policy IDs. Receipt IDs are globally unique across the complete audit sheet; correlated history rejects duplicate receipt authorities, and the locked confirmation append path fails closed on any cross-correlation or candidate receipt collision.

The repository's generic `append()` entry point now rejects all workflow authority events. `CONFIRMED` evidence can only reach the internal append primitive through the locked `appendConfirmedUnique()` transition, and `HANDED_OFF` evidence can only reach it through the locked `appendHandoffUnique()` transition.

Authority-sensitive policy context is now validated losslessly before normalization. Zero through 50 canonical unique Policy IDs are accepted exactly as supplied; over-bound, duplicate, malformed, null, mixed-type, truncated, or otherwise lossy policy selections fail closed during intent preparation, confirmation, receipt validation, and handoff.

## UX

Client 360 now guides Prepare → Review → Confirm → Receipt → Continue. Confirmation controls are disabled during requests, and the UI clearly states that no destination business record has been created.

## Security

- Browser actor, URL, status, and draft authority are never trusted.
- Client 360 and exact destination permissions are revalidated.
- Malformed, blocked, unsupported, mismatched, expired, replayed, or unverifiable evidence fails closed.
- Receipt responses are minimal and allowlisted.
- No Quote, Policy, Renewal, Endorsement, Company, or Person write API is invoked.
- Destination repositories retain all business-data ownership.

## Validation

Build 1018 tests cover confirmation, fingerprints and tampering, server actor derivation, duplicate handling, append-only lifecycle, receipt lookup/validation, permission revalidation, expiry, audit failure, UI rendering, repeated-click protection, and the no-write boundary. Builds 1013-1017 and Client 360 regressions, syntax, routes, schema, diff, and secret scans remain required.

## Limitations

Receipts are confirmation evidence, not business execution authority. Bounded sheet lookup is appropriate for this foundation but needs retention/indexing review before high-volume workflow execution. Build 1018 introduces no `EXECUTED` state, scheduler, approval engine, destination mutation, deployment, tag, or release.
