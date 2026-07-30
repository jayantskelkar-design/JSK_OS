/**
 * JSK OS Core UI Integration Test
 * Version: 1.0.0
 */
function testCoreUiIntegration() {
  var output = renderEnterpriseDashboardUi();
  var content = output.getContent();

  var requiredMarkers = [
    'jskModalOverlay',
    'jskModalDialog',
    'jsk-modal-overlay.active',
    'window.JSKModal',
    'window.JSKToast',
    'JSK OS Enterprise'
  ];

  requiredMarkers.forEach(function (marker) {
    if (content.indexOf(marker) === -1) {
      throw new Error(
        'Core UI integration failed. Missing marker: ' + marker
      );
    }
  });

  var result = {
    success: true,
    message: 'JSK OS Core UI integration passed.',
    markers: requiredMarkers,
    contentLength: content.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));
  return result;
}
