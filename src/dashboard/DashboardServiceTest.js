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