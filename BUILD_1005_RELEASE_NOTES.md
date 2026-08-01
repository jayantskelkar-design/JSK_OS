# JSK OS Build 1005 — v1.4.0-beta

## Included

- Meeting schema v2, repository and CRUD APIs
- Responsive Meeting Management UI
- Company, person, policy and task linking
- Google Calendar create, update and cancellation sync
- Duplicate-safe meeting reminders and daily agenda
- Missed-meeting follow-up task automation
- Dashboard Meeting Command Center with quick actions
- Desktop and mobile support

## Release validation

Run `testBuild1005ReleaseCandidate` in Google Apps Script. Acceptance requires four passed regression groups and zero failures.

## Production activation

Update the existing active Web App deployment to a new version. The existing `runDailyRenewalAutomation` trigger also runs Meeting Automation.
