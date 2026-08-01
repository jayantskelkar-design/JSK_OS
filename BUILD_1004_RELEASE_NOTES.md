# JSK OS Build 1004 — v1.3.0-beta

## Included

- Task database, repository and API foundation
- Responsive Task Management UI
- Dashboard Task Command Center
- Renewal-to-task automation with duplicate prevention
- Overdue Critical escalation and terminal-stage auto-close
- Owner reminders, overdue digest and Critical alerts
- Daily automation integration and notification audit log

## Release validation

Run `testBuild1004ReleaseCandidate` in Google Apps Script. The release candidate is accepted only when all five regression groups pass.

## Production activation

Update the existing active Web App deployment to a new version. Do not create a Library-only deployment. Existing `runDailyRenewalAutomation` trigger executes Task Automation and Notifications.
