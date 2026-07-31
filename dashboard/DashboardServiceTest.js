/**
 * JSK OS Dashboard Service Tests
 * Version: 1.0.0
 */

function testDashboardService() {
  var dashboard = JSKOS.DashboardService.getDashboard();

  assertDashboardService_(
    dashboard && typeof dashboard === 'object',
    'getDashboard() must return an object.'
  );

  assertDashboardService_(
    dashboard.summary && typeof dashboard.summary === 'object',
    'getDashboard() must return a summary object.'
  );

  var summary = dashboard.summary;
  var metricNames = [
    'companies',
    'people',
    'followups',
    'highRiskCompanies'
  ];

  metricNames.forEach(function (metricName) {
    assertDashboardService_(
      typeof summary[metricName] === 'number' &&
        isFinite(summary[metricName]) &&
        summary[metricName] >= 0,
      metricName + ' must be a finite, non-negative number.'
    );
  });

  assertDashboardService_(
    typeof summary.generatedAt === 'string' &&
      !isNaN(new Date(summary.generatedAt).getTime()),
    'generatedAt must be a valid ISO date string.'
  );

  assertDashboardService_(
    JSKOS.DashboardService.safeMetric_(function () {
      return 7;
    }) === 7,
    'safeMetric_() must return a valid metric value.'
  );

  assertDashboardService_(
    JSKOS.DashboardService.safeMetric_(function () {
      throw new Error('Expected test failure.');
    }) === 0,
    'safeMetric_() must return zero when a metric fails.'
  );

  assertDashboardService_(
    JSKOS.DashboardService.safeMetric_(function () {
      return -5;
    }) === 0,
    'safeMetric_() must prevent negative dashboard values.'
  );

  var result = {
    success: true,
    message: 'DashboardService tests passed.',
    summary: summary,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));
  return result;
}

function assertDashboardService_(condition, message) {
  if (!condition) {
    throw new Error('DashboardService Test Failed: ' + message);
  }
}
