/** JSK OS Build 1004 - Release candidate regression suite. */

function testBuild1004ReleaseCandidate() {
  var tests = [
    { name: 'Task foundation', run: testTaskFoundation },
    { name: 'Task dashboard', run: testTaskDashboardSummary },
    { name: 'Task UI', run: testTaskUiRendering },
    { name: 'Task automation plan', run: testTaskAutomationPlan },
    { name: 'Task notification plan', run: testTaskNotificationPlan }
  ];
  var results = tests.map(function (test) {
    try {
      return { name: test.name, success: true, result: test.run() };
    } catch (error) {
      return { name: test.name, success: false, error: error.message || String(error) };
    }
  });
  var failures = results.filter(function (result) { return !result.success; });
  var report = {
    success: failures.length === 0,
    build: 1004,
    version: JSKOS.Config.APP.VERSION,
    passed: results.length - failures.length,
    failed: failures.length,
    results: results,
    generatedAt: new Date().toISOString()
  };
  console.info(JSON.stringify(report));
  if (failures.length) {
    throw new Error('Build 1004 release regression failed: ' + failures.map(function (item) {
      return item.name + ' - ' + item.error;
    }).join('; '));
  }
  return report;
}
