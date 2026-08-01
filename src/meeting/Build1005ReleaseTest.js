/** JSK OS Build 1005 - Release candidate regression suite. */

function testBuild1005ReleaseCandidate() {
  var tests = [
    { name: 'Meeting foundation', run: testMeetingFoundation },
    { name: 'Meeting UI', run: testMeetingUiRendering },
    { name: 'Meeting automation plan', run: testMeetingAutomationPlan },
    { name: 'Meeting dashboard', run: testMeetingDashboardSummary }
  ];
  var results = tests.map(function (test) {
    try { return { name:test.name, success:true, result:test.run() }; }
    catch (error) { return { name:test.name, success:false, error:error.message || String(error) }; }
  });
  var failures = results.filter(function (result) { return !result.success; });
  var report = {
    success: failures.length === 0,
    build: 1005,
    version: JSKOS.Config.APP.VERSION,
    meetingSchemaVersion: JSK_MEETING_SCHEMA.VERSION,
    passed: results.length - failures.length,
    failed: failures.length,
    results: results,
    generatedAt: new Date().toISOString()
  };
  console.info(JSON.stringify(report));
  if (failures.length) throw new Error('Build 1005 release regression failed: ' + failures.map(function (item) { return item.name + ' - ' + item.error; }).join('; '));
  return report;
}
