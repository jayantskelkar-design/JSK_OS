/**
 * JSK OS v1.0 Enterprise
 * Module: Dashboard Service Tests
 */

function testDashboardService() {
  assertDashboardService_(
    typeof JSKOS !== 'undefined',
    'JSKOS namespace is unavailable.'
  );

  assertDashboardService_(
    JSKOS.DashboardService,
    'DashboardService is unavailable.'
  );

  assertDashboardService_(
    typeof JSKOS.DashboardService.getDashboard === 'function',
    'getDashboard() is unavailable.'
  );

  assertDashboardService_(
    typeof JSKOS.DashboardService.getSummary === 'function',
    'getSummary() is unavailable.'
  );

  var dashboard = JSKOS.DashboardService.getDashboard();

  assertDashboardService_(
    dashboard && typeof dashboard === 'object',
    'getDashboard() must return an object.'
  );

  assertDashboardService_(
    dashboard.summary &&
      typeof dashboard.summary === 'object',
    'Dashboard summary is unavailable.'
  );

  assertDashboardService_(
    dashboard.renewals &&
      typeof dashboard.renewals === 'object',
    'Renewal dashboard is unavailable.'
  );

  [
    'due30Days',
    'due60Days',
    'due90Days',
    'overdue',
    'renewed'
  ].forEach(function (metricName) {
    validateDashboardMetric_(
      dashboard.renewals[metricName],
      'renewals.' + metricName
    );
  });

  testRenewalDashboardBoundaries_();
  testRenewalPipeline_();
  testTaskDashboardSummary();
  testMeetingDashboardSummary();

  assertDashboardService_(
    dashboard.renewalPipeline &&
      typeof dashboard.renewalPipeline === 'object',
    'Renewal pipeline is unavailable.'
  );

  [
    'callPending',
    'whatsappSent',
    'quoteSent',
    'negotiation',
    'won',
    'lost'
  ].forEach(function (metricName) {
    validateDashboardMetric_(
      dashboard.renewalPipeline[metricName],
      'renewalPipeline.' + metricName
    );
  });

  validateDashboardMetric_(
    dashboard.summary.companies,
    'companies'
  );

  validateDashboardMetric_(
    dashboard.summary.people,
    'people'
  );

  validateDashboardMetric_(
    dashboard.summary.followups,
    'followups'
  );

  validateDashboardMetric_(
    dashboard.summary.highRiskCompanies,
    'highRiskCompanies'
  );

  assertDashboardService_(
    typeof dashboard.summary.generatedAt === 'string',
    'generatedAt must be a string.'
  );

  var generatedDate =
    new Date(dashboard.summary.generatedAt);

  assertDashboardService_(
    !isNaN(generatedDate.getTime()),
    'generatedAt is not a valid date.'
  );

  var directSummary =
    JSKOS.DashboardService.getSummary();

  assertDashboardService_(
    directSummary &&
      typeof directSummary === 'object',
    'getSummary() must return an object.'
  );

  var result = {
    success: true,
    message: 'DashboardService tests passed.',
    summary: dashboard.summary,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}

function testMeetingDashboardSummary() {
  var summary = JSKOS.DashboardService.summarizeMeetings([
    { meetingId:'M1', title:'Today', status:'Scheduled', startAt:'2026-08-02T11:00', owner:'JSK' },
    { meetingId:'M2', title:'Missed', status:'Scheduled', startAt:'2026-08-01T11:00', owner:'' },
    { meetingId:'M3', title:'Upcoming', status:'Scheduled', startAt:'2026-08-05T11:00', owner:'JSK' },
    { meetingId:'M4', title:'Done', status:'Completed', startAt:'2026-08-01T11:00', owner:'JSK' }
  ], new Date(2026, 7, 2, 9, 0), 8);
  assertDashboardService_(summary.summary.today === 1, 'Today meeting count failed.');
  assertDashboardService_(summary.summary.missed === 1, 'Missed meeting count failed.');
  assertDashboardService_(summary.summary.upcoming === 1, 'Upcoming meeting count failed.');
  assertDashboardService_(summary.summary.completed === 1, 'Completed meeting count failed.');
  assertDashboardService_(summary.summary.unassigned === 1, 'Unassigned meeting count failed.');
  return { success:true, message:'Meeting dashboard summary passed.' };
}

function testTaskDashboardSummary() {
  var summary = JSKOS.DashboardService.summarizeTasks([
    { taskId: 'TSK-1', title: 'Overdue call', status: 'Open', priority: 'High', dueDate: '2026-08-01', owner: '' },
    { taskId: 'TSK-2', title: 'Today critical', status: 'In Progress', priority: 'Critical', dueDate: '2026-08-02', owner: 'JSK' },
    { taskId: 'TSK-3', title: 'Future high', status: 'Waiting', priority: 'High', dueDate: '2026-08-10', owner: 'JSK' },
    { taskId: 'TSK-4', title: 'No date', status: 'Open', priority: 'Medium', dueDate: '', owner: '' },
    { taskId: 'TSK-5', title: 'Completed', status: 'Completed', priority: 'Critical', dueDate: '2026-08-01', owner: 'JSK' }
  ], new Date(2026, 7, 2), 8);

  assertDashboardService_(summary.summary.totalOpen === 4, 'Open task count failed.');
  assertDashboardService_(summary.summary.dueToday === 1, 'Today task count failed.');
  assertDashboardService_(summary.summary.overdue === 1, 'Overdue task count failed.');
  assertDashboardService_(summary.summary.highPriority === 3, 'High-priority task count failed.');
  assertDashboardService_(summary.summary.unassigned === 2, 'Unassigned task count failed.');
  assertDashboardService_(summary.items.length === 3, 'Actionable task count failed.');
  assertDashboardService_(summary.items[0].taskId === 'TSK-1', 'Task ordering failed.');

  return { success: true, message: 'Task dashboard summary test passed.' };
}

function validateDashboardMetric_(value, metricName) {
  assertDashboardService_(
    typeof value === 'number',
    metricName + ' must be a number.'
  );

  assertDashboardService_(
    isFinite(value),
    metricName + ' must be finite.'
  );

  assertDashboardService_(
    value >= 0,
    metricName + ' cannot be negative.'
  );
}

function assertDashboardService_(condition, message) {
  if (!condition) {
    throw new Error(
      'DashboardService Test Failed: ' + message
    );
  }
}

function testRenewalDashboardBoundaries_() {
  var referenceDate = new Date(2026, 7, 1);
  var summary = JSKOS.DashboardService.summarizeRenewals([
    { policyStatus: 'Active', renewalDate: new Date(2026, 6, 31) },
    { policyStatus: 'Active', renewalDate: new Date(2026, 7, 1) },
    { policyStatus: 'Renewal Due', renewalDate: new Date(2026, 7, 31) },
    { policyStatus: 'Issued', renewalDate: new Date(2026, 8, 1) },
    { policyStatus: 'Active', renewalDate: new Date(2026, 8, 30) },
    { policyStatus: 'Active', renewalDate: new Date(2026, 9, 1) },
    { policyStatus: 'Renewed', renewalDate: new Date(2026, 7, 10) },
    { policyStatus: 'Cancelled', renewalDate: new Date(2026, 7, 10) }
  ], referenceDate);

  assertDashboardService_(summary.overdue === 1, 'Overdue boundary failed.');
  assertDashboardService_(summary.due30Days === 2, '30-day boundary failed.');
  assertDashboardService_(summary.due60Days === 2, '60-day boundary failed.');
  assertDashboardService_(summary.due90Days === 1, '90-day boundary failed.');
  assertDashboardService_(summary.renewed === 1, 'Renewed count failed.');
}

function testRenewalPipeline_() {
  var summary = JSKOS.DashboardService.summarizeRenewalPipeline([
    { policyStatus: 'Active', renewalDate: new Date(2026, 7, 15) },
    { policyStatus: 'Active', renewalDate: new Date(2027, 0, 1) },
    { renewalStage: 'Call Pending' },
    { renewalStage: 'WhatsApp Sent' },
    { renewalStage: 'Quote Sent' },
    { renewalStage: 'Negotiation' },
    { renewalStage: 'Won' },
    { renewalStage: 'Lost' }
  ], new Date(2026, 7, 1));

  assertDashboardService_(summary.callPending === 2, 'Call Pending count failed.');
  assertDashboardService_(summary.whatsappSent === 1, 'WhatsApp Sent count failed.');
  assertDashboardService_(summary.quoteSent === 1, 'Quote Sent count failed.');
  assertDashboardService_(summary.negotiation === 1, 'Negotiation count failed.');
  assertDashboardService_(summary.won === 1, 'Won count failed.');
  assertDashboardService_(summary.lost === 1, 'Lost count failed.');
}
