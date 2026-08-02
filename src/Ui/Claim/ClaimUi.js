/** JSK OS Build 1007 - Claim Management UI. */
function renderClaimUi() {
  ensureBuild1007Claims();
  var template = HtmlService.createTemplateFromFile('Ui/Claim/Claim');
  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = JSKOS.Config.APP.VERSION;
  template.currentUser = JSKOS.ConfigService.getCurrentUser();
  template.routeUrls = JSKOS.Router.getRouteUrls();
  return template.evaluate().setTitle('Claims | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function testClaimUiRendering() {
  var content = renderClaimUi().getContent();
  ['Claim Management', 'claimTableBody', 'apiClaimSearch', 'apiClaimCreate', 'apiClaimUpdate'].forEach(function (marker) {
    if (content.indexOf(marker) === -1) throw new Error('Missing Claim UI marker: ' + marker);
  });
  var result = { success: true, contentLength: content.length };
  console.info(JSON.stringify(result)); return result;
}
