# JSK OS Build 1014 - Client 360 Operational Intelligence and Hardening

Version: `1.5.2`  
Status: feature validation; no release, tag, deployment, or database migration

## Objective

Make the read-only Client 360 view production-ready for servicing decisions while preserving Company and Person as the existing client identities.

## Implementation

- Deterministic Needs Attention queue for 30/60/90-day renewals, overdue and upcoming tasks, open claims, expiring quotes/documents, and outstanding revenue.
- Explicit priority, date-boundary, invalid-date, and tie-breaking rules.
- Normalized Company/Person IDs and record deduplication.
- Bounded aggregation (default 250, maximum 500) with returned/available counts, truncation, and query-count metadata.
- Company/person repository queries replace the prior per-related-person fan-out. Endorsement lookups remain policy-scoped because no safe batch contract exists.
- Per-source `ready`, `empty`, `unauthorized`, `failed`, and `stale` states plus an aggregate partial-health state.
- Generic client diagnostics; repository error details are logged server-side and are not returned to the browser.
- Permission-aware Client 360 sections and attention/timeline derivation from authorized data only.
- Context-preserving deep links to existing module routes. Existing filter parameters remain optional and backward compatible.
- Responsive Needs Attention, partial-data, stale-data, and bounded-result UI states.

## Priority rules

1. Critical: overdue tasks and expired quotes/documents.
2. High: renewals due within 30 days, tasks due within 7 days, open claims, and quotes/documents expiring within 30 days.
3. Medium: renewals due in 31-60 days, tasks due in 8-30 days, quotes/documents expiring in 31-60 days, and outstanding revenue.
4. Low: renewals due in 61-90 days.

Ordering is priority, due date, module, then entity ID. Missing or invalid dates never produce dated attention items.

## Security guarantees

- Client 360 remains read-only and exposes only `apiClient360Get`.
- Build 1013 `client360.view` route/API protection remains mandatory.
- Each source is checked against its own `<module>.view` permission before repository access.
- Unauthorized items cannot enter summaries, attention intelligence, timeline events, or diagnostics.

## Compatibility

- No new Client entity and no schema/database migration.
- Existing Company/People identity and CRUD contracts are unchanged.
- Existing repository search parameters and routes remain backward compatible.
- The v0.1 identity, relationships, sections, summary, timeline, and read-only metadata remain present.

## Tests

- Build 1014 intelligence contracts: attention ranking, exact 30/60/90 boundaries, deduplication/query bounds, Company/Person aggregation, partial failure, authorization isolation, deep-link context, UI rendering, limits/staleness, backward compatibility, and read-only enforcement.
- Existing Client 360 v0.1 and Build 1013 suites remain registered in stable-readiness validation.
- Local runner: `node tests/run-build1014.js`.

## Known limitations

- Apps Script repositories do not share one pagination contract; metadata is normalized at the Client 360 boundary.
- Endorsements require bounded policy-by-policy searches until a backward-compatible multi-policy filter exists.
- Context parameters are applied by modules with existing Company/Person search support; other screens retain the context in their URL but may require manual filtering.
- Staleness uses the newest available operational date and defaults to 90 days; undated empty sources are not labelled stale.
