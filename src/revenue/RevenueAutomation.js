/** JSK OS Build 1011 Phase 2 - Revenue collection automation. */

function runDailyRevenueAutomation() {
  var authority = JSKOS.LegacyMutationAuthority.requireAdmin('revenue.automation');
  return runDailyRevenueAutomationWithAuthority_(authority);
}

function runDailyRevenueAutomation_() {
  return legacyRunTrustedSystem_('REVENUE_AUTOMATION', runDailyRevenueAutomationWithAuthority_);
}

function runDailyRevenueAutomationWithAuthority_(authority) {
  JSKOS.LegacyMutationAuthority.assertMutation(authority);
  ensureBuild1011Revenue();
  requireBuild1004Tasks_();
  var actor = JSKOS.LegacyMutationAuthority.actor(authority);
  var repo = new RevenueRepository();
  var taskRepo = new TaskRepository();
  var items = repo.search({}).items || [];
  var tasks = taskRepo.search({}).items || [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var markers = {};
  tasks.forEach(function (task) {
    var match = String(task.description || '').match(/\[AUTO-REVENUE:([^\]]+)\]/);
    if (match) markers[match[1]] = true;
  });
  var overdue = [], updated = 0, created = 0;
  items.forEach(function (item) {
    if (!item.outstandingAmount || !item.expectedDate || item.paymentStatus === 'Disputed') return;
    if (new Date(item.expectedDate) >= today) return;
    overdue.push(item);
    if (item.paymentStatus !== 'Overdue') {
      try { item = repo.update(item.revenueId, { paymentStatus: 'Overdue' }, actor, item.recordVersion); updated += 1; }
      catch (error) { console.error(error); }
    }
    if (!markers[item.revenueId]) {
      taskRepo.create({
        title: 'Collect revenue ' + (item.invoiceNumber || item.policyNumber || item.revenueId),
        description: '[AUTO-REVENUE:' + item.revenueId + '] Outstanding INR ' + item.outstandingAmount,
        taskType: 'Follow-up', status: 'Open', priority: 'High', owner: item.assignedOwner || '',
        dueDate: Utilities.formatDate(today, 'Asia/Kolkata', 'yyyy-MM-dd'),
        companyId: item.companyId || '', policyId: item.policyId || ''
      }, actor);
      created += 1;
    }
  });
  var props = PropertiesService.getScriptProperties();
  var recipients = String(props.getProperty('JSK_OS_REVENUE_RECIPIENTS') || props.getProperty('JSK_OS_RENEWAL_DASHBOARD_RECIPIENTS') || '').trim();
  var sent = false;
  if (recipients && overdue.length) {
    MailApp.sendEmail(recipients, 'JSK OS Revenue Collection Digest', ['Overdue receivables: ' + overdue.length, ''].concat(overdue.map(function (item) {
      return '- ' + item.insurerName + ' | ' + (item.invoiceNumber || item.policyNumber) + ' | INR ' + item.outstandingAmount;
    })).join('\n'));
    sent = true;
  }
  return { overdue: overdue.length, statusesUpdated: updated, tasksCreated: created, emailSent: sent };
}

function installRevenueAutomationTrigger() {
  JSKOS.LegacyMutationAuthority.requireAdmin('revenue.install-trigger');
  var handler = 'runDailyRevenueAutomation_';
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });
  var trigger = ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(11).create();
  return { success: true, triggerId: trigger.getUniqueId() };
}
