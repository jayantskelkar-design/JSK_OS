/** JSK OS Builds 1007-1012 release regression and stable-readiness suites. */

function runJSKOSReleaseSuite_(build, tests, schemaVersion) {
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
  var failures = results.filter(function (result) { return !result.success; });
  var report = {
    success: failures.length === 0,
    build: build,
    version: JSKOS.Config.APP.VERSION,
    schemaVersion: schemaVersion,
    passed: results.length - failures.length,
    failed: failures.length,
    results: results,
    generatedAt: new Date().toISOString()
  };
  console.info(JSON.stringify(report));
  if (failures.length) {
    throw new Error(
      'Build ' + build + ' release regression failed: ' +
      failures.map(function (item) {
        return item.name + ' - ' + item.error;
      }).join('; ')
    );
  }
  return report;
}

function testUiMarker_(renderer, markers) {
  var content = renderer().getContent();
  markers.forEach(function (marker) {
    if (content.indexOf(marker) === -1) {
      throw new Error('Missing UI marker: ' + marker);
    }
  });
  return { success: true, markersChecked: markers.length };
}

function testBuild1002ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1002, [
    { name: 'Dashboard service', run: testDashboardService },
    { name: 'Renewal candidates', run: testRenewalAutomationCandidates },
    { name: 'Renewal follow-up plan', run: testRenewalFollowUpPlan },
    { name: 'GARUDA intelligence', run: testGarudaRenewalIntelligence }
  ], JSK_POLICY_SCHEMA.VERSION);
}

function testBuild1003ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1003, [
    { name: 'Renewal work queue', run: testRenewalWorkQueue },
    { name: 'Work queue timezone', run: testRenewalWorkQueueTimezoneFormatting }
  ], JSK_POLICY_SCHEMA.VERSION);
}

function testBuild1007ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1007, [
    { name: 'Claim foundation', run: testClaimFoundation },
    { name: 'Claim UI', run: testClaimUiRendering },
    { name: 'Claim navigation', run: testBuild1007RuntimeNavigation }
  ], JSK_CLAIM_SCHEMA.VERSION);
}

function testBuild1008ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1008, [
    { name: 'Document foundation', run: testDocumentFoundation },
    { name: 'Document serialization', run: testDocumentApiSerialization },
    { name: 'Document mapping', run: testDocumentHeaderMapping },
    { name: 'Archived document search', run: testArchivedDocumentSearch },
    { name: 'Document expiry summary', run: testDocumentExpirySummary },
    { name: 'Document UI', run: testDocumentUiRendering }
  ], JSK_DOCUMENT_SCHEMA.VERSION);
}

function testBuild1009ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1009, [
    { name: 'Endorsement foundation', run: testEndorsementFoundation },
    { name: 'Endorsement transitions', run: testEndorsementStatusTransitions },
    { name: 'Endorsement intelligence', run: testEndorsementIntelligenceApi },
    { name: 'Endorsement UI', run: testEndorsementUiRendering }
  ], JSK_ENDORSEMENT_SCHEMA.VERSION);
}

function testBuild1010ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1010, [
    { name: 'Quote foundation', run: testQuoteFoundation },
    { name: 'Quote comparison', run: testQuoteComparisonApi },
    { name: 'Quote totals', run: testQuoteAutomaticTotals },
    { name: 'Quote UI', run: function () {
      return testUiMarker_(renderQuoteUi, [
        'Quote Management',
        'quoteTableBody',
        'apiQuoteSearch',
        'apiQuoteCreate'
      ]);
    } }
  ], JSK_QUOTE_SCHEMA.VERSION);
}

function testBuild1012ReleaseCandidate() {
  return runJSKOSReleaseSuite_(1012, [
    { name: 'Report foundation', run: testReportFoundation },
    { name: 'Report automation plan', run: testReportAutomationPlan },
    { name: 'Report UI', run: function () {
      return testUiMarker_(renderReportUi, [
        'Reports & Analytics',
        'Executive Summary',
        'apiReportExecutiveSummary',
        'apiReportExport'
      ]);
    } },
    { name: 'Complete navigation', run: testCompleteNavigation },
    { name: 'Trigger audit contract', run: testAutomationTriggerAuditContract }
  ], JSK_REPORT_SCHEMA.VERSION);
}

function testCompleteNavigation() {
  var routeKeys = Object.keys(JSKOS.RouteConfig.ROUTES);
  var results = routeKeys.map(function (routeKey) {
    var content = doGet({ parameter: { page: routeKey } }).getContent();
    var nav = content.match(
      /<nav class="navigation"[^>]*>[\s\S]*?<\/nav>/i
    );
    if (!nav) throw new Error('Canonical navigation missing: ' + routeKey);
    var missing = routeKeys.filter(function (expectedKey) {
      return nav[0].indexOf('page=' + expectedKey) === -1;
    });
    if (missing.length) {
      throw new Error(
        routeKey + ' navigation missing: ' + missing.join(', ')
      );
    }
    return { route: routeKey, links: routeKeys.length };
  });
  return { success: true, routesChecked: results.length, results: results };
}

function testJSKOSStableReleaseReadiness() {
  var suites = [
    { name: 'Core configuration', run: testJskOsCoreConfig },
    { name: 'Core framework', run: testCoreFramework },
    { name: 'Core UI integration', run: testCoreUiIntegration },
    { name: 'Release operations plan', run: testReleaseOperationsPlan },
    { name: 'Build 1002', run: testBuild1002ReleaseCandidate },
    { name: 'Build 1003', run: testBuild1003ReleaseCandidate },
    { name: 'Build 1004', run: testBuild1004ReleaseCandidate },
    { name: 'Build 1005', run: testBuild1005ReleaseCandidate },
    { name: 'Build 1006', run: testBuild1006ReleaseCandidate },
    { name: 'Build 1007', run: testBuild1007ReleaseCandidate },
    { name: 'Build 1008', run: testBuild1008ReleaseCandidate },
    { name: 'Build 1009', run: testBuild1009ReleaseCandidate },
    { name: 'Build 1010', run: testBuild1010ReleaseCandidate },
    { name: 'Build 1011', run: testBuild1011ReleaseCandidate },
    { name: 'Build 1012', run: testBuild1012ReleaseCandidate },
    { name: 'All web routes', run: testAllWebRoutes }
  ];
  var report = runJSKOSReleaseSuite_('STABLE', suites, null);
  var triggers = auditAutomationTriggers();
  report.triggerAudit = triggers;
  report.readyForStableDeployment = report.success && triggers.success;
  console.info(JSON.stringify(report));
  return report;
}
