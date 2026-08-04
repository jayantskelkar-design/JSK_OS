/** JSK OS Build 1012 - Reports foundation smoke test. */
function testReportFoundation() {
  var response = apiReportExecutiveSummary();
  var filters = getReportFilters();
  if (!response.success) {
    throw new Error(
      'Build 1012 report foundation failed: ' +
      (response.error && response.error.message)
    );
  }
  var data = response.data || {};
  var success = Boolean(
    data.clients &&
    data.business &&
    data.servicing &&
    data.finance &&
    typeof data.finance.outstanding === 'number' &&
    filters.modules.indexOf('Revenue') !== -1
  );
  var result = {
    success: success,
    build: 1012,
    schemaVersion: JSK_REPORT_SCHEMA.VERSION,
    companyCount: data.clients && data.clients.companies,
    policyCount: data.business && data.business.policies,
    outstandingRevenue: data.finance && data.finance.outstanding
  };
  console.info(JSON.stringify(result));
  if (!success) throw new Error('Build 1012 report contract failed.');
  return result;
}
