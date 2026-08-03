/** JSK OS Build 1008 - Document Vault UI. */
function renderDocumentUi() {
  ensureBuild1008Documents();
  var template = HtmlService.createTemplateFromFile('Ui/Document/Document');
  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = JSKOS.Config.APP.VERSION;
  template.currentUser = JSKOS.ConfigService.getCurrentUser();
  template.routeUrls = JSKOS.Router.getRouteUrls();
  return template.evaluate().setTitle('Document Vault | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function testDocumentUiRendering() {
  var content = renderDocumentUi().getContent();
  ['Document Vault', 'documentTableBody', 'apiDocumentSearch', 'apiDocumentCreate', 'apiDocumentUpdate'].forEach(function (marker) {
    if (content.indexOf(marker) === -1) throw new Error('Missing Document UI marker: ' + marker);
  });
  return { success: true, contentLength: content.length };
}
