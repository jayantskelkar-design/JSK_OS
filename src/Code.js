/**
 * JSK OS
 * Main Web Application Router
 *
 * @param {GoogleAppsScript.Events.DoGet} event Request event.
 * @return {GoogleAppsScript.HTML.HtmlOutput} Rendered page.
 */
function doGet(event) {
  var parameters = event && event.parameter
    ? event.parameter
    : {};

  var page = String(parameters.page || 'companies')
    .trim()
    .toLowerCase();

  switch (page) {
    case 'companies':
      return renderCompanyUi();

    default:
      return renderCompanyUi();
  }
}

/**
 * Includes an HTML partial inside another HTML template.
 *
 * @param {string} fileName Apps Script HTML filename.
 * @return {string} HTML content.
 */
function include(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('HTML include filename is required.');
  }

  return HtmlService
    .createHtmlOutputFromFile(fileName)
    .getContent();
}