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
