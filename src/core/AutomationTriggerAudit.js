/** JSK OS production automation trigger audit and repair utilities. */
var JSK_AUTOMATION_TRIGGERS = Object.freeze([
  { handler: 'runDailyRenewalAutomation_', schedule: 'Daily renewal automation' },
  { handler: 'runDailyDocumentExpiryAutomation_', schedule: 'Daily document expiry' },
  { handler: 'runDailyEndorsementAutomation_', schedule: 'Daily endorsement SLA' },
  { handler: 'runDailyQuoteAutomation_', schedule: 'Daily quote expiry' },
  { handler: 'runDailyRevenueAutomation_', schedule: 'Daily revenue collection' },
  { handler: 'sendExecutiveReportEmailTrusted_', schedule: 'Daily executive report' },
  { handler: 'runWaLeadCommunicationAutomation_', schedule: 'WA Lead outbox' }
]);

function auditAutomationTriggers() {
  JSKOS.LegacyMutationAuthority.requireAdmin('automation.audit');
  var counts = {};
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    counts[handler] = (counts[handler] || 0) + 1;
  });
  var items = JSK_AUTOMATION_TRIGGERS.map(function (definition) {
    var count = counts[definition.handler] || 0;
    return {
      handler: definition.handler,
      schedule: definition.schedule,
      count: count,
      installed: count === 1,
      duplicate: count > 1
    };
  });
  var result = {
    success: items.every(function (item) { return item.installed; }),
    expected: items.length,
    installed: items.filter(function (item) { return item.installed; }).length,
    missing: items.filter(function (item) { return item.count === 0; })
      .map(function (item) { return item.handler; }),
    duplicates: items.filter(function (item) { return item.duplicate; })
      .map(function (item) { return item.handler; }),
    items: items,
    generatedAt: new Date().toISOString()
  };
  console.info(JSON.stringify(result));
  return result;
}

function installAllAutomationTriggers() {
  JSKOS.LegacyMutationAuthority.requireAdmin('automation.install-all');
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'runWaLeadCommunicationAutomation_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  var results = [
    { name: 'Renewals', result: installDailyRenewalAutomation() },
    { name: 'Documents', result: installDocumentExpiryTrigger() },
    { name: 'Endorsements', result: installEndorsementAutomationTrigger() },
    { name: 'Quotes', result: installQuoteAutomationTrigger() },
    { name: 'Revenue', result: installRevenueAutomationTrigger() },
    { name: 'Reports', result: installExecutiveReportTrigger() },
    { name: 'WA Lead', result: ensureWaLeadCommunicationAutomation() }
  ];
  return {
    success: true,
    installed: results,
    audit: auditAutomationTriggers()
  };
}

function testAutomationTriggerAuditContract() {
  var audit = auditAutomationTriggers();
  if (
    audit.expected !== JSK_AUTOMATION_TRIGGERS.length ||
    !Array.isArray(audit.items) ||
    !Array.isArray(audit.missing) ||
    !Array.isArray(audit.duplicates)
  ) {
    throw new Error('Automation trigger audit contract failed.');
  }
  return { success: true, audit: audit };
}
