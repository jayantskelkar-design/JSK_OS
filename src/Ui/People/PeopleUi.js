/**
 * JSK OS
 * Module: People UI
 * Version: 1.2.0
 */

/**
 * Renders the People CRM interface.
 *
 * @return {GoogleAppsScript.HTML.HtmlOutput} People CRM page.
 */
function renderPeopleUi() {
  var template = HtmlService.createTemplateFromFile(
    'Ui/People/People'
  );

  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = '1.2.0';
  template.currentUser =
    JSKOS.ConfigService.getCurrentUser();
  template.routeUrls = JSKOS.Router.getRouteUrls();

  return template
    .evaluate()
    .setTitle('People | JSK OS')
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    );
}

/**
 * Verifies that the People UI template can be rendered.
 *
 * Run manually from Apps Script.
 *
 * @return {Object} Test result.
 */
function testPeopleUiRendering() {
  var output = renderPeopleUi();
  var content = output.getContent();

  if (
    !content ||
    content.indexOf('JSK People CRM') === -1
  ) {
    throw new Error(
      'People UI rendering test failed.'
    );
  }

  var requiredMarkers = [
    'addPersonButton',
    'peopleTableBody',
    'personModal',
    'apiPeopleSearch',
    'apiPeopleCreate'
  ];

  requiredMarkers.forEach(function (marker) {
    if (content.indexOf(marker) === -1) {
      throw new Error(
        'People UI rendering test failed. ' +
        'Missing marker: ' +
        marker
      );
    }
  });

  var result = {
    success: true,
    message: 'People UI rendered successfully.',
    contentLength: content.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}
