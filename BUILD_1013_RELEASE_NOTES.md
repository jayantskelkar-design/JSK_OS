# JSK OS Build 1013 - User Access & Security (v1.5.1)

## Phase 1-2: Access-control foundation and administrator UI

- Central role catalogue: Administrator, Manager, Executive, Staff and Read-only.
- Module/action permission matrix.
- Current-user access context backed by Script Properties.
- Route authorization and permission-filtered navigation.
- Access-denied page for unauthorized routes.
- Administrator APIs to list, assign and remove user roles.
- Access audit sheet for denied requests and role changes.
- Safe initial bootstrap: before any role configuration exists, the signed-in owner is Administrator.
- Administrator-only User Access screen for adding, editing and removing roles.
- Bootstrap administrator is preserved automatically when the first user is added.

## Script Properties

- `JSK_OS_ADMIN_EMAILS`: comma-separated administrator email addresses.
- `JSK_OS_USER_ROLES`: JSON map, for example `{"user@example.com":"Staff"}`.

Set `JSK_OS_ADMIN_EMAILS` first. Do not configure a role map until at least one
administrator email is present.

## Verification

Run `testBuild1013ReleaseCandidate`. Final acceptance requires three passed
regression group and zero failures.

## Build 1013 completion

- Phase 3: action-level guards across core module APIs completed.
- Phase 4: role isolation, route visibility and protected-wrapper audit completed.

## Release hardening

- Corrected Company and People filter endpoints for the operation-aware API wrapper signature.
- Protected module filter and document-link option endpoints with view permissions.
- Registered Build 1013 in stable-readiness regression coverage.
- Application version advanced from v1.5.0 to v1.5.1 as a backward-compatible security patch.
