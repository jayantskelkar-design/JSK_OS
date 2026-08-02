/** JSK OS Build 1006 - Release candidate regression suite. */

function testBuild1006ReleaseCandidate() {
  var tests = [
    { name: 'Communication foundation', run: testCommunicationFoundation },
    { name: 'Communication UI', run: testCommunicationUiRendering },
    { name: 'Meta WhatsApp provider', run: testMetaWhatsAppProvider },
    { name: 'WA Lead provider', run: testWaLeadWhatsAppProvider },
    { name: 'Web routes', run: testAllWebRoutes }
  ];
  var results = tests.map(function (test) {
    try { return { name: test.name, success: true, result: test.run() }; }
    catch (error) { return { name: test.name, success: false, error: error.message || String(error) }; }
  });
  var failures = results.filter(function (result) { return !result.success; });
  var report = {
    success: failures.length === 0,
    build: 1006,
    version: JSKOS.Config.APP.VERSION,
    communicationSchemaVersion: JSK_COMMUNICATION_SCHEMA.VERSION,
    passed: results.length - failures.length,
    failed: failures.length,
    results: results,
    generatedAt: new Date().toISOString()
  };
  console.info(JSON.stringify(report));
  if (failures.length) {
    throw new Error('Build 1006 release regression failed: ' + failures.map(function (item) {
      return item.name + ' - ' + item.error;
    }).join('; '));
  }
  return report;
}
