/**
 * JSK OS
 * Module: Company UI
 * Version: 0.8.0
 */

/**
 * Renders the Company CRM interface.
 *
 * @return {GoogleAppsScript.HTML.HtmlOutput} Company CRM page.
 */
function renderCompanyUi() {
  var template = HtmlService.createTemplateFromFile(
    'Ui/Company/Company'
  );

  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = '0.8.0';
  template.currentUser = JSKOS.ConfigService.getCurrentUser();

  return template
    .evaluate()
    .setTitle('Companies | JSK OS')
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    );
}

/**
 * Verifies that the Company UI template can be rendered.
 *
 * Run manually from Apps Script.
 *
 * @return {Object} Test result.
 */
function testCompanyUiRendering() {
  var output = renderCompanyUi();
  var content = output.getContent();

  if (!content || content.indexOf('JSK Company CRM') === -1) {
    throw new Error(
      'Company UI rendering test failed.'
    );
  }

  var result = {
    success: true,
    message: 'Company UI rendered successfully.',
    contentLength: content.length,
    timestamp: new Date().toISOString()
  };

  console.info(JSON.stringify(result));

  return result;
}