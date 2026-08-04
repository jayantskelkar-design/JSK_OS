/** JSK OS Build 1012 - Reports and Analytics UI. */
function renderReportUi() {
  var template = HtmlService.createTemplateFromFile('Ui/Report/Report');
  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = JSKOS.Config.APP.VERSION;
  template.currentUser = JSKOS.ConfigService.getCurrentUser();
  template.routeUrls = JSKOS.Router.getRouteUrls();
  return template.evaluate()
    .setTitle('Reports & Analytics | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
