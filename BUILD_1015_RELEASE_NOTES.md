# JSK OS Build 1015 - Unified Client Context and Relationship Integrity

Version: `1.5.3`

Status: feature validation only; no release, tag, deployment, or migration

## Implementation summary

- Added `JSKOS.ClientContext`, a shared read-only normalizer for Company, Person, and bounded Policy IDs.
- Added permission-protected contextual Quote, Revenue, and Endorsement search adapters.
- Added one-query bounded multi-policy endorsement filtering with a bounded single-policy fallback.
- Standardized Client 360 context metadata, query limits, deep links, and read-only relationship diagnostics.
- Added visible client-context banners, active-filter information, and a clear-context control.
- Preserved normal module behavior when no context is supplied.

## Files changed

Core Client Context, contextual APIs/tests, Client 360 service/tests, Endorsement repository, Router, Quote/Revenue/Endorsement/Client 360 UI scripts, release suites, local regression runners, configuration, and this release document.

## Security verification

- Contextual APIs require the target module's Build 1013 view permission before repository access.
- Unsupported standalone context returns no records instead of an unfiltered result.
- Contextual aggregate cards are derived only from the authorized filtered result.
- Unauthorized sections cannot contribute to Client 360 summaries, intelligence, timelines, relationship diagnostics, or counts.
- Repository failures expose generic user-safe messages.
- Client 360 remains read-only; no mutation API or repair action was added.

## Performance changes

- Company/Person linked modules use one contextual query instead of Company plus Person fan-out.
- Endorsements accept up to 50 normalized Policy IDs in one bounded repository search.
- Legacy endorsement fallback is capped at 25 policy queries.
- Independent revenue policy fallback is capped and never performs an unfiltered repository scan.
- Results expose `returned`, `available`, `truncated`, `limit`, and `queryCount` metadata.

## Relationship-integrity behavior

Read-only diagnostics detect orphaned Person-to-Company links, Persons without a Company, duplicate Person references, and mismatched linked Company/Person IDs. Diagnostics are capped at 50 and never repair, merge, delete, or rewrite business data.

## Tests

- Build 1015: context normalization, malformed identifiers, Policy ID bounds, matching/isolation, context preservation/clear, contextual Quote/Revenue behavior, relationship integrity, endorsement batching, query metadata, and read-only enforcement.
- Build 1014 Client 360 intelligence and Build 1013 access/security suites remain mandatory regressions.
- Browser scripts, routes/renders, JS/GS syntax, diff whitespace, and schema/config safety are validated locally.

## Known limitations

- Standalone Person context for modules without a native Person link uses a safe filtered fallback or returns no records.
- Revenue has no Person column; Person-only revenue requires bounded Policy IDs or a linked Company.
- Endorsement batching still reads the existing sheet once because there is no database index layer.
- Relationship anomalies are detection-only and require deliberate user review outside Client 360.

## Exact diff statistics

`18 files changed, 355 insertions(+), 27 deletions(-)`
