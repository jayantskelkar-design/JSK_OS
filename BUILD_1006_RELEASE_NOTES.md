# JSK OS Build 1006 — v1.5.0-beta

## Included

- Communication Center with channel and status filters
- Communication history, delivery counters and controlled retry support
- WA Lead WhatsApp provider and five-minute outbox automation
- Approved renewal-template bot-flow fallback outside the 24-hour window
- Meta WhatsApp Cloud API provider foundation and delivery-status parsing
- Communication route integrated across desktop and mobile navigation
- Duplicate-safe queued-message processing with retry scheduling

## Release validation

Run `testBuild1006ReleaseCandidate` in Google Apps Script. Acceptance requires five passed regression groups and zero failures.

## Production activation

Update the existing active Web App deployment to a new version with description `Build 1006 v1.5.0-beta`. Keep the existing WA Lead communication automation trigger enabled.
