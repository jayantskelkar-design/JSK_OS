/**
 * JSK OS
 * Module: Policy UI
 * Version: 1.0.0
 */

/**
 * Renders the Policy Management interface.
 *
 * @return {GoogleAppsScript.HTML.HtmlOutput} Policy Management page.
 */
function renderPolicyUi() {
  var template = HtmlService.createTemplateFromFile(
    'Ui/Policy/Policy'
  );

  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = '1.0.0';
  template.currentUser =
    JSKOS.ConfigService.getCurrentUser();
  template.routeUrls = JSKOS.Router.getRouteUrls();

  return template
    .evaluate()
    .setTitle('Policies | JSK OS')
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    );
}

/**
 * Verifies that the Policy UI template can be rendered.
 *
 * Run manually from Apps Script.
 *
 * @return {Object} Test result.
 */
function testPolicyUiRendering() {
  var output = renderPolicyUi();
  var content = output.getContent();

  if (
    !content ||
    content.indexOf('JSK Policy Management') === -1
  ) {
    throw new Error(
      'Policy UI rendering test failed.'
    );
  }

  var requiredMarkers = [
    'addPolicyButton',
    'policyTableBody',
    'policyModal',
    'apiPolicySearch',
    'apiPolicyCreate'
  ];

  requiredMarkers.forEach(function (marker) {
    if (content.indexOf(marker) === -1) {
      throw new Error(
        'Policy UI rendering test failed. ' +
        'Missing marker: ' +
        marker
      );
    }
  });

  var result = {
    success: true,
    message: 'Policy UI rendered successfully.',
    contentLength: content.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}
