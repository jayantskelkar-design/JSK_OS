/** JSK OS Build 1011 - Release candidate regression suite. */

function testRevenueUiRendering() {
  var output = renderRevenueUi();
  var html = output.getContent();
  var requiredMarkers = [
    'Revenue & Commission',
    'Revenue Register',
    'Finance Intelligence',
    'apiRevenueIntelligence',
    'apiRevenueRecordPayment'
  ];
  var missing = requiredMarkers.filter(function (marker) {
    return html.indexOf(marker) === -1;
  });
  if (missing.length) {
    throw new Error('Revenue UI is missing: ' + missing.join(', '));
  }
  return { success: true, markersChecked: requiredMarkers.length };
}

function testRevenueApiContracts() {
  var search = apiRevenueSearch({});
  var summary = apiRevenueSummary();
  var intelligence = apiRevenueIntelligence();
  var exportResult = apiRevenueExport();
  var invalidPayment = apiRevenueRecordPayment({ amount: 0 });

  if (!search.success || !Array.isArray(search.data.items)) {
    throw new Error('Revenue search contract failed.');
  }
  if (!summary.success || typeof summary.data.outstanding !== 'number') {
    throw new Error('Revenue summary contract failed.');
  }
  if (
    !intelligence.success ||
    !intelligence.data.ageing ||
    typeof intelligence.data.ageing.days90Plus !== 'number'
  ) {
    throw new Error('Revenue intelligence contract failed.');
  }
  if (
    !exportResult.success ||
    exportResult.data.fileName !== 'JSK_OS_Revenue_Export.csv' ||
    exportResult.data.csv.indexOf('Revenue ID') !== 0
  ) {
    throw new Error('Revenue export contract failed.');
  }
  if (invalidPayment.success || !invalidPayment.error) {
    throw new Error('Revenue payment validation contract failed.');
  }

  return {
    success: true,
    recordsChecked: search.data.total,
    exportBytes: exportResult.data.csv.length
  };
}

function testBuild1011ReleaseCandidate() {
  var tests = [
    { name: 'Revenue foundation', run: testRevenueFoundation },
    { name: 'Revenue UI', run: testRevenueUiRendering },
    { name: 'Revenue API contracts', run: testRevenueApiContracts }
  ];
  var results = tests.map(function (test) {
    try {
      return { name: test.name, success: true, result: test.run() };
    } catch (error) {
      return {
        name: test.name,
        success: false,
        error: error.message || String(error)
      };
    }
  });
  var failures = results.filter(function (result) {
    return !result.success;
  });
  var report = {
    success: failures.length === 0,
    build: 1011,
    version: JSKOS.Config.APP.VERSION,
    revenueSchemaVersion: JSK_REVENUE_SCHEMA.VERSION,
    passed: results.length - failures.length,
    failed: failures.length,
    results: results,
    generatedAt: new Date().toISOString()
  };
  console.info(JSON.stringify(report));
  if (failures.length) {
    throw new Error(
      'Build 1011 release regression failed: ' +
      failures.map(function (item) {
        return item.name + ' - ' + item.error;
      }).join('; ')
    );
  }
  return report;
}
