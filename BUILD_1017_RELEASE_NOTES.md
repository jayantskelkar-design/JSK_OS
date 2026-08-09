# JSK OS Build 1017 - Workflow Intent & Draft Action Layer

Version: `1.5.5`

## Objective

Add a server-authoritative, non-persistent review step between Client 360 action readiness and existing destination modules.

## Architecture

`JSKOS.WorkflowIntent` reuses the bounded Build 1015 `ClientContext` and fixed Build 1016 `ClientAction` catalog. `prepare()` derives an allowlisted draft for review. `handoff()` repeats normalization, action resolution, relationship validation, readiness, and destination permission checks before returning a fresh route. Neither operation performs a business write.

## Supported intents

The catalog remains limited to initiate/review Quote, open Policy, review Renewal, review Endorsements, open Company, and open Person.

## Security

- Client 360 view permission protects both APIs.
- Destination permission is evaluated during preparation and again during handoff.
- Unsupported, malformed, permission-blocked, and mismatched relationship context fails closed.
- Blocked responses contain no draft or destination route.
- Draft fields are explicitly allowlisted and Policy IDs remain capped at 50.
- Route parameters are context only and never authorization.
- Destination modules retain validation and all write ownership.

## Performance and relationship integrity

Intent derivation performs no repository scan or persistence. Relationship validation uses one bounded Person lookup only when both Company and Person context are present. No N+1 access, automatic repair, or duplicated module query is introduced.

## UX

Client 360 provides Prepare, Review Context, and server-revalidated Continue steps. Incomplete intents show safe missing fields; blocked and unsupported intents provide no continuation.

## Validation

Build 1017 tests cover normalization, action resolution, malformed and unsupported input, permission isolation and handoff revalidation, incomplete/blocked states, allowlisted drafts, field exclusion, Policy bounds, safe destination URLs, tampering, relationship mismatch, non-persistence, no writes, and UI rendering. Builds 1013-1016 and Client 360 regressions, syntax, rendering, diff, migration, and secret scans remain required.

## Limitations

Intents are request-derived and are not saved. No workflow scheduler, approval engine, automatic action, communication, payment, schema migration, Client entity, deployment, tag, or release is included.
