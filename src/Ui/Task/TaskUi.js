/** JSK OS Build 1004 - Task Management UI. */

function renderTaskUi() {
  ensureBuild1004Tasks();
  var template = HtmlService.createTemplateFromFile('Ui/Task/Task');
  template.applicationName = JSKOS.Config.APP.NAME;
  template.applicationVersion = JSKOS.Config.APP.VERSION;
  template.currentUser = JSKOS.ConfigService.getCurrentUser();
  template.routeUrls = JSKOS.Router.getRouteUrls();
  return template.evaluate()
    .setTitle('Tasks | JSK OS')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function testTaskUiRendering() {
  var content = renderTaskUi().getContent();
  ['taskTableBody', 'taskModal', 'apiTaskSearch', 'apiTaskCreate'].forEach(function (marker) {
    if (content.indexOf(marker) === -1) throw new Error('Missing Task UI marker: ' + marker);
  });
  return { success: true, contentLength: content.length };
}

